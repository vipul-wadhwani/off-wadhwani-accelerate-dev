import { Router, Request, Response, NextFunction } from 'express';
import { authenticateUser } from '../middleware/auth';
import { createAuthenticatedClient, createServiceRoleClient } from '../config/supabase';
import { successResponse, createdResponse } from '../utils/response';
import { isZoomConfigured, generateMeetingLink, generateMeetingWithDetails } from '../services/zoomService';

const router = Router();

async function getContext(req: Request) {
    const token = req.headers.authorization?.split(' ')[1] || '';
    const supabase = createAuthenticatedClient(token);

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

    const role = profile?.role || req.user?.user_metadata?.role || 'entrepreneur';
    if (profileError) {
        console.warn(`[scheduledCalls.getContext] profiles lookup failed for ${req.user.id}: ${profileError.message}, using role: ${role}`);
    }
    return { supabase, role };
}

/**
 * GET /api/scheduled-calls
 * List scheduled calls with optional filters
 */
router.get(
    '/',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            if (!['ops_manager', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            let query = supabase
                .from('scheduled_calls')
                .select(`
                    *,
                    venture:ventures(id, name, founder_name, status, assessments:venture_assessments(program_recommendation, is_current)),
                    panelist:panelists(id, name, email, program)
                `)
                .order('call_date', { ascending: true })
                .order('start_time', { ascending: true });

            const { status, date, venture_id } = req.query;
            if (status) {
                query = query.eq('status', status as string);
            }
            if (date) {
                query = query.eq('call_date', date as string);
            }
            if (venture_id) {
                query = query.eq('venture_id', venture_id as string);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching scheduled calls:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch scheduled calls' });
            }

            // Resolve VP/VM profile names for vpvm calls
            const calls = data || [];
            const vpvmIds = calls
                .filter((c: any) => c.participant_type === 'vpvm' && c.participant_profile_id)
                .map((c: any) => c.participant_profile_id);

            if (vpvmIds.length > 0) {
                const { data: vpvmProfiles } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .in('id', vpvmIds);

                const profileMap = new Map((vpvmProfiles || []).map((p: any) => [p.id, p]));
                calls.forEach((c: any) => {
                    if (c.participant_type === 'vpvm' && c.participant_profile_id) {
                        c.vpvm_profile = profileMap.get(c.participant_profile_id) || null;
                    }
                });
            }

            successResponse(res, { scheduled_calls: calls });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * GET /api/scheduled-calls/availability
 * Get scheduled calls for a panelist on a specific date (for BOOKED indicators)
 */
router.get(
    '/availability',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            if (!['ops_manager', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const { panelist_id, date } = req.query;
            if (!panelist_id || !date) {
                return res.status(400).json({
                    success: false,
                    message: 'panelist_id and date are required',
                });
            }

            const { data, error } = await supabase
                .from('scheduled_calls')
                .select('id, call_date, start_time, end_time, status')
                .eq('panelist_id', panelist_id as string)
                .eq('call_date', date as string)
                .in('status', ['scheduled']);

            if (error) {
                console.error('Error fetching availability:', error);
                return res.status(500).json({ success: false, message: 'Failed to fetch availability' });
            }

            successResponse(res, { calls: data || [] });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * POST /api/scheduled-calls
 * Create a new scheduled call
 */
router.post(
    '/',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            if (!['ops_manager', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const { venture_id, panelist_id, participant_profile_id, call_date, start_time, end_time, meet_link: provided_meet_link, notes } = req.body;

            // Either panelist_id (panel call) or participant_profile_id (VP/VM call) is required
            if (!venture_id || !call_date || !start_time || !end_time) {
                return res.status(400).json({
                    success: false,
                    message: 'venture_id, call_date, start_time, and end_time are required'
                });
            }
            if (!panelist_id && !participant_profile_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Either panelist_id or participant_profile_id is required'
                });
            }

            const participant_type = participant_profile_id ? 'vpvm' : 'panelist';
            const callTopic = participant_type === 'vpvm' ? 'VP/VM Call' : 'Scheduled Call';

            // Use user-provided link, or Zoom auto-generated, or Jitsi fallback
            const timestamp = Date.now();
            const durationMins = Math.round((new Date(`1970-01-01T${end_time}`).getTime() - new Date(`1970-01-01T${start_time}`).getTime()) / 60000);
            const jitsiFallback = `https://meet.jit.si/wadhwani-${venture_id.slice(0, 8)}-${timestamp}`;

            let meet_link = provided_meet_link || jitsiFallback;
            let zoom_meeting_id: number | null = null;
            let zoom_meeting_password: string | null = null;

            if (!provided_meet_link && isZoomConfigured()) {
                const zoomResult = await generateMeetingWithDetails(callTopic, durationMins, `${call_date}T${start_time}`);
                if (zoomResult) {
                    meet_link = zoomResult.joinUrl;
                    zoom_meeting_id = zoomResult.meetingId;
                    zoom_meeting_password = zoomResult.password;
                }
            }

            const serviceClient = createServiceRoleClient();
            const { data, error } = await serviceClient
                .from('scheduled_calls')
                .insert({
                    venture_id,
                    panelist_id: panelist_id || null,
                    participant_profile_id: participant_profile_id || null,
                    participant_type,
                    scheduled_by: req.user.id,
                    call_date,
                    start_time,
                    end_time,
                    meet_link,
                    notes: notes || null,
                    status: 'scheduled',
                })
                .select(`
                    *,
                    venture:ventures(id, name, founder_name, status, assessments:venture_assessments(program_recommendation, is_current)),
                    panelist:panelists(id, name, email, program)
                `)
                .single();

            if (error) {
                console.error('Error creating scheduled call:', error);
                return res.status(500).json({ success: false, message: 'Failed to create scheduled call' });
            }

            // For VP/VM calls, also create a mentor_session so it appears in both dashboards
            if (participant_type === 'vpvm' && participant_profile_id) {
                const serviceClient = createServiceRoleClient();
                const meetingIdStr = `vpvm-${venture_id.slice(0, 8)}-${timestamp}`;

                // Get venture name for topic
                const { data: ventureData } = await serviceClient
                    .from('ventures')
                    .select('name, founder_name')
                    .eq('id', venture_id)
                    .single();

                const sessionTopic = `VP/VM Session: ${ventureData?.name || 'Venture'}`;

                const { error: sessionErr } = await serviceClient
                    .from('mentor_sessions')
                    .insert({
                        meeting_id: meetingIdStr,
                        mentor_id: participant_profile_id,
                        venture_id,
                        scheduled_by: req.user.id,
                        topic: sessionTopic,
                        mentee_name: ventureData?.founder_name || null,
                        duration_minutes: durationMins,
                        join_url: meet_link,
                        zoom_meeting_id,
                        zoom_meeting_password,
                        status: 'scheduled',
                        scheduled_date: call_date,
                        scheduled_time: start_time,
                        source: 'ops_scheduled',
                    });

                if (sessionErr) {
                    console.error('[ScheduledCalls] Failed to create mentor_session for VP/VM call:', sessionErr);
                    // Non-blocking — the scheduled_call was already created
                }
            }

            createdResponse(res, { scheduled_call: data });
        } catch (error) {
            next(error);
        }
    }
);

/**
 * PUT /api/scheduled-calls/:id/cancel
 * Cancel a scheduled call
 */
router.put(
    '/:id/cancel',
    authenticateUser,
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { supabase, role } = await getContext(req);

            if (!['ops_manager', 'admin'].includes(role)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }

            const { reason } = req.body;

            const serviceClient = createServiceRoleClient();
            const { data, error } = await serviceClient
                .from('scheduled_calls')
                .update({
                    status: 'cancelled',
                    cancellation_reason: reason || null,
                    cancelled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', req.params.id)
                .select()
                .single();

            if (error) {
                console.error('Error cancelling scheduled call:', error);
                return res.status(500).json({ success: false, message: 'Failed to cancel scheduled call' });
            }

            // Also cancel the linked mentor_session if one exists
            if (data) {
                const serviceClient = createServiceRoleClient();
                const { data: sessions } = await serviceClient
                    .from('mentor_sessions')
                    .select('id')
                    .eq('venture_id', data.venture_id)
                    .eq('scheduled_date', data.call_date)
                    .eq('scheduled_time', data.start_time)
                    .eq('status', 'scheduled');
                if (sessions && sessions.length > 0) {
                    await serviceClient
                        .from('mentor_sessions')
                        .update({ status: 'cancelled' })
                        .in('id', sessions.map((s: any) => s.id));
                    console.log(`[ScheduledCalls] Also cancelled ${sessions.length} linked mentor_session(s)`);
                }
            }

            successResponse(res, { scheduled_call: data });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
