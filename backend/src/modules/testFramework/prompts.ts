/**
 * Self-contained prompt builders for the Test Framework module.
 *
 * These are intentional copies of the prompt logic from
 * backend/src/services/aiService.ts so the module has zero external
 * dependencies on existing service files and can be dropped into any branch.
 *
 * Keep in sync with aiService.ts when prompts are updated.
 */

// ─── Shared types ──────────────────────────────────────────────────────────────

export interface VentureInputData {
    id?: string;
    name: string;
    founder_name?: string;
    city?: string;
    state?: string;
    business_type?: string;
    designation?: string;
    revenue_12m?: string;
    revenue_potential_3y?: string;
    full_time_employees?: string;
    growth_focus?: string | string[];
    growth_dimensions_selected?: string[];
    growth_current?: any;
    growth_target?: any;
    target_jobs?: number;
    financial_condition?: string;
    time_commitment?: string;
    second_line_team?: string;
    incremental_hiring?: string;
    min_investment?: number;
    what_do_you_sell?: string;
    who_do_you_sell_to?: string;
    which_regions?: string;
    focus_product?: string;
    focus_segment?: string;
    focus_geography?: string;
    support_request?: string;
    support_description?: string;
    blockers?: string;
    vsm_notes?: string;
    corporate_presentation_text?: string;
    program_type?: string;
    // Panel-only fields
    panel_notes?: string;
    screening_recommendation?: string;
    prior_ai_analysis?: any;
}

export interface ModelConfig {
    model: string;
    max_tokens: number;
    temperature: number;
    tools: string[];
}

export const FEATURE_MODEL_CONFIG: Record<string, ModelConfig> = {
    screening: {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2500,
        temperature: 0.7,
        tools: ['web_search'],
    },
    panel: {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2500,
        temperature: 0.3,
        tools: ['web_search (max 3 uses)'],
    },
    roadmap: {
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        temperature: 0,
        tools: [],
    },
};

// ─── Screening Scorecard Prompt ────────────────────────────────────────────────

export function buildScreeningPrompt(venture: VentureInputData, vsmNotes = ''): string {
    const growthDimensions = Array.isArray(venture.growth_dimensions_selected)
        ? venture.growth_dimensions_selected
        : (Array.isArray(venture.growth_focus) ? venture.growth_focus : []);

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
   - IMPORTANT: You MUST use the web_search tool to look up current growth data for the sector the venture operates in. Search for "[sector name] India market size CAGR growth" or similar. Your brief must reference the specific sector and the growth data found.

3. **Capital** — Balance sheet strength. Can the venture fund this growth?
   - Green: Positive cash flow & PAT for Core/Select (SMBs); 12+ month runway for Prime (startups).
   - Yellow: Cash-flow positive but PAT-negative for SMBs; 6–12 month runway for startups.
   - Red: Negative cash flow and PAT; < 6 month runway; or not disclosed.
   - Use the "Financial Condition" field as the primary signal. If financial condition is not disclosed, rate as Yellow with "Financial condition not disclosed — manual review recommended."

4. **Ambition** — Target Incremental Revenue (3Y). Is the growth target ambitious enough?
   - Green: Min 8% incremental CAGR, on track to double revenue in 5 years for Core/Select or 3 years for Prime.
   - Yellow: Moderate growth target (4–8% CAGR).
   - Red: < 4% CAGR or no clear revenue target stated.
   - IMPORTANT: revenue_potential_3y is INCREMENTAL revenue on top of the current base — NOT total projected revenue.
   - Calculate: Incremental % = (revenue_potential_3y / revenue_12m) × 100. CAGR = ((revenue_12m + revenue_potential_3y) / revenue_12m)^(1/3) − 1. State both in the brief.

5. **Leadership** — Committed team. Will the leadership invest time?
   - Green: Owner/founder personally committed AND second-in-line management team in place.
   - Yellow: One of the two is weak or unclear.
   - Red: Neither founder commitment nor second-line team availability is evident.

6. **Jobs / Employment Generation Potential** — Direct job creation potential over 3 years.
   - Green: 50+ jobs for Core/Prime; 150+ jobs for Select.
   - Yellow: 25–49 jobs (Core/Prime); 75–149 jobs (Select).
   - Red: < 25 jobs or not disclosed (Core/Prime); < 75 jobs or not disclosed (Select).
   - Use target_jobs (planned hires). If target_jobs is null/missing, rate as Red with "Job creation target not disclosed."

7. **Venture Clarity** — How clearly has the applicant defined their new growth idea?
   - Green: All selected dimensions are specific, concrete, and well-articulated.
   - Yellow: At least one selected dimension is clear, but others are vague.
   - Red: Most or all selected dimensions are vague or lack substantive detail.

**Venture Information:**
- Company Name: ${venture.name}
- Founder: ${venture.founder_name || 'N/A'}
- Business Type: ${venture.business_type || 'N/A'}
- Designation: ${venture.designation || 'N/A'}
- City: ${venture.city || 'N/A'}
- State: ${venture.state || 'N/A'}
- Current Revenue (12M): ${venture.revenue_12m || 'N/A'}
- Target Incremental Revenue (3Y): ${venture.revenue_potential_3y || 'N/A'}
- Full-Time Employees: ${venture.full_time_employees || 'N/A'}
- Growth Dimensions Selected: ${JSON.stringify(growthDimensions)}
- Target Jobs (Planned Hires): ${venture.target_jobs || 'N/A'}
- Financial Condition: ${venture.financial_condition || 'N/A'}
- Owner Involvement: ${venture.time_commitment || 'N/A'}
- Leadership Team: ${venture.second_line_team || 'N/A'}
- Funding Plan: ${venture.incremental_hiring || 'N/A'}
- Min Investment: ${venture.min_investment || 'N/A'}

**Current Business (What they do today):**
- Products/Services: ${venture.what_do_you_sell || 'N/A'}
- Customer Segments: ${venture.who_do_you_sell_to || 'N/A'}
- Regions: ${venture.which_regions || 'N/A'}

**New Growth Idea (What they want to do):**
- Growth Focus: ${Array.isArray(venture.growth_focus) ? venture.growth_focus.join(', ') : (venture.growth_focus || 'N/A')}
- New Product/Service: ${venture.focus_product || 'N/A'}
- New Customer Segment: ${venture.focus_segment || 'N/A'}
- New Geography: ${venture.focus_geography || 'N/A'}
- Support Description: ${venture.support_description || 'N/A'}

**Additional Context:**
- Current Market: ${JSON.stringify(venture.growth_current || {})}
- Target Market: ${JSON.stringify(venture.growth_target || {})}

**Screening Manager's Notes:**
${vsmNotes || 'No additional notes provided.'}

**Corporate Presentation Content:**
${venture.corporate_presentation_text ? venture.corporate_presentation_text.slice(0, 8000) : 'No corporate presentation provided.'}
${venture.corporate_presentation_text && venture.corporate_presentation_text.length > 8000 ? '\n[... truncated ...]' : ''}

**Your Task:**
Return your assessment in the following JSON format. Return ONLY the JSON object, no additional text.

{
  "scorecard": [
    { "dimension": "Size", "assessment": "Current Revenue", "rating": "<Green | Yellow | Red>", "brief": "<exactly 2 sentences>" },
    { "dimension": "Sector", "assessment": "Growth Sector", "rating": "<Green | Yellow | Red>", "brief": "<exactly 2 sentences>" },
    { "dimension": "Capital", "assessment": "Balance Sheet Strength", "rating": "<Green | Yellow | Red>", "brief": "<exactly 2 sentences>" },
    { "dimension": "Ambition", "assessment": "Revenue Addition", "rating": "<Green | Yellow | Red>", "brief": "<exactly 2 sentences>" },
    { "dimension": "Leadership", "assessment": "Committed Team", "rating": "<Green | Yellow | Red>", "brief": "<exactly 2 sentences>" },
    { "dimension": "Jobs / Employment Generation Potential", "assessment": "Direct Jobs Creation (3Y)", "rating": "<Green | Yellow | Red>", "brief": "<exactly 2 sentences>" },
    { "dimension": "Venture Clarity", "assessment": "New Venture Definition", "rating": "<Green | Yellow | Red>", "brief": "<exactly 2 sentences>" }
  ]
}

**Critical Instructions:**
- Each "brief" must be exactly 2 sentences.
- Each "rating" must be exactly one of: "Green", "Yellow", or "Red".
- For "Sector", you MUST use the web_search tool before answering.
- For "Ambition", calculate incremental % and CAGR. State both in the brief.
- If data for a dimension is missing, default to Red (or Yellow if partially available).

Return ONLY the JSON object, no additional text.`;
}

// ─── Panel Scorecard Prompt ────────────────────────────────────────────────────

export function buildPanelPrompt(
    venture: VentureInputData,
    vsmNotes = '',
    panelNotes = '',
    screeningScorecard: any[] | null = null,
    interactionTranscripts = ''
): string {
    const scorecardJson = screeningScorecard
        ? JSON.stringify(screeningScorecard, null, 2)
        : 'No screening scorecard available — generate panel ratings based on available data.';

    return `You are an expert panel analyst for the Wadhwani Accelerate Assisted Growth Platform. You have been given:
1. The application-based SCALE scorecard (7 dimensions, each rated Green/Yellow/Red with a brief) from the screening stage.
2. Interaction transcripts (call transcripts, meeting notes, emails) from the panel's conversations with the venture's founder/team.
3. Additional panel notes from the panel discussion.

Your task is to produce a **Panel Recommendation** rating for each of the 7 scorecard dimensions, based on what was discussed in the interactions and panel notes. The panel rating may agree with or differ from the application rating — it reflects new information, clarifications, or concerns that emerged during the discussions.

For each dimension, provide:
- A **panel_rating**: Green, Yellow, or Red
- A **panel_brief** (exactly 2 sentences): Sentence 1 states what was revealed or clarified during the panel discussion. Sentence 2 explains whether this changes the assessment and why.

If neither the interaction transcripts nor the panel notes cover a particular dimension, carry forward the application rating and state "Not discussed in panel interactions — application rating carried forward." in the brief.

**Application-Based Screening Scorecard:**
${scorecardJson}

**Venture Information:**
- Company Name: ${venture.name}
- Founder: ${venture.founder_name || 'N/A'}
- Current Revenue (12M): ${venture.revenue_12m || 'N/A'}
- Target Incremental Revenue (3Y): ${venture.revenue_potential_3y || 'N/A'}
- Full-Time Employees: ${venture.full_time_employees || 'N/A'}
- Financial Condition: ${venture.financial_condition || 'N/A'}
- Owner Involvement: ${venture.time_commitment || 'N/A'}
- Leadership Team: ${venture.second_line_team || 'N/A'}
- Target Jobs (Planned Hires): ${venture.target_jobs || 'N/A'}
- Screening Recommendation: ${venture.screening_recommendation || 'N/A'}

**Current Business:**
- Products/Services: ${venture.what_do_you_sell || 'N/A'}
- Customer Segments: ${venture.who_do_you_sell_to || 'N/A'}
- Regions: ${venture.which_regions || 'N/A'}

**New Growth Idea:**
- Growth Focus: ${Array.isArray(venture.growth_focus) ? venture.growth_focus.join(', ') : (venture.growth_focus || 'N/A')}
- New Product/Service: ${venture.focus_product || 'N/A'}
- New Customer Segment: ${venture.focus_segment || 'N/A'}
- New Geography: ${venture.focus_geography || 'N/A'}

**Screening Manager's Notes:**
${vsmNotes || 'No screening notes provided.'}

**Interaction Transcripts (calls, meetings, emails, notes):**
${interactionTranscripts || 'No interaction transcripts available.'}

**Additional Panel Notes:**
${panelNotes || 'No additional panel notes provided.'}
${venture.corporate_presentation_text ? `
**Corporate Presentation Content:**
${venture.corporate_presentation_text.slice(0, 8000)}
${venture.corporate_presentation_text.length > 8000 ? '\n[... truncated ...]' : ''}
` : ''}

**Your Task:**
Return ONLY the JSON object, no additional text.

{
  "panel_scorecard": [
    { "dimension": "Size", "application_rating": "<from screening>", "panel_rating": "<Green | Yellow | Red>", "panel_brief": "<2 sentences>" },
    { "dimension": "Sector", "application_rating": "<from screening>", "panel_rating": "<Green | Yellow | Red>", "panel_brief": "<2 sentences>" },
    { "dimension": "Capital", "application_rating": "<from screening>", "panel_rating": "<Green | Yellow | Red>", "panel_brief": "<2 sentences>" },
    { "dimension": "Ambition", "application_rating": "<from screening>", "panel_rating": "<Green | Yellow | Red>", "panel_brief": "<2 sentences>" },
    { "dimension": "Leadership", "application_rating": "<from screening>", "panel_rating": "<Green | Yellow | Red>", "panel_brief": "<2 sentences>" },
    { "dimension": "Jobs / Employment Generation Potential", "application_rating": "<from screening>", "panel_rating": "<Green | Yellow | Red>", "panel_brief": "<2 sentences>" },
    { "dimension": "Venture Clarity", "application_rating": "<from screening>", "panel_rating": "<Green | Yellow | Red>", "panel_brief": "<2 sentences>" }
  ]
}

**Critical Instructions:**
- Each "panel_brief" must be exactly 2 sentences, dynamic and specific to what was discussed.
- NEVER use individual names — use role-based references (e.g. "the founder", "the panelist").
- If the dimension was not discussed, carry forward the application rating and state this clearly.
- Strip any citation tags from your response.

Return ONLY the JSON object, no additional text.`;
}

// ─── Journey Roadmap Prompt ────────────────────────────────────────────────────

export interface RoadmapContext {
    vsmNotes?: string;
    aiAnalysis?: any;
    interactionNotes?: string;
    panelFeedback?: any;
    panelScorecard?: any;
    gateQuestions?: any;
}

export function buildRoadmapPrompt(venture: VentureInputData, ctx: RoadmapContext = {}): string {
    let aiSummary = '';
    if (ctx.aiAnalysis?.scorecard) {
        const lines = (ctx.aiAnalysis.scorecard as any[])
            .map((d: any) => `- ${d.dimension} (${d.rating}): ${d.brief}`)
            .join('\n');
        aiSummary = `\n**AI Screening Scorecard:**\n${lines}`;
        const strengths = (ctx.aiAnalysis.scorecard as any[]).filter((d: any) => d.rating === 'Green').map((d: any) => d.dimension);
        const risks = (ctx.aiAnalysis.scorecard as any[]).filter((d: any) => d.rating === 'Red').map((d: any) => d.dimension);
        if (strengths.length) aiSummary += `\n- Strengths: ${strengths.join('; ')}`;
        if (risks.length) aiSummary += `\n- Risks: ${risks.join('; ')}`;
    }

    const pf = ctx.panelFeedback || {};
    const panelSection = ctx.panelFeedback ? `
**Panel Feedback:**
- Final Recommendation: ${pf.final_recommendation || 'N/A'}
- Program Category: ${pf.program_category || 'N/A'}
- Financial Health Rating: ${pf.rating_financial_health || 'N/A'}/5
- Leadership Rating: ${pf.rating_leadership || 'N/A'}/5
- Financial Health Insights: ${pf.insights_financial_health || 'N/A'}
- Leadership Insights: ${pf.insights_leadership || 'N/A'}
- Proposed Expansion Idea: ${pf.proposed_expansion_idea || 'N/A'}
- Expansion Type: ${pf.selected_expansion_type || 'N/A'}
- Expansion Description: ${pf.expansion_idea_description || 'N/A'}
- Incremental Revenue (3Y): ${pf.incremental_revenue_3y || 'N/A'}
- Incremental Jobs (3Y): ${pf.incremental_jobs_3y || 'N/A'}
- Risks / Red Flags: ${pf.risks_red_flags || 'N/A'}

**Panel Stream Assessment:**
- GTM: ${pf.stream_gtm || 'N/A'}
- Product / Quality: ${pf.stream_product_quality || 'N/A'}
- Operations: ${pf.stream_operations || 'N/A'}
- Supply Chain: ${pf.stream_supply_chain || 'N/A'}
- Org Design / Team: ${pf.stream_org_design || 'N/A'}
- Finance / Capital: ${pf.stream_finance || 'N/A'}` : '';

    const scorecardSection = ctx.panelScorecard
        ? `\n**Panel SCALE Scorecard:**\n${JSON.stringify(ctx.panelScorecard, null, 2)}`
        : '';

    const gateSection = ctx.gateQuestions
        ? `\n**Panel Gate Questions:**\n${JSON.stringify(ctx.gateQuestions, null, 2)}`
        : '';

    return `You are a strategic program advisor for the Accelerate Assisted Growth Platform. Generate a tailored, actionable roadmap for a venture approved by the selection committee.

**Venture Information:**
- Company: ${venture.name || 'N/A'}
- Founder: ${venture.founder_name || 'N/A'}
- Revenue (LTM): ${venture.revenue_12m || 'N/A'}
- Revenue Potential (3Y): ${venture.revenue_potential_3y || 'N/A'}
- Employees: ${venture.full_time_employees || 'N/A'}
- Growth Focus: ${JSON.stringify(venture.growth_focus || 'N/A')}
- What They Sell: ${venture.what_do_you_sell || 'N/A'}
- Who They Sell To: ${venture.who_do_you_sell_to || 'N/A'}
- Regions: ${venture.which_regions || 'N/A'}
- Focus Product: ${venture.focus_product || 'N/A'}
- Focus Segment: ${venture.focus_segment || 'N/A'}
- Focus Geography: ${venture.focus_geography || 'N/A'}
- Support Request: ${venture.support_request || 'N/A'}

**VSM Notes:**
${ctx.vsmNotes || 'No notes provided.'}

**Interaction Notes:**
${ctx.interactionNotes || 'No interaction notes available.'}
${aiSummary}
${panelSection}
${scorecardSection}
${gateSection}
${venture.corporate_presentation_text ? `
**Corporate Presentation Content:**
${venture.corporate_presentation_text.slice(0, 8000)}
${venture.corporate_presentation_text.length > 8000 ? '\n[... truncated ...]' : ''}
` : ''}

Generate a structured roadmap covering ALL SIX functional support areas with exactly 5 actions each.

Return ONLY a JSON object:

{
  "product": {
    "relevance": "<why Product matters for this venture>",
    "support_status": "<Need Deep Support | Need Some Guidance | Do Not Need Help>",
    "end_goal": "<specific measurable outcome — do NOT start with 'By week X'>",
    "actions": [
      { "id": "prod_1", "title": "<3-5 words>", "description": "<1-2 sentences>", "context_reference": "<source>", "timeline": "<Week range>", "success_metric": "<measurable outcome>", "status": "pending", "priority": "<high | medium | low>" },
      { "id": "prod_2" }, { "id": "prod_3" }, { "id": "prod_4" }, { "id": "prod_5" }
    ]
  },
  "gtm": { ... },
  "capital_planning": { ... },
  "team": { ... },
  "supply_chain": { ... },
  "operations": { ... }
}

Rules: Every action must trace to a specific data point. All 30 actions must serve the stated growth idea. Address panel-identified risks. Spread across 12-16 weeks.

Return ONLY the JSON object, no additional text.`;
}
