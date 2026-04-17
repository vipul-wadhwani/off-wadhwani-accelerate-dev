import { createServiceRoleClient } from '../../config/supabase';
import { generateMeetingWithDetails, isZoomConfigured } from '../../services/zoomService';

export interface CreateRequestInput {
    venture_id: string;
    expert_id: string;
    requested_by: string;
    requested_by_role: string;
    meeting_goal?: string;
    problem_statement?: string;
    preferred_date?: string;
    preferred_time?: string;
    preferred_duration?: number;
}

/**
 * Create a new meeting request. Auto-populates company_info from venture profile.
 */
export async function createRequest(input: CreateRequestInput) {
    const supabase = createServiceRoleClient();

    // Snapshot venture info at request time
    const { data: venture } = await supabase
        .from('ventures')
        .select('name, founder_name, city, location, revenue_12m, full_time_employees, program_recommendation')
        .eq('id', input.venture_id)
        .single();

    const { data: application } = await supabase
        .from('venture_applications')
        .select('product_description, problem_statement, support_request')
        .eq('venture_id', input.venture_id)
        .maybeSingle();

    const companyInfo = {
        name: venture?.name,
        founder: venture?.founder_name,
        location: [venture?.city, venture?.location].filter(Boolean).join(', '),
        revenue: venture?.revenue_12m,
        employees: venture?.full_time_employees,
        program: venture?.program_recommendation,
        product: application?.product_description,
    };

    const { data, error } = await supabase
        .from('meeting_requests')
        .insert({
            venture_id: input.venture_id,
            expert_id: input.expert_id,
            requested_by: input.requested_by,
            requested_by_role: input.requested_by_role,
            meeting_goal: input.meeting_goal || null,
            problem_statement: input.problem_statement || application?.problem_statement || null,
            company_info: companyInfo,
            preferred_date: input.preferred_date || null,
            preferred_time: input.preferred_time || null,
            preferred_duration: input.preferred_duration || 60,
            status: 'pending',
        })
        .select()
        .single();

    if (error) {
        console.error('[MeetingRequests] Create error:', error);
        throw new Error('Failed to create meeting request');
    }

    return data;
}

/**
 * Expert accepts a request — creates Zoom meeting + mentor_session, links them.
 */
export async function acceptRequest(requestId: string, expertId: string) {
    const supabase = createServiceRoleClient();

    // Fetch the request
    const { data: request, error: fetchErr } = await supabase
        .from('meeting_requests')
        .select('*')
        .eq('id', requestId)
        .eq('expert_id', expertId)
        .single();

    if (fetchErr || !request) throw new Error('Request not found');
    if (request.status !== 'pending') throw new Error(`Cannot accept request in status: ${request.status}`);

    // Create Zoom meeting
    const ventureInfo = request.company_info as any;
    const topic = `Expert Session: ${ventureInfo?.name || 'Venture'} — ${request.meeting_goal || 'Discussion'}`;
    const duration = request.preferred_duration || 60;
    const startTime = request.preferred_date && request.preferred_time
        ? `${request.preferred_date}T${request.preferred_time}`
        : undefined;

    let joinUrl = '';
    let zoomMeetingId: number | null = null;
    let zoomPassword = '';

    if (isZoomConfigured()) {
        const zoomResult = await generateMeetingWithDetails(topic, duration, startTime);
        if (zoomResult) {
            joinUrl = zoomResult.joinUrl;
            zoomMeetingId = zoomResult.meetingId;
            zoomPassword = zoomResult.password;
        }
    }

    // Fallback to Jitsi if Zoom fails
    if (!joinUrl) {
        const ts = Date.now();
        joinUrl = `https://meet.jit.si/wadhwani-expert-${request.venture_id.slice(0, 8)}-${ts}`;
    }

    // Create mentor_session
    const meetingIdStr = `request-${requestId.slice(0, 8)}-${Date.now()}`;
    const { data: session, error: sessionErr } = await supabase
        .from('mentor_sessions')
        .insert({
            meeting_id: meetingIdStr,
            mentor_id: expertId,
            venture_id: request.venture_id,
            scheduled_by: request.requested_by,
            topic,
            duration_minutes: duration,
            join_url: joinUrl,
            zoom_meeting_id: zoomMeetingId,
            zoom_meeting_password: zoomPassword,
            status: 'scheduled',
            scheduled_date: request.preferred_date || new Date().toISOString().split('T')[0],
            scheduled_time: request.preferred_time || '10:00',
            source: 'venture_request',
        })
        .select()
        .single();

    if (sessionErr) {
        console.error('[MeetingRequests] Session create error:', sessionErr);
        throw new Error('Failed to create session');
    }

    // Update request status
    const { error: updateErr } = await supabase
        .from('meeting_requests')
        .update({
            status: 'accepted',
            responded_at: new Date().toISOString(),
            session_id: session.id,
            updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

    if (updateErr) {
        console.error('[MeetingRequests] Update error:', updateErr);
    }

    return { request: { ...request, status: 'accepted', session_id: session.id }, session };
}

/**
 * Expert declines a request.
 */
export async function declineRequest(requestId: string, expertId: string, note?: string) {
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
        .from('meeting_requests')
        .update({
            status: 'declined',
            expert_response_note: note || null,
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('expert_id', expertId)
        .eq('status', 'pending')
        .select()
        .single();

    if (error) {
        console.error('[MeetingRequests] Decline error:', error);
        throw new Error('Failed to decline request');
    }

    return data;
}

/**
 * Get requests filtered by role and status.
 */
export async function getRequests(opts: {
    expertId?: string;
    requestedBy?: string;
    ventureId?: string;
    ventureIds?: string[];
    status?: string;
}) {
    const supabase = createServiceRoleClient();
    let query = supabase
        .from('meeting_requests')
        .select(`
            *,
            venture:ventures(id, name, founder_name),
            expert:profiles!meeting_requests_expert_id_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

    if (opts.expertId) query = query.eq('expert_id', opts.expertId);
    if (opts.requestedBy) query = query.eq('requested_by', opts.requestedBy);
    if (opts.ventureId) query = query.eq('venture_id', opts.ventureId);
    if (opts.ventureIds) query = query.in('venture_id', opts.ventureIds);
    if (opts.status) query = query.eq('status', opts.status);

    const { data, error } = await query;
    if (error) {
        console.error('[MeetingRequests] Fetch error:', error);
        throw new Error('Failed to fetch requests');
    }
    return data || [];
}
