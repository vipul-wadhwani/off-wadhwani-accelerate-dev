import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '../../config/supabase';
import { finalizeTranscript, getTranscript } from './transcriptService';

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
    if (!_anthropic) {
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    }
    return _anthropic;
}

/**
 * End a session: finalize transcript, generate summary, update status.
 */
export async function endSession(sessionId: string) {
    const supabase = createServiceRoleClient();

    // Finalize transcript
    await finalizeTranscript(sessionId);

    // Get the full transcript
    const transcript = await getTranscript(sessionId);
    const fullText = transcript?.full_text || '';

    // Get session details
    const { data: session } = await supabase
        .from('mentor_sessions')
        .select('topic, mentor_id, venture_id')
        .eq('id', sessionId)
        .single();

    // Get venture name
    const { data: venture } = await supabase
        .from('ventures')
        .select('name')
        .eq('id', session?.venture_id)
        .maybeSingle();

    // Update session status
    await supabase
        .from('mentor_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', sessionId);

    // Generate AI summary if transcript exists
    if (fullText.length > 50) {
        try {
            const prompt = `Analyze this meeting transcript and generate a structured summary.

Topic: ${session?.topic || 'Expert session'}
Venture: ${venture?.name || 'Unknown'}

Transcript:
${fullText.slice(0, 8000)}

Return a JSON object (no markdown):
{
  "summary_text": "3-5 sentence comprehensive summary of the meeting",
  "key_points": ["3-5 key takeaways from the discussion"],
  "action_items": [{"title": "action item description", "assignee": "who should do it", "status": "pending"}]
}`;

            const anthropic = getAnthropic();
            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            const result = JSON.parse(text);

            // Save summary
            await supabase
                .from('meeting_summaries')
                .insert({
                    session_id: sessionId,
                    summary_text: result.summary_text,
                    key_points: result.key_points || [],
                    action_items: result.action_items || [],
                });

            // Save as final insight
            await supabase
                .from('session_insight_snapshots')
                .insert({
                    session_id: sessionId,
                    summary: result.summary_text,
                    questions: [],
                    transcript_length: fullText.length,
                    is_final: true,
                });

            return { summary: result, transcript: fullText };
        } catch (err) {
            console.error('[Summary] Generation error:', err);
        }
    }

    return { summary: null, transcript: fullText };
}

/**
 * Get the summary for a session.
 */
export async function getSummary(sessionId: string) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
        .from('meeting_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
    return data;
}
