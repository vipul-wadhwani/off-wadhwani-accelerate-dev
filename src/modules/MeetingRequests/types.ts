export interface MeetingRequest {
    id: string;
    venture_id: string;
    expert_id: string;
    requested_by: string;
    requested_by_role: string;
    meeting_goal: string | null;
    problem_statement: string | null;
    company_info: {
        name?: string;
        founder?: string;
        location?: string;
        revenue?: string;
        employees?: string;
        program?: string;
        product?: string;
    } | null;
    preferred_date: string | null;
    preferred_time: string | null;
    preferred_duration: number;
    status: 'pending' | 'accepted' | 'declined' | 'scheduled' | 'completed' | 'cancelled';
    expert_response_note: string | null;
    responded_at: string | null;
    session_id: string | null;
    created_at: string;
    updated_at: string;
    // Joined data
    venture?: { id: string; name: string; founder_name: string };
    expert?: { id: string; full_name: string; email: string };
}
