import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface VentureData {
    id: string;
    name: string;
    founder_name?: string;
    revenue_12m?: string;           // Numeric value in Cr (e.g. "25") or legacy text range (e.g. "5Cr-25Cr")
    revenue_potential_3y?: string;   // Text range e.g. "50Cr+"
    full_time_employees?: string;    // Text range e.g. "10-25"
    growth_focus?: string | string[];
    growth_current?: any;
    growth_target?: any;
    commitment?: any;
    vsm_notes?: string;
    corporate_presentation_text?: string;
    program_type?: string;
    growth_dimensions_selected?: string[];
    target_jobs?: number;
    min_investment?: number;
    incremental_hiring?: string;
    time_commitment?: string;
    second_line_team?: string;
    financial_condition?: string;
}

export interface RoadmapAction {
    id: string;
    title: string;
    description: string;
    context_reference: string;
    timeline: string;
    success_metric: string;
    status: 'pending';
    priority: 'Need deep support' | 'Need some guidance' | "Don't need help";
}

export interface FunctionalAreaRoadmap {
    relevance: string;
    support_priority: 'Need deep support' | 'Need some guidance' | "Don't need help";
    support_status?: 'Need Deep Support' | 'Need Some Guidance' | 'Do Not Need Help';
    end_goal?: string;
    actions: RoadmapAction[];
}

export interface RoadmapData {
    product: FunctionalAreaRoadmap;
    gtm: FunctionalAreaRoadmap;
    capital_planning: FunctionalAreaRoadmap;
    team: FunctionalAreaRoadmap;
    supply_chain: FunctionalAreaRoadmap;
    operations: FunctionalAreaRoadmap;
}

export interface PanelScorecardDimension {
    dimension: string;
    application_rating: string;
    panel_rating: 'Green' | 'Yellow' | 'Red';
    panel_brief: string;
    panel_remarks?: string;
}

export interface PanelInsights {
    panel_scorecard: PanelScorecardDimension[];
    generated_at: string;
}

export interface ScorecardDimension {
    dimension: string;
    assessment: string;
    rating: 'Green' | 'Yellow' | 'Red';
    brief: string;
}

export interface AIInsights {
    scorecard: ScorecardDimension[];
    generated_at: string;
}

/**
 * Generate AI insights for a venture using Claude API (V2 SCALE Scorecard)
 */
export async function generateVentureInsights(
    ventureData: VentureData,
    vsmNotes: string = ''
): Promise<AIInsights> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured in environment variables');
    }

    const prompt = buildInsightsPrompt(ventureData, vsmNotes);

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 2500,
            temperature: 0.7,
            tools: [
                {
                    type: 'web_search_20260209',
                    name: 'web_search',
                } as any,
            ],
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        // Extract text from potentially multi-block response (web_search produces tool_use + text blocks)
        const responseText = message.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');

        console.log(`[Insights] Claude response blocks: ${message.content.length}, text length: ${responseText.length}, stop_reason: ${message.stop_reason}`);

        const insights = parseScorecardResponse(responseText);
        return insights;
    } catch (error: any) {
        console.error('Error calling Claude API:', error);

        if (error.status === 401) {
            throw new Error('Invalid Anthropic API key. Please check your ANTHROPIC_API_KEY.');
        } else if (error.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        } else {
            throw new Error(`Failed to generate AI insights: ${error.message}`);
        }
    }
}

/**
 * Build the V2 SCALE scorecard prompt for Claude
 * Adapted for text-range revenue fields and missing DB fields
 */
function buildInsightsPrompt(ventureData: VentureData, vsmNotes: string): string {
    const growthDimensions = Array.isArray(ventureData.growth_dimensions_selected)
        ? ventureData.growth_dimensions_selected
        : (Array.isArray(ventureData.growth_focus) ? ventureData.growth_focus : []);

    return `You are an expert screening analyst for the Wadhwani Accelerate Assisted Growth Platform. Your role is to evaluate a venture application and produce a SCALE scorecard — a simple, glanceable table that the Screening Manager can use for quick decision-making.

Your output is a scorecard with exactly 7 dimensions. For each dimension, provide:
- A **rating**: Green, Yellow, or Red
- A **brief** (exactly 2 sentences): Sentence 1 states the key data point or finding specific to this venture. Sentence 2 explains the implication or why it maps to the given rating. Briefs must be dynamic — reference the venture's actual data, never use generic boilerplate.

Do NOT write lengthy narratives. The screening manager wants a quick-glance table, not a report.

**SCALE Scorecard Dimensions:**

1. **Size** — Current revenue scale. Is the venture large enough for the program?
   - Green: Core with ₹25Cr–₹85Cr ARR; Select with ₹85Cr–₹425Cr ARR; Prime (Startups) with ₹4Cr+ ARR and visible path to ₹25Cr in 3 years.
   - Yellow: Below threshold for the applicable program but showing growth momentum.
   - Red: Significantly below minimum threshold or pre-revenue.
   - IMPORTANT: Revenue may be a numeric value in Cr (e.g. "25" means ₹25Cr) or a legacy text range (e.g. "5Cr-25Cr"). If numeric, compare directly against thresholds. If a text range, use the midpoint.
   - The program type is NOT explicitly set — you must INFER it from the revenue: revenue < ₹25Cr → likely Prime; ₹25Cr–₹85Cr → likely Core; ₹85Cr+ → likely Select. State which program tier you inferred in the brief.

2. **Sector** — Growth sector attractiveness. Is the sector growing?
   - Green: Sector at 8%+ 3-year CAGR, projected to grow above GDP.
   - Yellow: Sector growing at GDP-level (5–8%) or mixed signals.
   - Red: Sector stagnant, declining, or facing structural headwinds.
   - IMPORTANT: You MUST use the web_search tool to look up current growth data for the sector the venture operates in. Identify the sector from the venture's product/service description and target market, then search for "[sector name] India market size CAGR growth" or similar. Your brief must reference the specific sector identified and the growth data found. Do NOT rely solely on static knowledge — always search.

3. **Capital** — Balance sheet strength. Can the venture fund this growth?
   - Green: Positive cash flow & PAT for Core/Select (SMBs); 12+ month runway for Prime (startups).
   - Yellow: Cash-flow positive but PAT-negative for SMBs; 6–12 month runway for startups.
   - Red: Negative cash flow and PAT; < 6 month runway; or not disclosed.
   - Use the "Financial Condition" field (e.g. "PAT profitable and cash positive", "Not yet profitable but have 12+ months runway", "6-12 months runway available", "Less than 6 months runway") as the primary signal. Also consider min_investment and the "Funding Plan" field as additional context. If financial condition is not disclosed, rate as Yellow with "Financial condition not disclosed — manual review recommended."

4. **Ambition** — Target Incremental Revenue (3Y). Is the growth target ambitious enough?
   - Green: Min 8% incremental CAGR, on track to double revenue in 5 years for Core/Select or 3 years for Prime.
   - Yellow: Moderate growth target (4–8% CAGR).
   - Red: < 4% CAGR or no clear revenue target stated.
   - IMPORTANT: The "Target Incremental Revenue (3Y)" field represents INCREMENTAL revenue on top of the current base — it is NOT total projected revenue. For example, if current revenue is ₹25Cr and incremental target is ₹50Cr, total projected 3Y revenue is ₹75Cr.
   - Calculate: Incremental % = (revenue_potential_3y / revenue_12m) × 100. CAGR = ((revenue_12m + revenue_potential_3y) / revenue_12m)^(1/3) − 1. State both the incremental % and estimated CAGR in the brief.
   - Revenue figures may be numeric (in Cr) or legacy text ranges. If numeric, use the actual value. If a text range, use the midpoint (e.g. "5Cr-25Cr" → ₹15Cr, "50Cr+" → ₹50Cr). If either revenue figure is missing, rate as Red.

5. **Leadership** — Committed team. Will the leadership invest time?
   - Green: Owner/founder personally committed (Fully or Actively involved) AND second-in-line management team in place (Yes — Experienced team).
   - Yellow: One of the two is weak or unclear (e.g. Partially involved, or team is still being built).
   - Red: Neither founder commitment nor second-line team availability is evident (Not involved, or No dedicated team).
   - Use the "Owner Involvement" and "Leadership Team" fields below. If both are missing, look for signals in the corporate presentation and screening manager notes, and rate as Yellow with "Leadership commitment details not disclosed."

6. **Jobs / Employment Generation Potential** — Direct job creation potential over 3 years.
   - Green: 50+ jobs for Core/Prime; 150+ jobs for Select.
   - Yellow: 25–49 jobs (Core/Prime); 75–149 jobs (Select).
   - Red: < 25 jobs or not disclosed (Core/Prime); < 75 jobs or not disclosed (Select).
   - Use target_jobs (planned hires entered by the applicant). The "Funding Plan" field is NOT a hiring count — it describes how the venture plans to fund growth (e.g. "Internal Cashflows", "Bank Loan"). If target_jobs is null/missing, rate as Red with "Job creation target not disclosed."

7. **Venture Clarity** — How clearly has the applicant defined their new growth idea?
   - The venture has selected one or more growth dimensions from: product, segment, geography. Assess clarity ONLY for the dimensions they selected — ignore dimensions they did not choose.
   - Green: All **selected** dimensions are specific, concrete, and well-articulated.
   - Yellow: At least one selected dimension is clear, but other selected dimensions are vague or generic.
   - Red: Most or all selected dimensions are vague, generic, or lack substantive detail despite being chosen.
   - Evaluate ONLY based on what the applicant has explicitly stated. Do NOT penalise for dimensions not selected. Do NOT infer details.

**Venture Information:**
- Company Name: ${ventureData.name}
- Founder: ${ventureData.founder_name || 'N/A'}
- Business Type: ${(ventureData as any).business_type || 'N/A'}
- Designation: ${(ventureData as any).designation || 'N/A'}
- City: ${(ventureData as any).city || 'N/A'}
- State: ${(ventureData as any).state || 'N/A'}
- Current Revenue (12M): ${ventureData.revenue_12m || 'N/A'}
- Target Incremental Revenue (3Y): ${ventureData.revenue_potential_3y || 'N/A'}
- Full-Time Employees: ${ventureData.full_time_employees || 'N/A'}
- Growth Dimensions Selected: ${JSON.stringify(growthDimensions)}
- Target Jobs (Planned Hires): ${ventureData.target_jobs || 'N/A'}
- Financial Condition: ${ventureData.financial_condition || 'N/A'}
- Owner Involvement: ${ventureData.time_commitment || 'N/A'}
- Leadership Team: ${ventureData.second_line_team || 'N/A'}
- Funding Plan: ${ventureData.incremental_hiring || 'N/A'}
- Min Investment: ${ventureData.min_investment || 'N/A'}

**Current Business (What they do today):**
- Products/Services: ${(ventureData as any).what_do_you_sell || 'N/A'}
- Customer Segments: ${(ventureData as any).who_do_you_sell_to || 'N/A'}
- Regions: ${(ventureData as any).which_regions || 'N/A'}

**New Growth Idea (What they want to do):**
- Growth Focus: ${Array.isArray(ventureData.growth_focus) ? ventureData.growth_focus.join(', ') : (ventureData.growth_focus || 'N/A')}
- New Product/Service: ${(ventureData as any).focus_product || 'N/A'}
- New Customer Segment: ${(ventureData as any).focus_segment || 'N/A'}
- New Geography: ${(ventureData as any).focus_geography || 'N/A'}
- Support Description: ${(ventureData as any).support_description || 'N/A'}

**Additional Context:**
- Current Market: ${JSON.stringify(ventureData.growth_current || {})}
- Target Market: ${JSON.stringify(ventureData.growth_target || {})}

**Screening Manager's Notes:**
${vsmNotes || 'No additional notes provided.'}

**Corporate Presentation Content:**
${ventureData.corporate_presentation_text ? ventureData.corporate_presentation_text.slice(0, 8000) : 'No corporate presentation provided.'}
${ventureData.corporate_presentation_text && ventureData.corporate_presentation_text.length > 8000 ? '\n[... truncated ...]' : ''}

**Your Task:**
Return your assessment in the following JSON format. Return ONLY the JSON object, no additional text.

{
  "scorecard": [
    {
      "dimension": "Size",
      "assessment": "Current Revenue",
      "rating": "<Green | Yellow | Red>",
      "brief": "<exactly 2 sentences>"
    },
    {
      "dimension": "Sector",
      "assessment": "Growth Sector",
      "rating": "<Green | Yellow | Red>",
      "brief": "<exactly 2 sentences>"
    },
    {
      "dimension": "Capital",
      "assessment": "Balance Sheet Strength",
      "rating": "<Green | Yellow | Red>",
      "brief": "<exactly 2 sentences>"
    },
    {
      "dimension": "Ambition",
      "assessment": "Revenue Addition",
      "rating": "<Green | Yellow | Red>",
      "brief": "<exactly 2 sentences>"
    },
    {
      "dimension": "Leadership",
      "assessment": "Committed Team",
      "rating": "<Green | Yellow | Red>",
      "brief": "<exactly 2 sentences>"
    },
    {
      "dimension": "Jobs / Employment Generation Potential",
      "assessment": "Direct Jobs Creation (3Y)",
      "rating": "<Green | Yellow | Red>",
      "brief": "<exactly 2 sentences>"
    },
    {
      "dimension": "Venture Clarity",
      "assessment": "New Venture Definition",
      "rating": "<Green | Yellow | Red>",
      "brief": "<exactly 2 sentences>"
    }
  ]
}

**Critical Instructions:**
- Each "brief" must be exactly 2 sentences. Sentence 1: state the key data point or finding. Sentence 2: explain the implication or why it maps to the given rating.
- Each "rating" must be exactly one of: "Green", "Yellow", or "Red".
- For "Sector", you MUST use the web_search tool before answering. Search for the sector's growth data and cite it.
- For "Ambition", calculate incremental % and CAGR using the formulas above (revenue_potential_3y is incremental, not total). State both in the brief.
- If data for a dimension is missing or insufficient, default to Red (or Yellow if partially available) and state what is missing.

Return ONLY the JSON object, no additional text.`;
}

const FALLBACK_SCORECARD: ScorecardDimension[] = [
    { dimension: 'Size', assessment: 'Current Revenue', rating: 'Yellow', brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Sector', assessment: 'Growth Sector', rating: 'Yellow', brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Capital', assessment: 'Balance Sheet Strength', rating: 'Yellow', brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Ambition', assessment: 'Revenue Addition', rating: 'Yellow', brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Leadership', assessment: 'Committed Team', rating: 'Yellow', brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Jobs / Employment Generation Potential', assessment: 'Direct Jobs Creation (3Y)', rating: 'Yellow', brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Venture Clarity', assessment: 'New Venture Definition', rating: 'Yellow', brief: 'Automated analysis incomplete. Manual review required.' },
];

/**
 * Parse Claude's scorecard response into structured insights
 */
function parseScorecardResponse(responseText: string): AIInsights {
    try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        if (!Array.isArray(parsed.scorecard) || parsed.scorecard.length < 7) {
            throw new Error(`Expected 7 scorecard items, got ${parsed.scorecard?.length || 0}`);
        }

        // Validate and normalize each dimension
        const scorecard: ScorecardDimension[] = parsed.scorecard.slice(0, 7).map((item: any, i: number) => ({
            dimension: item.dimension || FALLBACK_SCORECARD[i].dimension,
            assessment: item.assessment || FALLBACK_SCORECARD[i].assessment,
            rating: ['Green', 'Yellow', 'Red'].includes(item.rating) ? item.rating : 'Yellow',
            brief: (item.brief || 'Manual review required.').replace(/<cite[^>]*>|<\/cite>/g, ''),
        }));

        return {
            scorecard,
            generated_at: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error parsing scorecard response:', error);
        console.log('Raw response:', responseText.slice(0, 500));

        return {
            scorecard: [...FALLBACK_SCORECARD],
            generated_at: new Date().toISOString(),
        };
    }
}

/**
 * Generate a personalized journey roadmap for a venture using Claude API
 */
export async function generateVentureRoadmap(
    ventureData: any,
    additionalContext: { vsmNotes?: string; aiAnalysis?: any; interactionNotes?: string; panelFeedback?: any; panelScorecard?: any; gateQuestions?: any } = {}
): Promise<RoadmapData> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured in environment variables');
    }

    const prompt = buildRoadmapPrompt(ventureData, additionalContext);

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 8000,
            temperature: 0,
            messages: [{ role: 'user', content: prompt }]
        });

        const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
        console.log(`[Roadmap] Claude response length: ${responseText.length} chars, stop_reason: ${message.stop_reason}`);
        return parseRoadmapResponse(responseText);
    } catch (error: any) {
        console.error('Error calling Claude API for roadmap:', error);
        if (error.status === 401) {
            throw new Error('Invalid Anthropic API key.');
        } else if (error.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`Failed to generate roadmap: ${error.message}`);
    }
}

function buildRoadmapPrompt(ventureData: any, ctx: { vsmNotes?: string; aiAnalysis?: any; interactionNotes?: string; panelFeedback?: any; panelScorecard?: any; gateQuestions?: any }): string {
    let aiSummary = '';
    if (ctx.aiAnalysis) {
        if (ctx.aiAnalysis.scorecard) {
            const scorecardLines = (ctx.aiAnalysis.scorecard as any[])
                .map((d: any) => `- ${d.dimension} (${d.rating}): ${d.brief}`)
                .join('\n');
            aiSummary = `\n**AI Screening Scorecard:**\n${scorecardLines}`;
            // Extract pros/cons from scorecard
            const strengths = (ctx.aiAnalysis.scorecard as any[]).filter((d: any) => d.rating === 'Green').map((d: any) => d.dimension);
            const risks = (ctx.aiAnalysis.scorecard as any[]).filter((d: any) => d.rating === 'Red').map((d: any) => d.dimension);
            if (strengths.length) aiSummary += `\n- Strengths: ${strengths.join('; ')}`;
            if (risks.length) aiSummary += `\n- Risks: ${risks.join('; ')}`;
        } else if (ctx.aiAnalysis.recommendation) {
            aiSummary = `\n**AI Screening Analysis:**\n- Recommendation: ${ctx.aiAnalysis.recommendation || 'N/A'}\n- Summary: ${ctx.aiAnalysis.summary || 'N/A'}\n- Strengths: ${(ctx.aiAnalysis.strengths || []).join('; ')}\n- Risks: ${(ctx.aiAnalysis.risks || []).join('; ')}`;
        }
    }

    // Build panel feedback section
    const pf = ctx.panelFeedback || {};
    const panelSection = ctx.panelFeedback ? `
**Panel Feedback:**
- Panel Expert: ${pf.panel_expert_name || 'N/A'}
- Panel Date: ${pf.panel_date || 'N/A'}
- SME Participant: ${pf.sme_name || 'N/A'}
- Final Recommendation: ${pf.final_recommendation || 'N/A'}
- Program Category: ${pf.program_category || 'N/A'}
- Business Overview: ${pf.business_overview || 'N/A'}
- Annual Revenue Actuals: ${pf.annual_revenue_actuals || 'N/A'}
- Projected Annual Revenue: ${pf.projected_annual_revenue || 'N/A'}
- Financial Health Rating: ${pf.rating_financial_health || 'N/A'}/5
- Leadership Rating: ${pf.rating_leadership || 'N/A'}/5
- Financial Health Insights: ${pf.insights_financial_health || 'N/A'}
- Leadership Insights: ${pf.insights_leadership || 'N/A'}
- Proposed Expansion Idea: ${pf.proposed_expansion_idea || 'N/A'}
- Expansion Type: ${pf.selected_expansion_type || 'N/A'}
- Market Entry Routes: ${(pf.market_entry_routes || []).join?.(', ') || pf.market_entry_routes || 'N/A'}
- Expansion Description: ${pf.expansion_idea_description || 'N/A'}
- Current Progress on Expansion: ${pf.current_progress || 'N/A'}
- Incremental Revenue (3Y): ${pf.incremental_revenue_3y || 'N/A'}
- Incremental Jobs (3Y): ${pf.incremental_jobs_3y || 'N/A'}
- Expansion Clarity Rating: ${pf.rating_clarity_expansion || 'N/A'}/5
- Expansion Clarity Comments: ${pf.comments_clarity_expansion || 'N/A'}
- Support Type Proposal: ${pf.support_type_proposal || 'N/A'}
- Risks / Red Flags: ${pf.risks_red_flags || 'N/A'}
- Additional Notes: ${pf.additional_notes || 'N/A'}

**Panel Stream Assessment:**
- GTM: ${pf.stream_gtm || 'N/A'}
- Product / Quality: ${pf.stream_product_quality || 'N/A'}
- Operations: ${pf.stream_operations || 'N/A'}
- Supply Chain: ${pf.stream_supply_chain || 'N/A'}
- Org Design / Team: ${pf.stream_org_design || 'N/A'}
- Finance / Capital: ${pf.stream_finance || 'N/A'}` : '';

    const scorecardSection = ctx.panelScorecard ? `
**Panel SCALE Scorecard:**
${JSON.stringify(ctx.panelScorecard, null, 2)}` : '';

    const gateSection = ctx.gateQuestions ? `
**Panel Gate Questions:**
${JSON.stringify(ctx.gateQuestions, null, 2)}` : '';

    return `You are a strategic program advisor for the Accelerate Assisted Growth Platform. Your role is to generate a tailored, actionable roadmap for ventures that have been approved by the selection committee. This roadmap will guide the venture through the program to achieve their stated growth idea.

## INPUT DATA

You will receive the following context for the approved venture:

1. **Business Profile**
2. **Growth Idea**
3. **Support Areas Requested**
4. **Screening & Evaluation Context**
5. **Corporate Presentation** (optional)
6. **Panel Feedback Form**
7. **Panel SCALE Scorecard & Gate Questions**

**Venture Information:**
- Company: ${ventureData.name || 'N/A'}
- Founder: ${ventureData.founder_name || 'N/A'}
- Revenue (LTM): ${ventureData.revenue_12m || 'N/A'}
- Revenue Potential (3Y): ${ventureData.revenue_potential_3y || 'N/A'}
- Employees: ${ventureData.full_time_employees || 'N/A'}
- Growth Focus: ${JSON.stringify(ventureData.growth_focus || 'N/A')}
- What They Sell: ${ventureData.what_do_you_sell || 'N/A'}
- Who They Sell To: ${ventureData.who_do_you_sell_to || 'N/A'}
- Regions: ${ventureData.which_regions || 'N/A'}
- Focus Product: ${ventureData.focus_product || 'N/A'}
- Focus Segment: ${ventureData.focus_segment || 'N/A'}
- Focus Geography: ${ventureData.focus_geography || 'N/A'}
- Blockers: ${ventureData.blockers || 'N/A'}
- Support Request: ${ventureData.support_request || 'N/A'}
- Incremental Hiring: ${ventureData.incremental_hiring || 'N/A'}

**VSM Notes:**
${ctx.vsmNotes || 'No notes provided.'}

**Interaction Notes:**
${ctx.interactionNotes || 'No interaction notes available.'}
${aiSummary}
${panelSection}
${scorecardSection}
${gateSection}
${ventureData.corporate_presentation_text ? `
**Corporate Presentation Content:**
${ventureData.corporate_presentation_text.slice(0, 8000)}
${ventureData.corporate_presentation_text.length > 8000 ? '\n[... truncated ...]' : ''}
` : ''}
## OUTPUT FORMAT

Generate a structured roadmap covering ALL SIX functional support areas. For each area, provide an end goal, support status, and exactly 5 actions/deliverables that are specific to this venture's context, growth idea, panel feedback, and identified gaps.

Return ONLY a JSON object in this format:

{
  "product": {
    "relevance": "<One sentence explaining why Product matters for this specific venture's growth idea>",
    "support_status": "<Need Deep Support | Need Some Guidance | Do Not Need Help — mapped from panel stream_product_quality>",
    "end_goal": "<One sentence stating the specific measurable outcome for this area. Do NOT start with 'By week X' — state the outcome directly, e.g. 'Product roadmap defined and MVP validated with 3 pilot customers.'>",
    "actions": [
      {
        "id": "prod_1",
        "title": "<Specific action — 3-5 words>",
        "description": "<What needs to be done and why — 1-2 sentences>",
        "context_reference": "<Which input data point drives this action — cite source explicitly>",
        "timeline": "<Week/Month range within 12-16 week program>",
        "success_metric": "<Measurable outcome>",
        "status": "pending",
        "priority": "<high | medium | low>"
      },
      { "id": "prod_2", ... }, { "id": "prod_3", ... }, { "id": "prod_4", ... }, { "id": "prod_5", ... }
    ]
  },
  "gtm": { ... }, "capital_planning": { ... }, "team": { ... }, "supply_chain": { ... }, "operations": { ... }
}

## GENERATION RULES

1. **Context-driven, not generic:** Every action must trace back to a specific data point. The "context_reference" field must cite the source explicitly. No generic advice.
2. **Growth idea alignment:** All 30 actions must collectively serve the venture's stated growth idea.
3. **Address the Cons:** At least 2 actions must directly address risks or gaps from screening.
4. **Leverage the Pros:** At least 2 actions should build on identified strengths.
5. **Interaction notes integration:** If interaction notes reveal specific concerns or commitments, reflect them in relevant actions.
6. **Prioritization logic:**
   - support_status = Need Deep Support (panel stream = need_deep_support) → actions must be detailed and execution-ready; priority = high
   - support_status = Need Some Guidance (panel stream = need_some_advice) → actions should be diagnostic and advisory; priority = medium
   - support_status = Do Not Need Help (panel stream = not_started, on_track, or completed) → lightweight checkpoints; priority = low
7. **Timeline realism:** Spread across 12-16 weeks: early = assess/plan, mid = execute, late = validate/sustain.
8. **Sequencing:** Diagnose → Plan → Build → Test → Refine. Note cross-functional dependencies.
9. **Deliverable clarity:** Each action should produce a tangible, reusable output.
10. **Tone:** Professional, supportive, and direct.
11. **Panel feedback integration:** Actions must reflect panel stream status assessments. Panelist-identified risks must be addressed. Panel expansion idea and support proposal must be incorporated.
12. **SCALE scorecard alignment:** Red panel ratings → at least 1 remediation action per Red dimension. Green → build on strengths. Yellow → advisory/monitoring.
13. **Per-stream end goal coherence:** Each area's end_goal must state the specific measurable outcome. Do NOT prefix with "By week X" — state the outcome directly (e.g. "Product roadmap defined and MVP validated with 3 pilot customers"). The 5 actions must collectively lead to it.

Return ONLY the JSON object, no additional text.`;
}

// Map legacy High/Medium/Low to new labels for backward compatibility
function mapSupportPriority(value: string): 'Need deep support' | 'Need some guidance' | "Don't need help" {
    const v = (value || '').toLowerCase();
    if (v === 'high' || v === 'need deep support') return 'Need deep support';
    if (v === 'low' || v === "don't need help") return "Don't need help";
    return 'Need some guidance';
}

function mapSupportStatus(value: string): 'Need Deep Support' | 'Need Some Guidance' | 'Do Not Need Help' {
    const v = (value || '').toLowerCase();
    if (v.includes('deep') || v === 'high') return 'Need Deep Support';
    if (v.includes('not') || v.includes("don't") || v === 'low') return 'Do Not Need Help';
    return 'Need Some Guidance';
}

function mapActionPriority(value: string): 'Need deep support' | 'Need some guidance' | "Don't need help" {
    const v = (value || '').toLowerCase();
    if (v === 'high' || v === 'need deep support') return 'Need deep support';
    if (v === 'low' || v === "don't need help") return "Don't need help";
    return 'Need some guidance';
}

function parseRoadmapResponse(responseText: string): RoadmapData {
    try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');

        const parsed = JSON.parse(jsonMatch[0]);
        const streams = ['product', 'gtm', 'capital_planning', 'team', 'supply_chain', 'operations'] as const;

        console.log('[Roadmap Parse] Parsed streams:', streams.map(s => ({
            stream: s,
            hasArea: !!parsed[s],
            hasActions: !!parsed[s]?.actions,
            actionsCount: parsed[s]?.actions?.length,
            isArray: Array.isArray(parsed[s]?.actions),
        })));

        const result: any = {};
        for (const stream of streams) {
            const area = parsed[stream];
            if (area && Array.isArray(area.actions) && area.actions.length >= 3) {
                result[stream] = {
                    relevance: area.relevance || '',
                    support_priority: mapSupportPriority(area.support_priority || area.support_status || ''),
                    support_status: area.support_status || mapSupportStatus(area.support_priority || ''),
                    end_goal: area.end_goal || '',
                    actions: area.actions.slice(0, 5).map((item: any, i: number) => ({
                        id: item.id || `${stream}_${i + 1}`,
                        title: item.title || 'Untitled',
                        description: item.description || '',
                        context_reference: item.context_reference || 'Manual review required',
                        timeline: item.timeline || 'Weeks 1-2',
                        success_metric: item.success_metric || '',
                        status: 'pending' as const,
                        priority: mapActionPriority(item.priority),
                    })),
                };
            } else {
                console.log(`[Roadmap Parse] Using FALLBACK for ${stream}. Area exists: ${!!area}, actions array: ${Array.isArray(area?.actions)}, count: ${area?.actions?.length}`);
                result[stream] = getFallbackArea(stream);
            }
        }

        return result as RoadmapData;
    } catch (error) {
        console.error('Error parsing roadmap response:', error);
        console.log('Raw response:', responseText);

        const streams = ['product', 'gtm', 'capital_planning', 'team', 'supply_chain', 'operations'] as const;
        const result: any = {};
        for (const stream of streams) {
            result[stream] = getFallbackArea(stream);
        }
        return result as RoadmapData;
    }
}

function getFallbackArea(stream: string): FunctionalAreaRoadmap {
    const fallbacks: Record<string, FunctionalAreaRoadmap> = {
        product: {
            relevance: 'Product readiness assessment required for growth execution.',
            support_priority: 'Need some guidance',
            support_status: 'Need Some Guidance',
            end_goal: 'Product gaps identified and MVP defined for the growth idea — manual review required.',
            actions: [
                { id: 'prod_1', title: 'Product Audit', description: 'Comprehensive review of current product capabilities and gaps.', context_reference: 'Manual review required', timeline: 'Weeks 1-2', success_metric: 'Audit report completed', status: 'pending', priority: 'Need deep support' },
                { id: 'prod_2', title: 'Feature Gap Analysis', description: 'Identify feature gaps for the growth idea.', context_reference: 'Manual review required', timeline: 'Weeks 2-3', success_metric: 'Gap analysis document', status: 'pending', priority: 'Need deep support' },
                { id: 'prod_3', title: 'MVP Definition', description: 'Define minimum viable product for new offering.', context_reference: 'Manual review required', timeline: 'Weeks 3-5', success_metric: 'MVP spec document', status: 'pending', priority: 'Need some guidance' },
                { id: 'prod_4', title: 'Pilot Plan', description: 'Design pilot program for validation.', context_reference: 'Manual review required', timeline: 'Weeks 6-10', success_metric: 'Pilot launched', status: 'pending', priority: 'Need some guidance' },
                { id: 'prod_5', title: 'Product Roadmap', description: 'Align product roadmap with growth targets.', context_reference: 'Manual review required', timeline: 'Weeks 11-14', success_metric: 'Roadmap document approved', status: 'pending', priority: "Don't need help" },
            ],
        },
        gtm: {
            relevance: 'Go-to-market strategy required for new market entry.',
            support_priority: 'Need some guidance',
            support_status: 'Need Some Guidance',
            end_goal: 'Go-to-market strategy defined and first customer outreach initiated — manual review required.',
            actions: [
                { id: 'gtm_1', title: 'Market Analysis', description: 'Target market sizing and competitive landscape review.', context_reference: 'Manual review required', timeline: 'Weeks 1-2', success_metric: 'Market analysis report', status: 'pending', priority: 'Need deep support' },
                { id: 'gtm_2', title: 'ICP Definition', description: 'Define ideal customer profile for new segment.', context_reference: 'Manual review required', timeline: 'Weeks 2-4', success_metric: 'ICP document completed', status: 'pending', priority: 'Need deep support' },
                { id: 'gtm_3', title: 'Channel Strategy', description: 'Partner and distribution channel development plan.', context_reference: 'Manual review required', timeline: 'Weeks 4-6', success_metric: 'Channel strategy document', status: 'pending', priority: 'Need some guidance' },
                { id: 'gtm_4', title: 'Sales Playbook', description: 'Standardized sales process and objection handling.', context_reference: 'Manual review required', timeline: 'Weeks 6-10', success_metric: 'Playbook ready for team', status: 'pending', priority: 'Need some guidance' },
                { id: 'gtm_5', title: 'Launch Plan', description: 'Go-to-market launch plan with timelines.', context_reference: 'Manual review required', timeline: 'Weeks 10-14', success_metric: 'Launch plan approved', status: 'pending', priority: "Don't need help" },
            ],
        },
        capital_planning: {
            relevance: 'Financial readiness assessment for growth investment.',
            support_priority: 'Need some guidance',
            support_status: 'Need Some Guidance',
            end_goal: 'Financial model and funding strategy completed for the growth plan — manual review required.',
            actions: [
                { id: 'cap_1', title: 'Financial Model', description: 'Detailed projections and unit economics analysis.', context_reference: 'Manual review required', timeline: 'Weeks 1-3', success_metric: 'Financial model completed', status: 'pending', priority: 'Need deep support' },
                { id: 'cap_2', title: 'Unit Economics', description: 'Validate unit economics for new growth area.', context_reference: 'Manual review required', timeline: 'Weeks 3-5', success_metric: 'Unit economics validated', status: 'pending', priority: 'Need deep support' },
                { id: 'cap_3', title: 'Funding Strategy', description: 'Identify and plan funding sources for growth.', context_reference: 'Manual review required', timeline: 'Weeks 5-8', success_metric: 'Funding strategy document', status: 'pending', priority: 'Need some guidance' },
                { id: 'cap_4', title: 'Cash Flow Projection', description: 'Model cash flow impact of growth initiatives.', context_reference: 'Manual review required', timeline: 'Weeks 8-11', success_metric: 'Cash flow model ready', status: 'pending', priority: 'Need some guidance' },
                { id: 'cap_5', title: 'Investor Readiness', description: 'Prepare pitch materials and data room.', context_reference: 'Manual review required', timeline: 'Weeks 11-14', success_metric: 'Investor deck completed', status: 'pending', priority: "Don't need help" },
            ],
        },
        team: {
            relevance: 'Organizational readiness for growth execution.',
            support_priority: 'Need some guidance',
            support_status: 'Need Some Guidance',
            end_goal: 'Hiring roadmap and org structure defined to support growth — manual review required.',
            actions: [
                { id: 'team_1', title: 'Org Structure Review', description: 'Define roles and reporting lines for growth phase.', context_reference: 'Manual review required', timeline: 'Weeks 1-2', success_metric: 'Org chart updated', status: 'pending', priority: 'Need deep support' },
                { id: 'team_2', title: 'Skill Gap Analysis', description: 'Identify capability gaps against growth requirements.', context_reference: 'Manual review required', timeline: 'Weeks 2-4', success_metric: 'Gap analysis completed', status: 'pending', priority: 'Need deep support' },
                { id: 'team_3', title: 'Hiring Roadmap', description: 'Critical hires plan with timelines and budgets.', context_reference: 'Manual review required', timeline: 'Weeks 4-8', success_metric: 'Hiring plan approved', status: 'pending', priority: 'Need some guidance' },
                { id: 'team_4', title: 'Key Hire JDs', description: 'Job descriptions for priority roles.', context_reference: 'Manual review required', timeline: 'Weeks 8-11', success_metric: 'JDs published', status: 'pending', priority: 'Need some guidance' },
                { id: 'team_5', title: 'Retention Plan', description: 'Plan to retain key talent during scaling.', context_reference: 'Manual review required', timeline: 'Weeks 11-14', success_metric: 'Retention plan documented', status: 'pending', priority: "Don't need help" },
            ],
        },
        supply_chain: {
            relevance: 'Supply chain readiness for scaled operations.',
            support_priority: 'Need some guidance',
            support_status: 'Need Some Guidance',
            end_goal: 'Vendor strategy and logistics model established for growth execution — manual review required.',
            actions: [
                { id: 'sc_1', title: 'Vendor Assessment', description: 'Evaluate current supplier performance and risks.', context_reference: 'Manual review required', timeline: 'Weeks 1-3', success_metric: 'Vendor scorecard completed', status: 'pending', priority: 'Need deep support' },
                { id: 'sc_2', title: 'Cost Optimization', description: 'Identify cost reduction opportunities in procurement.', context_reference: 'Manual review required', timeline: 'Weeks 3-6', success_metric: 'Cost savings identified', status: 'pending', priority: 'Need some guidance' },
                { id: 'sc_3', title: 'Logistics Model', description: 'Design logistics for new geography/product.', context_reference: 'Manual review required', timeline: 'Weeks 6-9', success_metric: 'Logistics plan ready', status: 'pending', priority: 'Need some guidance' },
                { id: 'sc_4', title: 'Quality SOP', description: 'Quality control standard operating procedures.', context_reference: 'Manual review required', timeline: 'Weeks 9-12', success_metric: 'SOPs documented', status: 'pending', priority: "Don't need help" },
                { id: 'sc_5', title: 'Capacity Plan', description: 'Production/fulfillment capacity for growth targets.', context_reference: 'Manual review required', timeline: 'Weeks 12-14', success_metric: 'Capacity plan approved', status: 'pending', priority: "Don't need help" },
            ],
        },
        operations: {
            relevance: 'Operational scalability for sustainable growth.',
            support_priority: 'Need some guidance',
            support_status: 'Need Some Guidance',
            end_goal: 'Operational processes documented and KPIs established for scaled delivery — manual review required.',
            actions: [
                { id: 'ops_1', title: 'Process Mapping', description: 'Document and optimize core business processes.', context_reference: 'Manual review required', timeline: 'Weeks 1-3', success_metric: 'Process maps completed', status: 'pending', priority: 'Need deep support' },
                { id: 'ops_2', title: 'KPI Dashboard', description: 'Real-time operational metrics tracking setup.', context_reference: 'Manual review required', timeline: 'Weeks 3-6', success_metric: 'Dashboard live', status: 'pending', priority: 'Need some guidance' },
                { id: 'ops_3', title: 'SOP Pack', description: 'Standard operating procedures for key workflows.', context_reference: 'Manual review required', timeline: 'Weeks 6-9', success_metric: 'SOP pack delivered', status: 'pending', priority: 'Need some guidance' },
                { id: 'ops_4', title: 'Compliance Review', description: 'Regulatory and compliance requirements check.', context_reference: 'Manual review required', timeline: 'Weeks 9-12', success_metric: 'Compliance checklist cleared', status: 'pending', priority: "Don't need help" },
                { id: 'ops_5', title: 'Scaling Plan', description: 'Operational readiness for 3x growth scenario.', context_reference: 'Manual review required', timeline: 'Weeks 12-14', success_metric: 'Scaling plan documented', status: 'pending', priority: "Don't need help" },
            ],
        },
    };
    return fallbacks[stream] || fallbacks.product;
}

/**
 * Generate panel interview insights for a venture using Claude API
 */
export async function generatePanelInsights(
    ventureData: VentureData & { panel_notes?: string; screening_recommendation?: string; prior_ai_analysis?: any },
    vsmNotes: string = '',
    panelNotes: string = '',
    interactionTranscripts: string = ''
): Promise<PanelInsights> {
    if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is not configured in environment variables');
    }

    // Extract screening scorecard from prior AI analysis
    const screeningScorecard = ventureData.prior_ai_analysis?.scorecard || null;

    const prompt = buildPanelInsightsPrompt(ventureData, vsmNotes, panelNotes, screeningScorecard, interactionTranscripts);

    try {
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 2500,
            temperature: 0.3,
            tools: [
                {
                    type: 'web_search_20260209',
                    name: 'web_search',
                    max_uses: 3,
                } as any
            ],
            messages: [{ role: 'user', content: prompt }]
        });

        // Extract text from potentially multi-block response (web_search produces tool_use + text blocks)
        const responseText = message.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');

        console.log(`[Panel] Claude response length: ${responseText.length}, stop_reason: ${message.stop_reason}`);
        return parsePanelScorecardResponse(responseText, screeningScorecard);
    } catch (error: any) {
        console.error('Error calling Claude API for panel insights:', error);
        if (error.status === 401) {
            throw new Error('Invalid Anthropic API key. Please check your ANTHROPIC_API_KEY.');
        } else if (error.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        throw new Error(`Failed to generate panel insights: ${error.message}`);
    }
}

function buildPanelInsightsPrompt(
    ventureData: VentureData & { screening_recommendation?: string; prior_ai_analysis?: any },
    vsmNotes: string,
    panelNotes: string,
    screeningScorecard: ScorecardDimension[] | null,
    interactionTranscripts: string = ''
): string {
    const scorecardJson = screeningScorecard
        ? JSON.stringify(screeningScorecard, null, 2)
        : 'No screening scorecard available — generate panel ratings based on available data.';

    return `You are an expert panel analyst for the Wadhwani Accelerate Assisted Growth Platform. You have been given:
1. The application-based SCALE scorecard (7 dimensions, each rated Green/Yellow/Red with a brief) from the screening stage.
2. Interaction transcripts (call transcripts, meeting notes, emails) from the panel's conversations with the venture's founder/team.
3. Additional panel notes from the panel discussion.

Your task is to produce a **Panel Recommendation** rating for each of the 7 scorecard dimensions, based on what was discussed in the interactions and panel notes. The panel rating may agree with or differ from the application rating — it reflects new information, clarifications, or concerns that emerged during the discussions. Pay close attention to the interaction transcripts as they contain the primary evidence from panel conversations.

For each dimension, provide:
- A **panel_rating**: Green, Yellow, or Red
- A **panel_brief** (exactly 2 sentences): Sentence 1 states what was revealed or clarified during the panel discussion for this dimension. Sentence 2 explains whether this changes the assessment and why.

If neither the interaction transcripts nor the panel notes cover a particular dimension, carry forward the application rating and state "Not discussed in panel interactions — application rating carried forward." in the brief.

**Application-Based Screening Scorecard:**
${scorecardJson}

**Venture Information:**
- Company Name: ${ventureData.name}
- Founder: ${ventureData.founder_name || 'N/A'}
- Current Revenue (12M): ${ventureData.revenue_12m || 'N/A'}
- Target Incremental Revenue (3Y): ${ventureData.revenue_potential_3y || 'N/A'}
- Full-Time Employees: ${ventureData.full_time_employees || 'N/A'}
- Financial Condition: ${ventureData.financial_condition || 'N/A'}
- Owner Involvement: ${ventureData.time_commitment || 'N/A'}
- Leadership Team: ${ventureData.second_line_team || 'N/A'}
- Target Jobs (Planned Hires): ${ventureData.target_jobs || 'N/A'}
- Screening Recommendation: ${ventureData.screening_recommendation || 'N/A'}

**Current Business:**
- Products/Services: ${(ventureData as any).what_do_you_sell || 'N/A'}
- Customer Segments: ${(ventureData as any).who_do_you_sell_to || 'N/A'}
- Regions: ${(ventureData as any).which_regions || 'N/A'}

**New Growth Idea:**
- Growth Focus: ${Array.isArray(ventureData.growth_focus) ? ventureData.growth_focus.join(', ') : (ventureData.growth_focus || 'N/A')}
- New Product/Service: ${(ventureData as any).focus_product || 'N/A'}
- New Customer Segment: ${(ventureData as any).focus_segment || 'N/A'}
- New Geography: ${(ventureData as any).focus_geography || 'N/A'}

**Screening Manager's Notes:**
${vsmNotes || 'No screening notes provided.'}

**Interaction Transcripts (calls, meetings, emails, notes):**
${interactionTranscripts || 'No interaction transcripts available.'}

**Additional Panel Notes:**
${panelNotes || 'No additional panel notes provided.'}
${ventureData.corporate_presentation_text ? `
**Corporate Presentation Content:**
${ventureData.corporate_presentation_text.slice(0, 8000)}
${ventureData.corporate_presentation_text.length > 8000 ? '\n[... truncated ...]' : ''}
` : ''}

**Your Task:**
Return your assessment in the following JSON format. Return ONLY the JSON object, no additional text.

{
  "panel_scorecard": [
    {
      "dimension": "Size",
      "application_rating": "<carried from screening>",
      "panel_rating": "<Green | Yellow | Red>",
      "panel_brief": "<2 sentence explanation based on panel discussion>"
    },
    {
      "dimension": "Sector",
      "application_rating": "<carried from screening>",
      "panel_rating": "<Green | Yellow | Red>",
      "panel_brief": "<2 sentence explanation based on panel discussion>"
    },
    {
      "dimension": "Capital",
      "application_rating": "<carried from screening>",
      "panel_rating": "<Green | Yellow | Red>",
      "panel_brief": "<2 sentence explanation based on panel discussion>"
    },
    {
      "dimension": "Ambition",
      "application_rating": "<carried from screening>",
      "panel_rating": "<Green | Yellow | Red>",
      "panel_brief": "<2 sentence explanation based on panel discussion>"
    },
    {
      "dimension": "Leadership",
      "application_rating": "<carried from screening>",
      "panel_rating": "<Green | Yellow | Red>",
      "panel_brief": "<2 sentence explanation based on panel discussion>"
    },
    {
      "dimension": "Jobs / Employment Generation Potential",
      "application_rating": "<carried from screening>",
      "panel_rating": "<Green | Yellow | Red>",
      "panel_brief": "<2 sentence explanation based on panel discussion>"
    },
    {
      "dimension": "Venture Clarity",
      "application_rating": "<carried from screening>",
      "panel_rating": "<Green | Yellow | Red>",
      "panel_brief": "<2 sentence explanation based on panel discussion>"
    }
  ]
}

**Critical Instructions:**
- Each "panel_brief" must be exactly 2 sentences, dynamic and specific to what was discussed. Never use generic language.
- If the panel notes revealed new information that changes the rating (up or down), explain what changed. Reference specific statements or clarifications from the notes.
- If the panel notes confirmed the application-based assessment, state what was confirmed.
- If the dimension was not discussed, carry forward the application rating and state this clearly.
- The panel_rating is the AI's recommendation — the panelist will be able to override it on the frontend.
- NEVER use individual names in panel_brief. Replace with role-based references (e.g. "the founder", "the CEO", "the panelist", "the screening manager"). This ensures anonymity in the scorecard output.
- Strip any citation tags from your response.

Return ONLY the JSON object, no additional text.`;
}

const PANEL_FALLBACK_SCORECARD: PanelScorecardDimension[] = [
    { dimension: 'Size', application_rating: 'Yellow', panel_rating: 'Yellow', panel_brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Sector', application_rating: 'Yellow', panel_rating: 'Yellow', panel_brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Capital', application_rating: 'Yellow', panel_rating: 'Yellow', panel_brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Ambition', application_rating: 'Yellow', panel_rating: 'Yellow', panel_brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Leadership', application_rating: 'Yellow', panel_rating: 'Yellow', panel_brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Jobs / Employment Generation Potential', application_rating: 'Yellow', panel_rating: 'Yellow', panel_brief: 'Automated analysis incomplete. Manual review required.' },
    { dimension: 'Venture Clarity', application_rating: 'Yellow', panel_rating: 'Yellow', panel_brief: 'Automated analysis incomplete. Manual review required.' },
];

function parsePanelScorecardResponse(responseText: string, screeningScorecard: ScorecardDimension[] | null): PanelInsights {
    try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');

        const parsed = JSON.parse(jsonMatch[0]);

        if (!Array.isArray(parsed.panel_scorecard) || parsed.panel_scorecard.length < 7) {
            throw new Error(`Expected 7 panel scorecard items, got ${parsed.panel_scorecard?.length || 0}`);
        }

        const panel_scorecard: PanelScorecardDimension[] = parsed.panel_scorecard.slice(0, 7).map((item: any, i: number) => {
            // Get application rating from screening scorecard if available
            const screeningItem = screeningScorecard?.[i];
            return {
                dimension: item.dimension || PANEL_FALLBACK_SCORECARD[i].dimension,
                application_rating: screeningItem?.rating || item.application_rating || 'Yellow',
                panel_rating: ['Green', 'Yellow', 'Red'].includes(item.panel_rating) ? item.panel_rating : 'Yellow',
                panel_brief: (item.panel_brief || 'Manual review required.').replace(/<cite[^>]*>|<\/cite>/g, ''),
                panel_remarks: item.panel_remarks || '',
            };
        });

        return {
            panel_scorecard,
            generated_at: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error parsing panel scorecard response:', error);
        console.log('Raw response:', responseText.slice(0, 500));

        // Populate fallback with actual screening ratings if available
        const fallback = PANEL_FALLBACK_SCORECARD.map((item, i) => ({
            ...item,
            application_rating: screeningScorecard?.[i]?.rating || 'Yellow',
        }));

        return {
            panel_scorecard: fallback,
            generated_at: new Date().toISOString(),
        };
    }
}
