/**
 * Test Framework API Routes
 *
 * Isolated module — no writes to DB, no changes to existing service files.
 * Uses in-memory TTL cache for all read operations.
 *
 * Endpoints:
 *   GET  /test-framework/ventures               — list all ventures for the dropdown
 *   GET  /test-framework/context/:id/:feature   — input context + rendered prompt + model config
 *   POST /test-framework/run                    — run AI with a (possibly tweaked) prompt
 */

import { Router, Request, Response, NextFunction } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createAuthenticatedClient } from '../../config/supabase';
import { authenticateUser } from '../../middleware/auth';
import { cache, TTL } from './cache';
import {
    buildScreeningPrompt,
    buildPanelPrompt,
    buildRoadmapPrompt,
    FEATURE_MODEL_CONFIG,
    VentureInputData,
    RoadmapContext,
} from './prompts';

const router = Router();

// ── Anthropic client (lazy-init after env is loaded) ──────────────────────────
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
    if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    return _anthropic;
}

// ── Auth: all endpoints require a logged-in user ──────────────────────────────
router.use(authenticateUser);

// ─────────────────────────────────────────────────────────────────────────────
// GET /test-framework/ventures
// Lists all non-deleted ventures for the venture selector dropdown.
// Cached 5 min.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ventures', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const CACHE_KEY = 'tf:ventures';
        const cached = cache.get<any[]>(CACHE_KEY);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const token = (req.headers.authorization ?? '').replace('Bearer ', '');
        const supabase = createAuthenticatedClient(token);
        const { data, error } = await supabase
            .from('ventures')
            .select('id, name, founder_name, status, program_name, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(300);

        if (error) throw error;

        cache.set(CACHE_KEY, data, TTL.VENTURES_LIST);
        return res.json({ success: true, data, cached: false });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /test-framework/context/:ventureId/:feature
// Returns inputContext (structured sections), rendered prompt, and modelConfig.
// feature = 'screening' | 'panel' | 'roadmap'
// Cached per (ventureId, feature) for 5 min.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/context/:ventureId/:feature', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { ventureId, feature } = req.params;

        if (!['screening', 'panel', 'roadmap'].includes(feature)) {
            return res.status(400).json({ success: false, message: `Unknown feature: ${feature}` });
        }

        const CACHE_KEY = `tf:ctx:${ventureId}:${feature}`;
        const cached = cache.get<any>(CACHE_KEY);
        if (cached) return res.json({ success: true, data: cached, cached: true });

        const token = (req.headers.authorization ?? '').replace('Bearer ', '');
        const supabase = createAuthenticatedClient(token);

        // ── Fetch venture + application + assessments + streams (read-only) ──
        // Use select('*') for ventures to avoid column-not-found errors — the DB
        // schema may differ from what we expect.
        const { data: venture, error: vErr } = await supabase
            .from('ventures')
            .select('*, application:venture_applications (*), assessments:venture_assessments (*), streams:venture_streams(*)')
            .eq('id', ventureId)
            .single();

        if (vErr || !venture) {
            console.error('Venture fetch error:', vErr);
            return res.status(404).json({ success: false, message: 'Venture not found' });
        }

        // ── Fetch panel_feedback (separate table) ─────────────────────────────
        const { data: pfRows } = await supabase
            .from('panel_feedback')
            .select('*')
            .eq('venture_id', ventureId)
            .order('created_at', { ascending: false })
            .limit(1);

        // application comes back as array (one-to-many) or object depending on Supabase config
        const app: any = (Array.isArray(venture.application) ? venture.application[0] : venture.application) || {};

        // venture_streams: applicant self-assessed support areas (stream_name + status)
        const ventureStreams: any[] = venture.streams || [];

        // ── Merge venture + application fields ────────────────────────────────
        const ventureData: VentureInputData = {
            id: venture.id,
            name: venture.name,
            founder_name: venture.founder_name,
            city: venture.city,
            state: venture.location,
            business_type: app.business_type,
            designation: app.designation,
            revenue_12m: app.revenue_12m,
            revenue_potential_3y: app.revenue_potential_3y,
            full_time_employees: app.full_time_employees,
            growth_focus: app.growth_focus,
            growth_dimensions_selected: app.growth_dimensions_selected,
            growth_current: app.growth_current,
            growth_target: app.growth_target,
            target_jobs: app.target_jobs,
            financial_condition: app.financial_condition,
            time_commitment: app.time_commitment,
            second_line_team: app.second_line_team,
            incremental_hiring: app.incremental_hiring,
            min_investment: app.min_investment,
            what_do_you_sell: app.what_do_you_sell,
            who_do_you_sell_to: app.who_do_you_sell_to,
            which_regions: app.which_regions,
            focus_product: app.focus_product,
            focus_segment: app.focus_segment,
            focus_geography: app.focus_geography,
            support_request: app.support_request,
            support_description: app.support_description,
            blockers: app.blockers,
            vsm_notes: venture.vsm_notes,
            corporate_presentation_text: undefined, // PDF extraction not done in test framework
            program_type: venture.program_name,
            workstream_statuses: ventureStreams,
        };

        // vsmNotes: screening/panel use venture.vsm_notes (same as production ventures.ts:1057)
        // roadmap uses screeningAssessment.notes (same as production ventures.ts:696)
        const vsmNotesFromVenture: string = venture.vsm_notes || '';
        const assessments: any[] = venture.assessments || [];

        // Current screening AI analysis
        const screeningAssessment = assessments.find(
            (a) => a.is_current && a.assessment_type === 'screening'
        ) || assessments[0] || null;
        const aiAnalysis = screeningAssessment?.ai_analysis || null;
        const screeningScorecard = aiAnalysis?.scorecard || null;

        // For screening/panel: use venture.vsm_notes
        // For roadmap: use assessment.notes (contains structured VSM review notes)
        const vsmNotes = vsmNotesFromVenture;

        let inputContext: any = {};
        let prompt = '';

        // ── SCREENING ─────────────────────────────────────────────────────────
        if (feature === 'screening') {
            inputContext = {
                venture_profile: {
                    id: ventureData.id,
                    name: ventureData.name,
                    founder_name: ventureData.founder_name,
                    city: ventureData.city,
                    state: ventureData.state,
                    business_type: ventureData.business_type,
                    designation: ventureData.designation,
                    status: venture.status,
                },
                financials: {
                    revenue_12m: ventureData.revenue_12m,
                    revenue_potential_3y: ventureData.revenue_potential_3y,
                    financial_condition: ventureData.financial_condition,
                    min_investment: ventureData.min_investment,
                    incremental_hiring: ventureData.incremental_hiring,
                },
                team: {
                    full_time_employees: ventureData.full_time_employees,
                    time_commitment: ventureData.time_commitment,
                    second_line_team: ventureData.second_line_team,
                    target_jobs: ventureData.target_jobs,
                },
                growth_idea: {
                    growth_focus: ventureData.growth_focus,
                    growth_dimensions_selected: ventureData.growth_dimensions_selected,
                    focus_product: ventureData.focus_product,
                    focus_segment: ventureData.focus_segment,
                    focus_geography: ventureData.focus_geography,
                    support_request: ventureData.support_request,
                    support_description: ventureData.support_description,
                    growth_idea_support_status: ventureStreams.map((s: any) => ({
                        stream: s.stream_name,
                        status: s.status,
                    })),
                },
                current_business: {
                    what_do_you_sell: ventureData.what_do_you_sell,
                    who_do_you_sell_to: ventureData.who_do_you_sell_to,
                    which_regions: ventureData.which_regions,
                    growth_current: ventureData.growth_current,
                    growth_target: ventureData.growth_target,
                },
                vsm_notes: vsmNotes || null,
                corporate_presentation: {
                    available: !!ventureData.corporate_presentation_text,
                    character_count: ventureData.corporate_presentation_text?.length || 0,
                },
            };
            prompt = buildScreeningPrompt(ventureData, vsmNotes);
        }

        // ── PANEL ─────────────────────────────────────────────────────────────
        if (feature === 'panel') {
            const { data: interactions } = await supabase
                .from('venture_interactions')
                .select('interaction_type, interaction_date, title, transcript, summary, notes')
                .eq('venture_id', ventureId)
                .order('interaction_date', { ascending: true })
                .limit(20);

            const interactionTranscripts = (interactions || [])
                .map((i: any) =>
                    `[${i.interaction_type || 'Note'}] ${(i.interaction_date || '').slice(0, 10)} — ${i.title || ''}: ${i.transcript || i.summary || i.notes || '(no content)'}`
                )
                .join('\n\n');

            ventureData.screening_recommendation = venture.status;
            ventureData.prior_ai_analysis = aiAnalysis;

            inputContext = {
                venture_profile: {
                    name: ventureData.name,
                    founder_name: ventureData.founder_name,
                    revenue_12m: ventureData.revenue_12m,
                    revenue_potential_3y: ventureData.revenue_potential_3y,
                    full_time_employees: ventureData.full_time_employees,
                    financial_condition: ventureData.financial_condition,
                    time_commitment: ventureData.time_commitment,
                    second_line_team: ventureData.second_line_team,
                    target_jobs: ventureData.target_jobs,
                    screening_recommendation: venture.status,
                },
                current_business: {
                    what_do_you_sell: ventureData.what_do_you_sell,
                    who_do_you_sell_to: ventureData.who_do_you_sell_to,
                    which_regions: ventureData.which_regions,
                },
                growth_idea: {
                    growth_focus: ventureData.growth_focus,
                    focus_product: ventureData.focus_product,
                    focus_segment: ventureData.focus_segment,
                    focus_geography: ventureData.focus_geography,
                },
                screening_scorecard: screeningScorecard,
                vsm_notes: vsmNotes || null,
                interaction_transcripts: interactionTranscripts || null,
            };

            prompt = buildPanelPrompt(
                ventureData,
                vsmNotes,
                '',
                screeningScorecard,
                interactionTranscripts
            );
        }

        // ── ROADMAP ───────────────────────────────────────────────────────────
        if (feature === 'roadmap') {
            const { data: interactions } = await supabase
                .from('venture_interactions')
                .select('interaction_type, interaction_date, title, transcript, summary, notes')
                .eq('venture_id', ventureId)
                .order('interaction_date', { ascending: true })
                .limit(20);

            const interactionNotes = (interactions || [])
                .map((i: any) =>
                    `[${i.interaction_type || 'Note'}] ${(i.interaction_date || '').slice(0, 10)} — ${i.title || ''}: ${i.transcript || i.summary || i.notes || '(no content)'}`
                )
                .join('\n\n');

            // Production uses find(is_current) — no type filter — panel_ai_analysis is
            // stored on whatever the current assessment is (ventures.ts:651, 1580)
            const currentAssessment = assessments.find((a) => a.is_current) || assessments[0] || null;
            const panelFeedback = pfRows?.[0] || null;
            const panelScorecard = currentAssessment?.panel_ai_analysis?.panel_scorecard || null;
            const gateQuestions = currentAssessment?.gate_questions || screeningAssessment?.gate_questions || null;

            // Roadmap uses assessment.notes as vsmNotes source (matches production ventures.ts:696)
            const roadmapVsmNotes = currentAssessment?.notes || vsmNotesFromVenture;

            const roadmapAiAnalysis = currentAssessment?.ai_analysis || aiAnalysis;

            const roadmapCtx: RoadmapContext = {
                vsmNotes: roadmapVsmNotes,
                aiAnalysis: roadmapAiAnalysis,
                interactionNotes,
                panelFeedback,
                panelScorecard,
                gateQuestions,
            };

            inputContext = {
                venture_profile: {
                    name: ventureData.name,
                    founder_name: ventureData.founder_name,
                    revenue_12m: ventureData.revenue_12m,
                    revenue_potential_3y: ventureData.revenue_potential_3y,
                    full_time_employees: ventureData.full_time_employees,
                    growth_focus: ventureData.growth_focus,
                    blockers: ventureData.blockers,
                    support_request: ventureData.support_request,
                    incremental_hiring: ventureData.incremental_hiring,
                },
                current_business: {
                    what_do_you_sell: ventureData.what_do_you_sell,
                    who_do_you_sell_to: ventureData.who_do_you_sell_to,
                    which_regions: ventureData.which_regions,
                    focus_product: ventureData.focus_product,
                    focus_segment: ventureData.focus_segment,
                    focus_geography: ventureData.focus_geography,
                },
                vsm_notes: roadmapVsmNotes || null,
                screening_ai_analysis: roadmapAiAnalysis,
                panel_feedback: panelFeedback,
                panel_scorecard: panelScorecard,
                gate_questions: gateQuestions,
                interaction_notes: interactionNotes || null,
            };

            prompt = buildRoadmapPrompt(ventureData, roadmapCtx);
        }

        const result = {
            inputContext,
            prompt,
            modelConfig: FEATURE_MODEL_CONFIG[feature],
        };

        cache.set(CACHE_KEY, result, TTL.VENTURE_CONTEXT);
        return res.json({ success: true, data: result, cached: false });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /test-framework/run
// Accepts { feature, customPrompt } — runs against Claude and returns result.
// Returns: { rawText, parsed, feature, durationMs }
// No caching — always a live AI call.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { feature, customPrompt } = req.body as { feature: string; customPrompt: string };

        if (!feature || !customPrompt?.trim()) {
            return res.status(400).json({ success: false, message: 'feature and customPrompt are required' });
        }
        if (!['screening', 'panel', 'roadmap'].includes(feature)) {
            return res.status(400).json({ success: false, message: `Unknown feature: ${feature}` });
        }
        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(500).json({ success: false, message: 'ANTHROPIC_API_KEY not configured on server' });
        }

        const anthropic = getAnthropic();
        const t0 = Date.now();
        let rawText = '';
        let parsed: any = null;

        if (feature === 'screening') {
            const msg = await anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 2500,
                temperature: 0.7,
                tools: [{ type: 'web_search_20260209', name: 'web_search' } as any],
                messages: [{ role: 'user', content: customPrompt }],
            });
            rawText = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
            parsed = parseScorecardJson(rawText);
        }

        if (feature === 'panel') {
            const msg = await anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 2500,
                temperature: 0.3,
                tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 } as any],
                messages: [{ role: 'user', content: customPrompt }],
            });
            rawText = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
            parsed = parsePanelJson(rawText);
        }

        if (feature === 'roadmap') {
            const msg = await anthropic.messages.create({
                model: 'claude-sonnet-4-5-20250929',
                max_tokens: 8000,
                temperature: 0,
                messages: [{ role: 'user', content: customPrompt }],
            });
            rawText = msg.content[0]?.type === 'text' ? (msg.content[0] as any).text : '';
            parsed = parseRoadmapJson(rawText);
        }

        return res.json({
            success: true,
            data: { rawText, parsed, feature, durationMs: Date.now() - t0 },
        });
    } catch (err: any) {
        if (err.status === 401) return res.status(401).json({ success: false, message: 'Invalid Anthropic API key' });
        if (err.status === 429) return res.status(429).json({ success: false, message: 'Claude rate limit exceeded — try again shortly' });
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /test-framework/rebuild-prompt
// Accepts { feature, editedContext } — maps edited inputContext JSON back to
// VentureInputData and rebuilds the prompt without touching the DB.
// Returns: { prompt }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/rebuild-prompt', (req: Request, res: Response, next: NextFunction) => {
    try {
        const { feature, editedContext } = req.body as { feature: string; editedContext: Record<string, any> };

        if (!feature || !editedContext) {
            return res.status(400).json({ success: false, message: 'feature and editedContext are required' });
        }
        if (!['screening', 'panel', 'roadmap'].includes(feature)) {
            return res.status(400).json({ success: false, message: `Unknown feature: ${feature}` });
        }

        const vp  = editedContext.venture_profile  || {};
        const fin = editedContext.financials        || {};
        const team = editedContext.team             || {};
        const gi  = editedContext.growth_idea       || {};
        const cb  = editedContext.current_business  || {};

        // Map nested inputContext sections back to flat VentureInputData
        const ventureData: VentureInputData = {
            id:                      vp.id,
            name:                    vp.name               || '',
            founder_name:            vp.founder_name,
            city:                    vp.city,
            state:                   vp.state,
            business_type:           vp.business_type,
            designation:             vp.designation,
            revenue_12m:             fin.revenue_12m,
            revenue_potential_3y:    fin.revenue_potential_3y,
            financial_condition:     fin.financial_condition,
            min_investment:          fin.min_investment,
            incremental_hiring:      fin.incremental_hiring,
            full_time_employees:     team.full_time_employees,
            time_commitment:         team.time_commitment,
            second_line_team:        team.second_line_team,
            target_jobs:             team.target_jobs,
            growth_focus:            gi.growth_focus        ?? vp.growth_focus,
            growth_dimensions_selected: gi.growth_dimensions_selected,
            focus_product:           gi.focus_product,
            focus_segment:           gi.focus_segment,
            focus_geography:         gi.focus_geography,
            support_request:         gi.support_request,
            support_description:     gi.support_description,
            blockers:                gi.blockers            ?? vp.blockers,
            workstream_statuses:     (gi.growth_idea_support_status || []).map((s: any) => ({
                stream_name: s.stream ?? s.stream_name,
                status: s.status,
            })),
            what_do_you_sell:        cb.what_do_you_sell,
            who_do_you_sell_to:      cb.who_do_you_sell_to,
            which_regions:           cb.which_regions,
            growth_current:          cb.growth_current,
            growth_target:           cb.growth_target,
            // Panel/roadmap extras
            screening_recommendation: vp.screening_recommendation,
            prior_ai_analysis:       editedContext.screening_scorecard ?? undefined,
        };

        const vsmNotes: string = editedContext.vsm_notes || '';

        let prompt = '';

        if (feature === 'screening') {
            prompt = buildScreeningPrompt(ventureData, vsmNotes);
        }

        if (feature === 'panel') {
            const screeningScorecard = editedContext.screening_scorecard ?? null;
            const interactionTranscripts = editedContext.interaction_transcripts ?? '';
            prompt = buildPanelPrompt(ventureData, vsmNotes, '', screeningScorecard, interactionTranscripts);
        }

        if (feature === 'roadmap') {
            const roadmapCtx: RoadmapContext = {
                vsmNotes: editedContext.vsm_notes || '',
                aiAnalysis: editedContext.screening_ai_analysis ?? null,
                interactionNotes: editedContext.interaction_notes ?? '',
                panelFeedback: editedContext.panel_feedback ?? null,
                panelScorecard: editedContext.panel_scorecard ?? null,
                gateQuestions: editedContext.gate_questions ?? null,
            };
            // Roadmap-specific fields live in venture_profile for this feature
            ventureData.blockers = vp.blockers;
            ventureData.support_request = vp.support_request;
            ventureData.incremental_hiring = vp.incremental_hiring;
            ventureData.growth_focus = vp.growth_focus;
            ventureData.focus_product = cb.focus_product;
            ventureData.focus_segment = cb.focus_segment;
            ventureData.focus_geography = cb.focus_geography;
            prompt = buildRoadmapPrompt(ventureData, roadmapCtx);
        }

        return res.json({ success: true, data: { prompt } });
    } catch (err) {
        next(err);
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Local JSON parsers — no dependency on aiService.ts
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(text: string): any {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object found in response');
    return JSON.parse(match[0]);
}

function parseScorecardJson(text: string): any {
    try {
        const parsed = extractJson(text);
        if (!Array.isArray(parsed.scorecard)) throw new Error('No scorecard array');
        return { scorecard: parsed.scorecard, generated_at: new Date().toISOString() };
    } catch {
        return { error: 'Could not parse scorecard JSON', raw: text.slice(0, 500) };
    }
}

function parsePanelJson(text: string): any {
    try {
        const parsed = extractJson(text);
        if (!Array.isArray(parsed.panel_scorecard)) throw new Error('No panel_scorecard array');
        return { panel_scorecard: parsed.panel_scorecard, generated_at: new Date().toISOString() };
    } catch {
        return { error: 'Could not parse panel scorecard JSON', raw: text.slice(0, 500) };
    }
}

function parseRoadmapJson(text: string): any {
    try {
        const parsed = extractJson(text);
        const streams = ['product', 'gtm', 'capital_planning', 'team', 'supply_chain', 'operations'];
        const result: any = {};
        for (const s of streams) {
            if (parsed[s]) result[s] = parsed[s];
        }
        return result;
    } catch {
        return { error: 'Could not parse roadmap JSON', raw: text.slice(0, 500) };
    }
}

export { router as testFrameworkRoutes };
