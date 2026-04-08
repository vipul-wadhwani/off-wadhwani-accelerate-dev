import { Router, Request, Response, NextFunction } from 'express';
import { authenticateUser } from '../middleware/auth';
import { createAuthenticatedClient } from '../config/supabase';
import { successResponse, createdResponse } from '../utils/response';
import { isZoomConfigured, generateMeetingLink } from '../services/zoomService';

const router = Router();

async function getContext(req: Request) {
    const token = req.headers.authorization?.split(' ')[1] || '';
    const supabase = createAuthenticatedClient(token);

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

    return { supabase, role: profile?.role || 'entrepreneur' };
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

            successResponse(res, { scheduled_calls: data || [] });
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
            const jitsiFallback = `https://meet.jit.si/wadhwani-${venture_id.slice(0, 8)}-${timestamp}`;
            const meet_link = provided_meet_link
                || (isZoomConfigured() ? await generateMeetingLink(
                    callTopic,
                    Math.round((new Date(`1970-01-01T${end_time}`).getTime() - new Date(`1970-01-01T${start_time}`).getTime()) / 60000),
                    `${call_date}T${start_time}`,
                ) : null)
                || jitsiFallback;

            const { data, error } = await supabase
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

            const { data, error } = await supabase
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

            successResponse(res, { scheduled_call: data });
        } catch (error) {
            next(error);
        }
    }
);

export default router;
