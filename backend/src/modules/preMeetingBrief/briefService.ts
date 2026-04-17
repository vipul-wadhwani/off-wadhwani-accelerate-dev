import Anthropic from '@anthropic-ai/sdk';
import { createServiceRoleClient } from '../../config/supabase';
import { Sentry } from '../../config/sentry';

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

// In-memory brief cache — keyed by sessionId, TTL 5 minutes
const briefCache: Map<string, { data: any; expiresAt: number }> = new Map();
const BRIEF_CACHE_TTL = 5 * 60 * 1000;

// Concurrency guard — prevents duplicate AI generations for the same session
const generationInFlight: Map<string, Promise<any>> = new Map();

/**
 * Get the latest brief for a session. Returns null if none exists.
 * Uses in-memory cache to avoid repeated DB hits during live sessions.
 */
export async function getLatestBrief(sessionId: string) {
    const cached = briefCache.get(sessionId);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    const supabase = createServiceRoleClient();
    const { data } = await supabase
        .from('pre_meeting_briefs')
        .select('*')
        .eq('session_id', sessionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

    briefCache.set(sessionId, { data, expiresAt: Date.now() + BRIEF_CACHE_TTL });
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
 * Get an existing brief or auto-generate one if none exists.
 * Uses concurrency guard to prevent duplicate generations.
 */
export async function getOrGenerateBrief(sessionId: string, generatedBy: string): Promise<any> {
    console.log(`[Brief] getOrGenerateBrief called for session=${sessionId}, user=${generatedBy}`);
    // Bypass cache — query DB directly to avoid stale null entries
    const supabase = createServiceRoleClient();
    const { data: existing, error: fetchErr } = await supabase
        .from('pre_meeting_briefs')
        .select('*')
        .eq('session_id', sessionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
    console.log(`[Brief] DB check: existing=${!!existing}, error=${fetchErr?.message || 'none'}`);
    if (existing) return existing;

    // Check if generation is already in flight for this session
    const inFlight = generationInFlight.get(sessionId);
    if (inFlight) {
        console.log(`[Brief] Generation already in-flight for session=${sessionId}, awaiting...`);
        return inFlight;
    }
    console.log(`[Brief] No brief found, starting generation for session=${sessionId}`);

    // Start generation and store the promise
    const generationPromise = generateBrief(sessionId, generatedBy)
        .finally(() => { generationInFlight.delete(sessionId); });

    generationInFlight.set(sessionId, generationPromise);
    return generationPromise;
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
    const { data: venture, error: ventureErr } = await supabase
        .from('ventures')
        .select('id, name, founder_name, city, location, status')
        .eq('id', session.venture_id)
        .single();
    if (ventureErr) console.error('[Brief] Venture query error:', ventureErr);

    // Get venture application details (full form)
    const { data: application, error: applicationErr } = await supabase
        .from('venture_applications')
        .select('support_request, blockers, revenue_12m, full_time_employees, what_do_you_sell, who_do_you_sell_to, which_regions, focus_product, focus_segment, focus_geography, growth_focus, incremental_hiring')
        .eq('venture_id', session.venture_id)
        .maybeSingle();
    if (applicationErr) console.error('[Brief] Application query error:', applicationErr);

    // Get panel feedback & scorecard
    const { data: panelFeedback } = await supabase
        .from('panel_feedback')
        .select('*')
        .eq('venture_id', session.venture_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    // Get panel gate questions
    const { data: assessment } = await supabase
        .from('venture_assessments')
        .select('gate_questions')
        .eq('venture_id', session.venture_id)
        .not('gate_questions', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
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

    // Get past transcripts (last 5, expanded context)
    let pastTranscripts: any[] = [];
    if (pastSessionIds.length > 0) {
        const { data } = await supabase
            .from('meeting_transcripts')
            .select('session_id, full_text')
            .in('session_id', pastSessionIds.slice(0, 5))
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
        `Location: ${[venture?.city, venture?.location].filter(Boolean).join(', ') || 'N/A'}`,
        `Revenue (12m): ${application?.revenue_12m || 'N/A'}`,
        `Employees: ${application?.full_time_employees || 'N/A'}`,
        `Status: ${venture?.status || 'N/A'}`,
        application?.support_request ? `Support Needed: ${application.support_request}` : '',
        application?.blockers ? `Current Blockers: ${application.blockers}` : '',
        application?.what_do_you_sell ? `What They Sell: ${application.what_do_you_sell}` : '',
        application?.who_do_you_sell_to ? `Target Customers: ${application.who_do_you_sell_to}` : '',
        application?.which_regions ? `Regions: ${application.which_regions}` : '',
        application?.focus_product ? `Focus Product: ${application.focus_product}` : '',
        application?.focus_segment ? `Focus Segment: ${application.focus_segment}` : '',
        application?.focus_geography ? `Focus Geography: ${application.focus_geography}` : '',
        application?.growth_focus ? `Growth Focus: ${Array.isArray(application.growth_focus) ? application.growth_focus.join(', ') : application.growth_focus}` : '',
        application?.incremental_hiring ? `Incremental Hiring: ${application.incremental_hiring}` : '',
    ].filter(Boolean).join('\n');

    // Panel feedback context
    const panelContext = panelFeedback ? [
        `Panel Date: ${panelFeedback.panel_date || 'N/A'}`,
        `Panel Expert: ${panelFeedback.panel_expert_name || 'N/A'}`,
        `SME: ${panelFeedback.sme_name || 'N/A'}`,
        panelFeedback.business_overview ? `Business Overview: ${panelFeedback.business_overview}` : '',
        `Annual Revenue (Actuals): ${panelFeedback.annual_revenue_actuals || 'N/A'}`,
        `Projected Annual Revenue: ${panelFeedback.projected_annual_revenue || 'N/A'}`,
        `Rating — Financial Health: ${panelFeedback.rating_financial_health || 'N/A'}/5`,
        `Rating — Leadership: ${panelFeedback.rating_leadership || 'N/A'}/5`,
        `Rating — Clarity of Expansion: ${panelFeedback.rating_clarity_expansion || 'N/A'}/5`,
        panelFeedback.insights_financial_health ? `Financial Health Insights: ${panelFeedback.insights_financial_health}` : '',
        panelFeedback.insights_leadership ? `Leadership Insights: ${panelFeedback.insights_leadership}` : '',
        panelFeedback.proposed_expansion_idea ? `Proposed Expansion: ${panelFeedback.proposed_expansion_idea}` : '',
        panelFeedback.expansion_idea_description ? `Expansion Details: ${panelFeedback.expansion_idea_description}` : '',
        panelFeedback.market_entry_routes ? `Market Entry Routes: ${panelFeedback.market_entry_routes}` : '',
        panelFeedback.current_progress ? `Current Progress: ${panelFeedback.current_progress}` : '',
        panelFeedback.risks_red_flags ? `Risks & Red Flags: ${panelFeedback.risks_red_flags}` : '',
        panelFeedback.final_recommendation ? `Final Recommendation: ${panelFeedback.final_recommendation}` : '',
        panelFeedback.program_category ? `Program Category: ${panelFeedback.program_category}` : '',
        panelFeedback.support_type_proposal ? `Support Type: ${panelFeedback.support_type_proposal}` : '',
        // Stream statuses
        panelFeedback.stream_gtm ? `Stream GTM: ${panelFeedback.stream_gtm}${panelFeedback.stream_gtm_comments ? ' — ' + panelFeedback.stream_gtm_comments : ''}` : '',
        panelFeedback.stream_product_quality ? `Stream Product/Quality: ${panelFeedback.stream_product_quality}${panelFeedback.stream_product_quality_comments ? ' — ' + panelFeedback.stream_product_quality_comments : ''}` : '',
        panelFeedback.stream_operations ? `Stream Operations: ${panelFeedback.stream_operations}${panelFeedback.stream_operations_comments ? ' — ' + panelFeedback.stream_operations_comments : ''}` : '',
        panelFeedback.stream_supply_chain ? `Stream Supply Chain: ${panelFeedback.stream_supply_chain}${panelFeedback.stream_supply_chain_comments ? ' — ' + panelFeedback.stream_supply_chain_comments : ''}` : '',
        panelFeedback.stream_org_design ? `Stream Org Design: ${panelFeedback.stream_org_design}${panelFeedback.stream_org_design_comments ? ' — ' + panelFeedback.stream_org_design_comments : ''}` : '',
        panelFeedback.stream_finance ? `Stream Finance: ${panelFeedback.stream_finance}${panelFeedback.stream_finance_comments ? ' — ' + panelFeedback.stream_finance_comments : ''}` : '',
    ].filter(Boolean).join('\n') : '';

    // Gate questions context
    const gateQuestionsArr = assessment?.gate_questions?.gate_questions;
    const gateQuestionsContext = Array.isArray(gateQuestionsArr) && gateQuestionsArr.length > 0
        ? gateQuestionsArr.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')
        : '';

    const pastContext = pastSessions && pastSessions.length > 0
        ? pastSessions.map(s => {
            const summary = pastSummaries.find(sm => sm.session_id === s.id);
            return `- ${s.scheduled_date}: ${s.topic || 'Session'} (${s.status})${summary ? `\n  Summary: ${summary.summary_text?.slice(0, 200)}` : ''}`;
        }).join('\n')
        : 'No previous sessions.';

    // Extract outstanding action items from past summaries
    const outstandingActions: string[] = [];
    for (const summary of pastSummaries) {
        if (Array.isArray(summary.action_items)) {
            for (const item of summary.action_items) {
                const title = typeof item === 'string' ? item : item?.title || item?.description;
                if (title) outstandingActions.push(title);
            }
        }
    }

    const transcriptContext = pastTranscripts.length > 0
        ? pastTranscripts.map(t => {
            const matchingSession = pastSessions?.find(s => s.id === t.session_id);
            const dateLabel = matchingSession?.scheduled_date || 'Unknown date';
            return `[Session ${dateLabel}]\n${t.full_text?.slice(0, 1500)}`;
        }).join('\n---\n')
        : '';

    const prompt = `You are preparing a pre-meeting brief for a venture partner who is about to meet with an entrepreneur. Generate a structured brief using ALL the context provided below.

## Venture Profile
${ventureContext}

## Upcoming Session
Topic: ${session.topic || 'General discussion'}
Date: ${session.scheduled_date}

${panelContext ? `## Panel Feedback & Scorecard\n${panelContext}` : ''}

${gateQuestionsContext ? `## Panel Gate Questions\n${gateQuestionsContext}` : ''}

## Past Sessions (${pastSessions?.length || 0} total)
${pastContext}

${outstandingActions.length > 0 ? `## Outstanding Action Items from Previous Sessions\n${outstandingActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''}

${transcriptContext ? `## Recent Transcript Excerpts\n${transcriptContext}` : ''}

Generate a JSON object (no markdown, no explanation) with these fields:
{
  "summary": "2-3 paragraph overview of the venture, their progress, and current situation. Incorporate insights from the application form, panel feedback, and any past interactions.",
  "red_flags": ["list of concerns, inconsistencies, or risks to watch for — from panel feedback, scorecard ratings, past transcripts, and any gaps in information"],
  "focus_areas": ["3-5 specific topics to cover in this meeting based on panel gate questions, feedback, and their needs"],
  "key_questions": ["5 sharp, specific questions informed by panel feedback, gate questions, and past discussion context"],
  "action_items": ["outstanding action items from previous sessions that should be followed up on"],
  "progress_summary": "1-2 sentence trajectory summary — are they improving, stagnating, or declining? Reference panel scores and past session trends."
}`;

    try {
        const anthropic = getAnthropic();
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
        });

        const rawText = response.content[0].type === 'text' ? response.content[0].text : '';
        // Strip ```json ... ``` fences if the model added them despite instructions
        const text = rawText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
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

        briefCache.delete(sessionId);
        return savedBrief;
    } catch (err: any) {
        console.error('[Brief] Generation error:', err);
        Sentry.captureException(err, {
            tags: { service: 'pre_meeting_brief' },
            extra: {
                session_id: sessionId,
                venture_id: session.venture_id,
                anthropic_status: err?.status,
                anthropic_code: err?.code,
                message: err?.message,
            },
        });
        // Return a transient fallback — DO NOT persist, so the next click retries generation
        const fallbackContent: BriefContent = {
            summary: `Meeting with ${venture?.name || 'venture'}. ${application?.what_do_you_sell || 'No product details available.'}`,
            red_flags: [],
            focus_areas: [session.topic || 'General discussion'],
            key_questions: ['What progress has been made since the last session?', 'What are the current blockers?'],
            action_items: [],
            progress_summary: 'Unable to generate AI brief — showing basic venture information.',
        };

        return {
            id: null,
            session_id: sessionId,
            venture_id: session.venture_id,
            generated_by: generatedBy,
            brief_content: fallbackContent,
            version: null,
            created_at: new Date().toISOString(),
            is_fallback: true,
        };
    }
}
