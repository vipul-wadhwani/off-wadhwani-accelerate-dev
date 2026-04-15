import { createServiceRoleClient } from '../../config/supabase';

export interface TranscriptChunk {
    speaker: string;
    text: string;
    time: string;
}

/**
 * Append transcript chunks to a session's transcript.
 * Deduplicates by matching speaker + text to avoid storing repeated lines.
 */
export async function appendTranscript(sessionId: string, chunks: TranscriptChunk[]) {
    const supabase = createServiceRoleClient();

    // Check if transcript exists
    const { data: existing } = await supabase
        .from('meeting_transcripts')
        .select('id, chunks')
        .eq('session_id', sessionId)
        .maybeSingle();

    if (existing) {
        const existingChunks: TranscriptChunk[] = existing.chunks || [];

        // Build a set of existing speaker+text combos for fast lookup
        const existingKeys = new Set(
            existingChunks.map((c: TranscriptChunk) => `${c.speaker}|||${c.text}`)
        );

        // Only add chunks that don't already exist
        const newChunks = chunks.filter(
            (c) => !existingKeys.has(`${c.speaker}|||${c.text}`)
        );

        if (newChunks.length > 0) {
            const updatedChunks = [...existingChunks, ...newChunks];
            await supabase
                .from('meeting_transcripts')
                .update({ chunks: updatedChunks, updated_at: new Date().toISOString() })
                .eq('id', existing.id);
        }
    } else {
        await supabase
            .from('meeting_transcripts')
            .insert({ session_id: sessionId, chunks });
    }
}

/**
 * Get transcript for a session.
 */
export async function getTranscript(sessionId: string) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();
    return data;
}

/**
 * Finalize transcript — concatenate chunks into full_text.
 */
export async function finalizeTranscript(sessionId: string) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
        .from('meeting_transcripts')
        .select('id, chunks')
        .eq('session_id', sessionId)
        .maybeSingle();

    if (!data) return;

    const fullText = (data.chunks || [])
        .map((c: TranscriptChunk) => `${c.speaker}: ${c.text}`)
        .join('\n');

    await supabase
        .from('meeting_transcripts')
        .update({ full_text: fullText, updated_at: new Date().toISOString() })
        .eq('id', data.id);
}
