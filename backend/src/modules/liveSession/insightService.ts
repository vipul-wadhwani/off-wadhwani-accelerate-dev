import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '../../config/supabase';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
    if (!_anthropic) {
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    }
    return _anthropic;
}

/**
 * Generate an AI insight snapshot from recent transcript.
 */
export async function generateInsightSnapshot(sessionId: string, recentTranscript: string, topic?: string) {
    const prompt = `You are analyzing a live meeting transcript. Generate a brief insight snapshot.

Topic: ${topic || 'Expert session'}

Recent transcript:
${recentTranscript.slice(0, 3000)}

Return a JSON object (no markdown):
{
  "summary": "2-3 sentence summary of what was just discussed",
  "questions": ["3-5 follow-up questions the VP/expert should ask based on the discussion"]
}`;

    try {
        const anthropic = getAnthropic();
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const insight = JSON.parse(text);

        // Save snapshot
        const supabase = createServiceRoleClient();
        const { data, error } = await supabase
            .from('session_insight_snapshots')
            .insert({
                session_id: sessionId,
                summary: insight.summary,
                questions: insight.questions || [],
                transcript_length: recentTranscript.length,
                is_final: false,
            })
            .select()
            .single();

        if (error) console.error('[Insights] Save error:', error);
        return data;
    } catch (err) {
        console.error('[Insights] Generation error:', err);
        return null;
    }
}

/**
 * Get all insight snapshots for a session.
 */
export async function getInsights(sessionId: string) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
        .from('session_insight_snapshots')
        .select('*')
        .eq('session_id', sessionId)
        .order('snapshot_time', { ascending: true });
    return data || [];
}

/**
 * Get all insight snapshots across ALL sessions for a venture.
 */
export async function getVentureInsights(ventureId: string) {
    const supabase = createServiceRoleClient();

    const { data: sessions } = await supabase
        .from('mentor_sessions')
        .select('id')
        .eq('venture_id', ventureId);

    if (!sessions || sessions.length === 0) return [];

    const sessionIds = sessions.map(s => s.id);

    const { data } = await supabase
        .from('session_insight_snapshots')
        .select('*')
        .in('session_id', sessionIds)
        .order('snapshot_time', { ascending: true });

    return data || [];
}
