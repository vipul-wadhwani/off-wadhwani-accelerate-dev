# Journey Roadmap Generation - Production Prompt

## Purpose

Generate personalized journey roadmaps with actionable deliverables across six functional support areas for ventures accepted into the Wadhwani Accelerate program. Used by Venture Managers, Panelists, and Selection Committee members to create structured growth plans that are context-driven, growth-idea-aligned, and traceable to specific screening and panel insights.

**Source:** `backend/src/services/aiService.ts` → `buildRoadmapPrompt()`

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 4,000 |
| **Temperature** | 0 (deterministic) |
| **API Endpoint** | `POST /api/ventures/:id/generate-roadmap` |
| **Allowed Roles** | `venture_mgr`, `committee_member`, `admin` |
| **Storage Table** | `venture_roadmaps` (versioned) |

---

## Input Data

The prompt combines data from multiple sources:

### 1. Business Profile (from `ventures` + `venture_applications` tables)

- Company name, type, city, state
- Founder/applicant designation
- `what_do_you_sell` — Products/services offered
- `who_do_you_sell_to` — Customer segments served
- `which_regions` — Regions covered
- `full_time_employees` — Number of full-time employees
- `revenue_12m` — Revenue in the last 12 months

### 2. Growth Idea (from `venture_applications` table)

- `growth_focus` — Type: New Product/Service | New Segment | New Geography
- `focus_product` — Target product for growth
- `focus_segment` — Target customer segment
- `focus_geography` — Target geography
- `revenue_potential_3y` — Expected incremental revenue in next 3 years
- `blockers` — Current challenges / funding plan

### 3. Support Areas Requested (from `venture_applications` table)

- `support_request` — Status for each of the six areas: Product, Go-To-Market (GTM), Capital Planning, Team, Supply Chain, Operations
- `incremental_hiring` — Hiring plans

### 4. Screening & Evaluation Context (from `venture_assessments` table)

- `notes` — VSM screening manager notes
- `ai_analysis` — Prior AI screening insights (recommendation, summary, strengths, risks)
- Interaction notes — One or more rounds of discussion notes between screening manager and venture
- Pros identified during screening
- Cons identified during screening

### 5. Corporate Presentation (optional)

- `corporate_presentation_url` — Document for text extraction (truncated at 8,000 characters)

### 6. Panel Feedback Form (from `panel_feedback` table)

- `panel_expert_name` — Name of the panelist who conducted the interview
- `panel_date` — Date of the panel discussion
- `sme_name` — Subject Matter Expert who joined the panel (if any)
- **Section A — Business Overview:**
  - `business_overview` — Panelist's written summary of the venture's business
  - `annual_revenue_actuals` — Revenue actuals as shared or verified during the panel
  - `projected_annual_revenue` — Projected annual revenue discussed during the panel
  - `rating_financial_health` — Panelist's 1–5 rating of financial health
  - `rating_leadership` — Panelist's 1–5 rating of leadership quality
  - `insights_financial_health` — Panelist's written observations on financial health
  - `insights_leadership` — Panelist's written observations on leadership
- **Section B — Venture Definition:**
  - `proposed_expansion_idea` — Specific expansion idea as presented during the panel interview
  - `selected_expansion_type` — International or Domestic expansion
  - `market_entry_routes` — Selected entry routes for the expansion (array)
  - `expansion_idea_description` — Detailed description of the expansion plan
  - `current_progress` — Progress made so far on the expansion idea
  - `incremental_revenue_3y` — Incremental revenue target over 3 years (panel-confirmed)
  - `incremental_jobs_3y` — Direct jobs expected to be created over 3 years (panel-confirmed)
  - `rating_clarity_expansion` — Panelist's 1–5 rating of expansion idea clarity
  - `comments_clarity_expansion` — Panelist's written comments on expansion clarity
- **Section C — Support Required:**
  - `stream_gtm` — GTM stream status: `not_started | on_track | need_some_advice | need_deep_support | completed`
  - `stream_product_quality` — Product/Quality stream status (same enum)
  - `stream_operations` — Operations stream status
  - `stream_supply_chain` — Supply Chain stream status
  - `stream_org_design` — Org Design/Team stream status
  - `stream_finance` — Finance/Capital stream status
  - `support_type_proposal` — Panelist's proposed type of support for this venture
  - `risks_red_flags` — Risks or red flags identified by the panelist
- **Section D — Recommendation:**
  - `final_recommendation` — `proceed | hold | revisit_later`
  - `program_category` — `core | select`
  - `additional_notes` — Any additional panelist notes

### 7. Panel SCALE Scorecard & Gate Questions (from `ventures.panel_scorecard` + `ventures.gate_questions`)

- **Panel SCALE Scorecard** — 7-dimension dual-column scorecard (Application Rating vs. Panel Recommendation):
  - Dimensions: Size | Sector | Capital | Ambition | Leadership | Jobs/Employment Generation Potential | Venture Clarity
  - `application_rating` — AI-generated rating from application-stage screening: `Green | Yellow | Red`
  - `panel_rating` — Panelist-confirmed rating derived from the panel discussion: `Green | Yellow | Red`
  - `panel_brief` — 2-sentence AI-generated explanation based on panel discussion
  - `panel_remarks` — Optional free-text panelist remarks per dimension
- **Panel Gate Questions** — 6 Yes/No gate questions across 3 categories:
  - **Alternatives** (Q1–Q2): Can banks/investors provide support? Are other accelerators/consultants available?
  - **Mindset** (Q3–Q4): Is the owner open to operational/strategic support? Willing to fund growth sprints?
  - **Resources** (Q5–Q6): Does the program's Sprint offering fit the venture's journey? Does the venture have capacity to absorb program support?

---

## Production Prompt Template

```
You are a strategic program advisor for the Accelerate Assisted Growth Platform. Your role is to generate a tailored, actionable roadmap for ventures that have been approved by the selection committee. This roadmap will guide the venture through the program to achieve their stated growth idea.

## INPUT DATA

You will receive the following context for the approved venture:

1. **Business Profile**
   - Company name, type, city, state
   - Founder/applicant designation
   - Products/services offered
   - Customer segments served
   - Regions covered
   - Number of full-time employees
   - Revenue in the last 12 months

2. **Growth Idea**
   - Type: New Product/Service | New Segment | New Geography
   - Expected incremental revenue in next 3 years
   - Funding plan

3. **Support Areas Requested** (status for each):
   - Product
   - Go-To-Market (GTM)
   - Capital Planning
   - Team
   - Supply Chain
   - Operations

4. **Screening & Evaluation Context**
   - Support description (venture's own words on what help they need)
   - Screening manager notes (optional)
   - Interaction notes (one or more rounds of discussion notes between screening manager and venture)
   - Pros identified during screening
   - Cons identified during screening

5. **Corporate Presentation** (optional — summary if available)

6. **Panel Feedback Form**
   - Panelist's assessment of business overview, financial health, and leadership quality
   - Proposed expansion idea, market entry routes, current progress, and expansion clarity rating
   - Panel-assessed support stream statuses for all 6 functional areas (not_started / on_track / need_some_advice / need_deep_support / completed)
   - Panelist-identified risks and red flags
   - Final recommendation (proceed/hold/revisit_later) and program category (core/select)

7. **Panel SCALE Scorecard & Gate Questions**
   - 7-dimension dual-column scorecard: Application Rating vs. Panel Recommendation (Green/Yellow/Red per dimension)
   - Panel briefs explaining what each rating is based on, and optional panelist remarks
   - 6 Gate Questions across Alternatives, Mindset, and Resources categories with Yes/No responses

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

**AI Screening Analysis:**
- Recommendation: ${ctx.aiAnalysis.recommendation || 'N/A'}
- Summary: ${ctx.aiAnalysis.summary || 'N/A'}
- Strengths: ${(ctx.aiAnalysis.strengths || []).join('; ')}
- Risks: ${(ctx.aiAnalysis.risks || []).join('; ')}

**Panel Feedback:**
- Panel Expert: ${ctx.panelFeedback.panel_expert_name || 'N/A'}
- Panel Date: ${ctx.panelFeedback.panel_date || 'N/A'}
- SME Participant: ${ctx.panelFeedback.sme_name || 'N/A'}
- Final Recommendation: ${ctx.panelFeedback.final_recommendation || 'N/A'}
- Program Category: ${ctx.panelFeedback.program_category || 'N/A'}
- Business Overview: ${ctx.panelFeedback.business_overview || 'N/A'}
- Annual Revenue Actuals: ${ctx.panelFeedback.annual_revenue_actuals || 'N/A'}
- Projected Annual Revenue: ${ctx.panelFeedback.projected_annual_revenue || 'N/A'}
- Financial Health Rating: ${ctx.panelFeedback.rating_financial_health || 'N/A'}/5
- Leadership Rating: ${ctx.panelFeedback.rating_leadership || 'N/A'}/5
- Financial Health Insights: ${ctx.panelFeedback.insights_financial_health || 'N/A'}
- Leadership Insights: ${ctx.panelFeedback.insights_leadership || 'N/A'}
- Proposed Expansion Idea: ${ctx.panelFeedback.proposed_expansion_idea || 'N/A'}
- Expansion Type: ${ctx.panelFeedback.selected_expansion_type || 'N/A'}
- Market Entry Routes: ${(ctx.panelFeedback.market_entry_routes || []).join(', ') || 'N/A'}
- Expansion Description: ${ctx.panelFeedback.expansion_idea_description || 'N/A'}
- Current Progress on Expansion: ${ctx.panelFeedback.current_progress || 'N/A'}
- Incremental Revenue (3Y): ${ctx.panelFeedback.incremental_revenue_3y || 'N/A'}
- Incremental Jobs (3Y): ${ctx.panelFeedback.incremental_jobs_3y || 'N/A'}
- Expansion Clarity Rating: ${ctx.panelFeedback.rating_clarity_expansion || 'N/A'}/5
- Expansion Clarity Comments: ${ctx.panelFeedback.comments_clarity_expansion || 'N/A'}
- Support Type Proposal: ${ctx.panelFeedback.support_type_proposal || 'N/A'}
- Risks / Red Flags: ${ctx.panelFeedback.risks_red_flags || 'N/A'}
- Additional Notes: ${ctx.panelFeedback.additional_notes || 'N/A'}

**Panel Stream Assessment:**
- GTM: ${ctx.panelFeedback.stream_gtm || 'N/A'}
- Product / Quality: ${ctx.panelFeedback.stream_product_quality || 'N/A'}
- Operations: ${ctx.panelFeedback.stream_operations || 'N/A'}
- Supply Chain: ${ctx.panelFeedback.stream_supply_chain || 'N/A'}
- Org Design / Team: ${ctx.panelFeedback.stream_org_design || 'N/A'}
- Finance / Capital: ${ctx.panelFeedback.stream_finance || 'N/A'}

**Panel SCALE Scorecard:**
${JSON.stringify(ctx.panelScorecard || [], null, 2)}

**Panel Gate Questions:**
${JSON.stringify(ctx.gateQuestions || [], null, 2)}

**Corporate Presentation Content:**
${ventureData.corporate_presentation_text?.slice(0, 8000) || 'No corporate presentation provided.'}
[... truncated ...]

## OUTPUT FORMAT

Generate a structured roadmap covering ALL SIX functional support areas. For each area, provide an end goal, support status, and exactly 5 actions/deliverables that are specific to this venture's context, growth idea, panel feedback, and identified gaps.

Return ONLY a JSON object in this format:

{
  "product": {
    "relevance": "<One sentence explaining why Product matters for this specific venture's growth idea>",
    "support_status": "<Need Deep Support | Need Some Guidance | Do Not Need Help — mapped directly from the panel's stream_product_quality assessment>",
    "end_goal": "<One sentence stating the specific measurable outcome for this area. Do NOT start with 'By week X' — state the outcome directly, e.g. 'Product roadmap defined and MVP validated with 3 pilot customers in the target segment.'>",
    "actions": [
      {
        "id": "prod_1",
        "title": "<Specific action — 3-5 words>",
        "description": "<What needs to be done and why — 1-2 sentences>",
        "context_reference": "<Which input data point drives this action — e.g., 'Panel stream: product/quality = need_deep_support' or 'Screening con: unclear product differentiation' or 'Interaction note: founder mentioned feature gaps'>",
        "timeline": "<Week/Month range within 12-16 week program — e.g., 'Weeks 1-2', 'Weeks 3-5', 'Month 2'>",
        "success_metric": "<Measurable outcome — e.g., 'PRD document completed and reviewed', 'Pilot launched with 5 customers'>",
        "status": "pending",
        "priority": "<high | medium | low>"
      },
      { "id": "prod_2", ... },
      { "id": "prod_3", ... },
      { "id": "prod_4", ... },
      { "id": "prod_5", ... }
    ]
  },
  "gtm": {
    "relevance": "<...>",
    "support_status": "<Need Deep Support | Need Some Guidance | Do Not Need Help — from stream_gtm>",
    "end_goal": "<One sentence: GTM-specific program outcome for this venture>",
    "actions": [ ... ]
  },
  "capital_planning": {
    "relevance": "<...>",
    "support_status": "<Need Deep Support | Need Some Guidance | Do Not Need Help — from stream_finance>",
    "end_goal": "<One sentence: Capital Planning-specific program outcome for this venture>",
    "actions": [ ... ]
  },
  "team": {
    "relevance": "<...>",
    "support_status": "<Need Deep Support | Need Some Guidance | Do Not Need Help — from stream_org_design>",
    "end_goal": "<One sentence: Team-specific program outcome for this venture>",
    "actions": [ ... ]
  },
  "supply_chain": {
    "relevance": "<...>",
    "support_status": "<Need Deep Support | Need Some Guidance | Do Not Need Help — from stream_supply_chain>",
    "end_goal": "<One sentence: Supply Chain-specific program outcome for this venture>",
    "actions": [ ... ]
  },
  "operations": {
    "relevance": "<...>",
    "support_status": "<Need Deep Support | Need Some Guidance | Do Not Need Help — from stream_operations>",
    "end_goal": "<One sentence: Operations-specific program outcome for this venture>",
    "actions": [ ... ]
  }
}

## GENERATION RULES

1. **Context-driven, not generic:** Every action must trace back to a specific data point from the venture's application, screening insights, interaction notes, panel feedback, or SCALE scorecard. The "context_reference" field must cite the source explicitly. Do not produce generic accelerator advice.

2. **Growth idea alignment:** All actions across all 6 areas must collectively serve the venture's stated growth idea (new product/service, new segment, or new geography). The roadmap should read as a cohesive plan, not isolated functional checklists.

3. **Address the Cons:** At least 2 actions across the full roadmap must directly address risks or gaps identified in the screening Cons. Call these out clearly in the context_reference.

4. **Leverage the Pros:** At least 2 actions across the full roadmap should build on identified strengths from the screening Pros to create momentum. Call these out in the context_reference.

5. **Interaction notes integration:** If interaction notes reveal specific concerns, commitments, or pivots discussed with the venture, these must be reflected in relevant actions. Interaction notes often contain the most current and nuanced context — prioritize them.

6. **Prioritization logic:**
   - `support_status = Need Deep Support` (panel stream = `need_deep_support`) → actions must be detailed and execution-ready; individual action priority = high
   - `support_status = Need Some Guidance` (panel stream = `need_some_advice`) → actions should be diagnostic and advisory; individual action priority = medium
   - `support_status = Do Not Need Help` (panel stream = `not_started`, `on_track`, or `completed`) → actions should be lightweight checkpoints or validation exercises; individual action priority = low

7. **Timeline realism:** Spread actions across a realistic 12-16 week program timeline. Early actions should focus on assessment and planning; mid-program on execution; late-program on validation and sustainability.

8. **Sequencing:** Actions within each area should follow a logical progression (diagnose → plan → build → test → refine). Cross-functional dependencies should be noted where relevant (e.g., "GTM Action 3 depends on Product Action 2 completion").

9. **Deliverable clarity:** Each action should result in a tangible output the venture can use beyond the program — a document, framework, model, strategy, process, or validated decision.

10. **Tone:** Professional, supportive, and direct. This roadmap is a working document for both the Accelerate program team and the venture founder. Avoid jargon without explanation.

11. **Panel feedback integration:** Actions must reflect the panel feedback form's stream status assessments. Streams marked `need_deep_support` must have High priority actions that are detailed and execution-ready. Panelist-identified risks and red flags (risks_red_flags field) must be directly addressed by at least 1 action across the roadmap. The panelist's proposed expansion idea and support type proposal must be incorporated into the relevant functional area actions. Panelist insights on financial health and leadership should inform capital_planning and team area actions respectively.

12. **SCALE scorecard alignment:** Use the panel SCALE scorecard's panel_rating per dimension to inform roadmap priorities. Red panel ratings (e.g., Capital, Leadership, Venture Clarity) indicate critical gaps — include at least 1 direct remediation action per Red dimension. Green panel ratings indicate confirmed strengths — at least 1 action should build on these strengths and cite them in the context_reference. Yellow panel ratings warrant monitoring or advisory actions in the relevant functional area.

13. **Per-stream end goal coherence:** Each functional area's `end_goal` must state the specific, measurable outcome. Do NOT prefix with "By week X" — state the outcome directly (e.g. "Product roadmap defined and MVP validated with 3 pilot customers"). It must be grounded in the panel's expansion idea, support stream status, and relevant SCALE scorecard dimension. The 5 actions within the area must collectively lead to that end goal — the final action(s) should directly validate or deliver it.

Return ONLY the JSON object, no additional text.
```

---

## Output Format Guidelines

### Roadmap Structure

For each of the 6 functional areas, the output includes:

- **relevance** — One sentence explaining why this area matters for this specific venture's growth idea
- **support_status** — Mapped directly from the panel feedback stream assessment (see table below)
- **end_goal** — One sentence: the specific, measurable outcome this functional area will have achieved by the end of the 12-16 week program. Must be grounded in the panel's expansion idea and relevant SCALE dimension. The 5 actions within the area must collectively lead to it.
- **actions** — Exactly 5 actions/deliverables, each containing the fields described below

### Action/Deliverable Fields

| Field | Description |
|-------|-------------|
| **id** | Unique identifier per stream: `prod_1`–`prod_5`, `gtm_1`–`gtm_5`, `cap_1`–`cap_5`, `team_1`–`team_5`, `sc_1`–`sc_5`, `ops_1`–`ops_5` |
| **title** | Concise action title (3-5 words) |
| **description** | What needs to be done and why (1-2 sentences, venture-specific) |
| **context_reference** | Which input data point drives this action — must cite the source explicitly (e.g., "Panel stream: gtm = need_deep_support", "SCALE scorecard: Capital = Red — founder clarified tight working capital", "Screening con: unclear GTM strategy", "Interaction note: founder mentioned pricing challenges") |
| **timeline** | Week/Month range within the 12-16 week program (e.g., "Weeks 1-2", "Weeks 3-5", "Month 2-3") |
| **success_metric** | Measurable outcome the venture can validate against (e.g., "PRD document completed", "3 pilot customers onboarded") |
| **status** | Always `"pending"` on generation |
| **priority** | `high` \| `medium` \| `low` |

### The 6 Functional Areas

**Roadmap Area → Panel Stream Mapping**

| Roadmap Area | Panel Stream Field | Panel Stream Status Values |
|---|---|---|
| Product | `stream_product_quality` | `not_started \| on_track \| need_some_advice \| need_deep_support \| completed` |
| GTM | `stream_gtm` | same |
| Capital Planning | `stream_finance` | same |
| Team | `stream_org_design` | same |
| Supply Chain | `stream_supply_chain` | same |
| Operations | `stream_operations` | same |

**1. PRODUCT** (`product`)

Focus on: Product readiness for the growth idea — feature gaps, MVP definition, product-market fit validation, product differentiation, technical feasibility, product roadmap alignment. Informed by `stream_product_quality` panel stream status and SCALE Venture Clarity rating.

**2. GO-TO-MARKET** (`gtm`)

Focus on: Market entry or expansion strategy — pricing, positioning, channel strategy, sales enablement, marketing plan, competitive differentiation, launch planning, customer acquisition strategy for the new product/segment/geography. Informed by `stream_gtm` panel stream status, market entry routes, and panel expansion idea.

**3. CAPITAL PLANNING** (`capital_planning`)

Focus on: Financial readiness — funding strategy, unit economics, cash flow projections, investment pitch readiness, grant/subsidy identification, financial modeling for the growth idea, burn rate management. Informed by `stream_finance` panel stream status, SCALE Capital rating, and panelist's financial health rating and insights.

**4. TEAM** (`team`)

Focus on: Organizational readiness — hiring plan, skill gap analysis, leadership development, org structure for growth, advisory board, key hires needed, culture and retention during scaling. Informed by `stream_org_design` panel stream status, SCALE Leadership rating, and panelist's leadership rating and insights.

**5. SUPPLY CHAIN** (`supply_chain`)

Focus on: Sourcing and fulfillment readiness — supplier identification, procurement strategy, inventory planning, logistics for new geography/product, vendor negotiations, quality control, cost optimization. Informed by `stream_supply_chain` panel stream status.

**6. OPERATIONS** (`operations`)

Focus on: Operational scalability — process documentation, technology/tools adoption, compliance and regulatory readiness, operational KPIs, automation opportunities, customer support scaling, standard operating procedures. Informed by `stream_operations` panel stream status.

### Support Status Assignment

The `support_status` field is mapped directly from the panel feedback stream status — it is not derived by AI inference.

| support_status | Panel Stream Value | Action Depth |
|---|---|---|
| **Need Deep Support** | `need_deep_support` | Actions must be detailed, sequenced, and execution-ready |
| **Need Some Guidance** | `need_some_advice` | Actions should be diagnostic, advisory, and capacity-building |
| **Do Not Need Help** | `not_started`, `on_track`, or `completed` | Actions should be lightweight checkpoints or validation exercises |

### Action Priority Assignment

| Priority | Meaning | Examples |
|----------|---------|----------|
| **high** | Critical blocker — must be addressed first | Revenue model gaps, compliance blockers, key hire, undefined MVP, Red SCALE dimension, panelist-flagged risk |
| **medium** | Important for growth — schedule within program | Channel strategy, process optimization, vendor negotiations, Yellow SCALE dimension |
| **low** | Nice to have — schedule when capacity allows | Culture playbook, advanced analytics, optimization refinements |

### Timeline Distribution

Actions should be spread across a realistic 12-16 week program:

| Phase | Timeframe | Focus |
|-------|-----------|-------|
| **Phase 1: Diagnose & Plan** | Weeks 1-4 | Assessment, gap analysis, planning, critical blocker resolution |
| **Phase 2: Build & Execute** | Weeks 5-10 | Strategy execution, implementation, pilot launches, key deliverables |
| **Phase 3: Validate & Sustain** | Weeks 11-16 | Testing, refinement, validation, sustainability planning, handoff |

### Sequencing Logic

Actions within each area should follow a logical progression:

1. **Diagnose** — Assess current state, identify specific gaps
2. **Plan** — Design strategy, create frameworks, define targets
3. **Build** — Develop deliverables, execute key initiatives
4. **Test** — Pilot, validate assumptions, gather feedback
5. **Refine** — Iterate based on results, document for sustainability

Cross-functional dependencies should be noted in the `context_reference` field where relevant (e.g., "GTM Action 3 depends on Product Action 2 completion", "Capital Planning Action 2 requires Team Action 1 org structure").

---

## Generation Rules (Summary)

| # | Rule | Requirement |
|---|------|-------------|
| 1 | **Context-driven** | Every action must trace back to a specific input data point. The `context_reference` must cite the source. No generic advice. |
| 2 | **Growth idea aligned** | All 30 actions (5 × 6 areas) must collectively serve the venture's stated growth idea. Roadmap reads as a cohesive plan. |
| 3 | **Address the Cons** | At least 2 actions across the roadmap must directly address screening Cons. Cited in `context_reference`. |
| 4 | **Leverage the Pros** | At least 2 actions should build on screening Pros to create momentum. Cited in `context_reference`. |
| 5 | **Interaction notes first** | Interaction notes contain the most current context — they take priority when available. |
| 6 | **Support status → action depth** | `need_deep_support` = Need Deep Support → detailed, execution-ready actions; `need_some_advice` = Need Some Guidance → diagnostic/advisory; `not_started/on_track/completed` = Do Not Need Help → lightweight checkpoints. |
| 7 | **Timeline realism** | Spread across 12-16 weeks: early = assess/plan, mid = execute, late = validate/sustain. |
| 8 | **Sequencing** | Diagnose → Plan → Build → Test → Refine. Note cross-functional dependencies. |
| 9 | **Deliverable clarity** | Each action produces a tangible, reusable output (document, framework, model, strategy, process). |
| 10 | **Tone** | Professional, supportive, direct. Working document for program team and founder. No unexplained jargon. |
| 11 | **Panel feedback integration** | Panel stream statuses drive functional area priorities. `need_deep_support` = High. Panelist risks/red flags addressed by at least 1 action. Panel expansion idea and support proposal reflected in relevant actions. |
| 12 | **SCALE scorecard alignment** | Red panel ratings → at least 1 remediation action per Red dimension. Green panel ratings → at least 1 action building on the strength. Yellow → advisory/monitoring action. |
| 13 | **Per-stream end goal coherence** | Each area's `end_goal` states the specific measurable outcome. Do NOT prefix with "By week X". Grounded in panel expansion idea and relevant SCALE dimension. The 5 actions must collectively lead to that end goal. |

---

## Output Schema

```typescript
interface RoadmapData {
    product: FunctionalAreaRoadmap;
    gtm: FunctionalAreaRoadmap;
    capital_planning: FunctionalAreaRoadmap;
    team: FunctionalAreaRoadmap;
    supply_chain: FunctionalAreaRoadmap;
    operations: FunctionalAreaRoadmap;
}

interface FunctionalAreaRoadmap {
    relevance: string;                                                              // Why this area matters for this venture
    support_status: 'Need Deep Support' | 'Need Some Guidance' | 'Do Not Need Help'; // Mapped from panel stream status
    end_goal: string;                                                               // One sentence: what this area achieves by program end
    actions: RoadmapAction[];                                                       // Exactly 5 actions
}

interface RoadmapAction {
    id: string;               // Unique ID: prod_1, gtm_2, cap_3, team_4, sc_5, ops_1
    title: string;            // Concise title (3-5 words)
    description: string;      // Venture-specific description (1-2 sentences)
    context_reference: string; // Explicit citation of input data source (panel stream, SCALE rating, screening con/pro, interaction note)
    timeline: string;         // Week/Month range within 12-16 week program
    success_metric: string;   // Measurable outcome
    status: 'pending';        // Always "pending" on generation
    priority: 'high' | 'medium' | 'low';
}
```

---

## Roadmap Versioning

Roadmaps are stored with full version history in the `venture_roadmaps` table:

```sql
venture_roadmaps
├── id (UUID)
├── venture_id (FK → ventures)
├── generated_by (FK → profiles) -- User who triggered generation
├── generation_source            -- 'ai_generated'
├── based_on_assessment_id       -- Links to the assessment used as input
├── roadmap_data (JSONB)         -- The full roadmap JSON
├── roadmap_version (INTEGER)    -- Auto-incrementing version number
├── is_current (BOOLEAN)         -- Only one roadmap is "current"
├── generation_duration_seconds  -- How long Claude took
├── generation_model             -- 'claude-sonnet-4-5-20250929'
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

When a new roadmap is generated:
1. All existing roadmaps for the venture are marked `is_current = false`
2. New roadmap is inserted with `is_current = true` and incremented version
3. Previous versions remain accessible for history

---

## Data Flow

```
Venture Manager / Panel / Committee Dashboard (frontend)
    │
    ├── User clicks "Generate Roadmap" on accepted venture
    │
    ▼
POST /api/ventures/:id/generate-roadmap
    │
    ├── 1. Verify role (venture_mgr, committee_member, admin)
    ├── 2. Fetch venture + application + assessments (joined query)
    ├── 3. Fetch interaction notes from assessment history
    ├── 4. Extract corporate presentation text (if available)
    ├── 5. Fetch panel feedback from panel_feedback table
    ├── 6. Fetch panel SCALE scorecard from ventures.panel_scorecard
    ├── 7. Fetch panel gate questions from ventures.gate_questions
    ├── 8. Build ventureData object from all sources
    ├── 9. Build prompt with venture data + VSM notes + interaction notes + AI analysis + panel feedback + panel scorecard + gate questions
    ├── 10. Call Claude API (temperature=0 for consistency)
    ├── 11. Parse JSON response (validate each stream has end_goal, support_status, and exactly 5 actions)
    ├── 12. Mark previous roadmaps as not current
    ├── 13. Insert new roadmap with version tracking
    │
    ▼
Return saved roadmap to frontend
```

---

## Fallback Behavior

If Claude's response fails to parse or a stream has fewer than 5 actions, the system uses hardcoded fallback deliverables per stream. Each fallback stream includes a generic `support_status` of `"Need Some Guidance"`, a generic `end_goal`, and 5 generic actions.

| Stream | Fallback `end_goal` | Fallback Actions |
|--------|---------------------|-----------------|
| **Product** | "Product gaps identified and MVP defined for the growth idea — manual review required." | Product Audit, Feature Gap Analysis, MVP Definition, Pilot Plan, Product Roadmap Alignment |
| **GTM** | "Go-to-market strategy defined and first customer outreach initiated — manual review required." | Market Analysis, ICP Definition, Channel Strategy, Sales Playbook, Launch Plan |
| **Capital Planning** | "Financial model and funding strategy completed for the growth plan — manual review required." | Financial Model, Unit Economics Analysis, Funding Strategy, Cash Flow Projection, Investor Readiness |
| **Team** | "Hiring roadmap and org structure defined to support growth — manual review required." | Org Structure Review, Skill Gap Analysis, Hiring Roadmap, Key Hire JDs, Retention Plan |
| **Supply Chain** | "Vendor strategy and logistics model established for growth execution — manual review required." | Vendor Assessment, Cost Optimization, Logistics Model, Quality SOP, Capacity Plan |
| **Operations** | "Operational processes documented and KPIs established for scaled delivery — manual review required." | Process Mapping, KPI Dashboard, SOP Pack, Compliance Review, Scaling Plan |

All fallback actions use `"pending"` status, `"medium"` priority, and generic context references indicating manual review is required.

---

## Frontend Integration

### API Client Methods

```typescript
// Generate new roadmap
api.generateRoadmap(ventureId: string): Promise<{ roadmap: VentureRoadmap }>

// Get current roadmap
api.getRoadmap(ventureId: string): Promise<{ roadmap: VentureRoadmap | null }>
```

### Dashboard Usage

- **VentureManagerDashboard** (`src/pages/VentureManagerDashboard.tsx`): Generates roadmaps for Accelerate Prime ventures
- **SelectionCommitteeDashboard** (`src/pages/SelectionCommitteeDashboard.tsx`): Generates roadmaps for Accelerate Core/Select ventures

---

## Error Handling

| Error | HTTP Status | Message |
|-------|-------------|---------|
| Unauthorized role | 403 | `Only venture managers, committee members, and admins can generate roadmaps` |
| Venture not found | 404 | `Venture not found` |
| Panel feedback not found | 400 | `Panel feedback not found for this venture — roadmap requires a completed panel assessment` |
| Missing API key | 500 | `ANTHROPIC_API_KEY is not configured` |
| Invalid API key | 500 | `Invalid Anthropic API key.` |
| Rate limit | 500 | `Rate limit exceeded. Please try again later.` |
| Parse failure | 200 | Returns fallback roadmap data |
| DB save failure | 200 | Returns roadmap with `saved: false` flag |

---

## Version History

- **v1.0** (2026-03-01): Initial roadmap generation with Claude API, 6 workstreams, versioned storage
- **v2.0** (2026-03-06): Updated prompt to strategic program advisor role. Added detailed output format guidelines: context_reference tracing, 10 generation rules (context-driven, growth-aligned, con-addressing, pro-leveraging, interaction-notes-first, prioritization logic, timeline realism, sequencing, deliverable clarity, tone). Restructured output to include per-area relevance, support_priority, and 5 actions each with success_metric and context_reference. Renamed `funding` stream to `capital_planning`. Added Phase 1/2/3 timeline distribution and sequencing logic.
- **v3.0** (2026-03-25): Added Panel Feedback Form (all fields from `panel_feedback` table including stream statuses, financial/leadership ratings, expansion idea, risks/red flags, and final recommendation) and Panel SCALE Scorecard & Gate Questions as input sources. Added 3 new generation rules: panel feedback integration (Rule 11), SCALE scorecard alignment (Rule 12), and per-stream end goal coherence (Rule 13). Updated prioritization logic to use panel stream statuses. Added panel-stream-to-roadmap-area mapping. Updated data flow to include panel data fetching steps. Added `panel feedback not found` error handling. Replaced top-level `support_priority` (High/Medium/Low) with `support_status` per stream mapped directly from panel feedback stream values (`Need Deep Support | Need Some Guidance | Do Not Need Help`). Added per-stream `end_goal` field (one sentence: measurable functional area outcome by program end) replacing the former program-level `end_goal` object. Updated TypeScript schema, fallback table, and all prompt rules accordingly.

---

**Last Updated:** 2026-03-25 (v3.0)
