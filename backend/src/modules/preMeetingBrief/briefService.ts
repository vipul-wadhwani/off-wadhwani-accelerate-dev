import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '../../config/supabase';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
    if (!_anthropic) {
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    }
    return _anthropic;
}

export interface BriefContent {
    summary: string;
    red_flags: string[];
    focus_areas: string[];
    key_questions: string[];
    action_items: string[];
    progress_summary: string;
}

/**
 * Get the latest brief for a session. Returns null if none exists.
 */
export async function getLatestBrief(sessionId: string) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
        .from('pre_meeting_briefs')
        .select('*')
        .eq('session_id', sessionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data;
}

/**
 * Get brief history for a session.
 */
export async function getBriefHistory(sessionId: string) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
        .from('pre_meeting_briefs')
        .select('id, version, created_at, brief_content')
        .eq('session_id', sessionId)
        .order('version', { ascending: false });
    return data || [];
}

/**
 * Generate a pre-meeting brief using Claude.
 * Pulls venture profile, past sessions, transcripts, and action items.
 * Never overwrites — creates a new version.
 */
export async function generateBrief(sessionId: string, generatedBy: string): Promise<any> {
    const supabase = createServiceRoleClient();

    // Get the session details
    const { data: session } = await supabase
        .from('mentor_sessions')
        .select('id, venture_id, mentor_id, topic, scheduled_date')
        .eq('id', sessionId)
        .single();

    if (!session) throw new Error('Session not found');

    // Get venture profile
    const { data: venture } = await supabase
        .from('ventures')
        .select('id, name, founder_name, city, state, revenue_12m, full_time_employees, growth_focus, status')
        .eq('id', session.venture_id)
        .single();

    // Get venture application details
    const { data: application } = await supabase
        .from('venture_applications')
        .select('product_description, problem_statement, support_request, blockers, revenue_12m, full_time_employees')
        .eq('venture_id', session.venture_id)
        .maybeSingle();

    // Get past sessions with this venture
    const { data: pastSessions } = await supabase
        .from('mentor_sessions')
        .select('id, topic, scheduled_date, status')
        .eq('venture_id', session.venture_id)
        .neq('id', sessionId)
        .in('status', ['ended', 'scheduled'])
        .order('scheduled_date', { ascending: false })
        .limit(10);

    // Get past summaries
    const pastSessionIds = (pastSessions || []).map(s => s.id);
    let pastSummaries: any[] = [];
    if (pastSessionIds.length > 0) {
        const { data } = await supabase
            .from('meeting_summaries')
            .select('session_id, summary_text, action_items')
            .in('session_id', pastSessionIds);
        pastSummaries = data || [];
    }

    // Get past transcripts (last 3)
    let pastTranscripts: any[] = [];
    if (pastSessionIds.length > 0) {
        const { data } = await supabase
            .from('meeting_transcripts')
            .select('session_id, full_text')
            .in('session_id', pastSessionIds.slice(0, 3))
            .not('full_text', 'is', null);
        pastTranscripts = data || [];
    }

    // Get current version number
    const { data: existingBriefs } = await supabase
        .from('pre_meeting_briefs')
        .select('version')
        .eq('session_id', sessionId)
        .order('version', { ascending: false })
        .limit(1);

    const nextVersion = (existingBriefs?.[0]?.version || 0) + 1;

    // Build context for Claude
    const ventureContext = [
        `Company: ${venture?.name || 'Unknown'}`,
        `Founder: ${venture?.founder_name || 'N/A'}`,
        `Location: ${[venture?.city, venture?.state].filter(Boolean).join(', ') || 'N/A'}`,
        `Revenue: ${application?.revenue_12m || venture?.revenue_12m || 'N/A'}`,
        `Employees: ${application?.full_time_employees || venture?.full_time_employees || 'N/A'}`,
        `Status: ${venture?.status || 'N/A'}`,
        application?.product_description ? `Product: ${application.product_description}` : '',
        application?.problem_statement ? `Problem Statement: ${application.problem_statement}` : '',
        application?.support_request ? `Support Needed: ${application.support_request}` : '',
        application?.blockers ? `Current Blockers: ${application.blockers}` : '',
    ].filter(Boolean).join('\n');

    const pastContext = pastSessions && pastSessions.length > 0
        ? pastSessions.map(s => {
            const summary = pastSummaries.find(sm => sm.session_id === s.id);
            return `- ${s.scheduled_date}: ${s.topic || 'Session'} (${s.status})${summary ? `\n  Summary: ${summary.summary_text?.slice(0, 200)}` : ''}`;
        }).join('\n')
        : 'No previous sessions.';

    const transcriptContext = pastTranscripts.length > 0
        ? pastTranscripts.map(t => t.full_text?.slice(0, 500)).join('\n---\n')
        : '';

    const prompt = `You are preparing a pre-meeting brief for a venture partner who is about to meet with an entrepreneur. Generate a structured brief.

## Venture Profile
${ventureContext}

## Upcoming Session
Topic: ${session.topic || 'General discussion'}
Date: ${session.scheduled_date}

## Past Sessions (${pastSessions?.length || 0} total)
${pastContext}

${transcriptContext ? `## Recent Transcript Excerpts\n${transcriptContext}` : ''}

Generate a JSON object (no markdown, no explanation) with these fields:
{
  "summary": "2-3 paragraph overview of the venture, their progress, and current situation",
  "red_flags": ["list of concerns, inconsistencies, or risks to watch for — e.g. repeated no-shows, stagnant metrics, conflicting statements"],
  "focus_areas": ["3-5 specific topics to cover in this meeting based on their needs and history"],
  "key_questions": ["5 sharp, specific questions to ask during the meeting"],
  "action_items": ["outstanding action items from previous sessions that should be followed up on"],
  "progress_summary": "1-2 sentence trajectory summary — are they improving, stagnating, or declining?"
}`;

    try {
        const anthropic = getAnthropic();
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const briefContent = JSON.parse(text) as BriefContent;

        // Save to DB (new version, never overwrites)
        const { data: savedBrief, error } = await supabase
            .from('pre_meeting_briefs')
            .insert({
                session_id: sessionId,
                venture_id: session.venture_id,
                generated_by: generatedBy,
                brief_content: briefContent,
                version: nextVersion,
            })
            .select()
            .single();

        if (error) {
            console.error('[Brief] Save error:', error);
            throw new Error('Failed to save brief');
        }

        return savedBrief;
    } catch (err: any) {
        console.error('[Brief] Generation error:', err);
        // Return a fallback brief
        const fallbackContent: BriefContent = {
            summary: `Meeting with ${venture?.name || 'venture'}. ${application?.product_description || 'No product details available.'}`,
            red_flags: [],
            focus_areas: [session.topic || 'General discussion'],
            key_questions: ['What progress has been made since the last session?', 'What are the current blockers?'],
            action_items: [],
            progress_summary: 'Unable to generate AI brief — showing basic venture information.',
        };

        const { data: savedBrief } = await supabase
            .from('pre_meeting_briefs')
            .insert({
                session_id: sessionId,
                venture_id: session.venture_id,
                generated_by: generatedBy,
                brief_content: fallbackContent,
                version: nextVersion,
            })
            .select()
            .single();

        return savedBrief;
    }
}
