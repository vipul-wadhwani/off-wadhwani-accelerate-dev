# Journey Roadmap Generation - Production Prompt

## Purpose

Generate personalized journey roadmaps with actionable deliverables across six functional support areas for ventures accepted into the Wadhwani Accelerate program. Used by Venture Managers, Panelists, and Selection Committee members to create structured growth plans that are context-driven, growth-idea-aligned, and traceable to specific screening insights.

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

**Corporate Presentation Content:**
${ventureData.corporate_presentation_text?.slice(0, 8000) || 'No corporate presentation provided.'}
[... truncated ...]

## OUTPUT FORMAT

Generate a structured roadmap covering ALL SIX functional support areas. For each area, provide exactly 5 actions/deliverables that are specific to this venture's context, growth idea, and identified gaps.

Return ONLY a JSON object in this format:

{
  "product": {
    "relevance": "<One sentence explaining why Product matters for this specific venture's growth idea>",
    "support_priority": "<High | Medium | Low>",
    "actions": [
      {
        "id": "prod_1",
        "title": "<Specific action — 3-5 words>",
        "description": "<What needs to be done and why — 1-2 sentences>",
        "context_reference": "<Which input data point drives this action — e.g., 'Screening con: unclear product differentiation' or 'Venture requested product help' or 'Interaction note: founder mentioned feature gaps'>",
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
    "support_priority": "<...>",
    "actions": [ ... ]
  },
  "capital_planning": {
    "relevance": "<...>",
    "support_priority": "<...>",
    "actions": [ ... ]
  },
  "team": {
    "relevance": "<...>",
    "support_priority": "<...>",
    "actions": [ ... ]
  },
  "supply_chain": {
    "relevance": "<...>",
    "support_priority": "<...>",
    "actions": [ ... ]
  },
  "operations": {
    "relevance": "<...>",
    "support_priority": "<...>",
    "actions": [ ... ]
  }
}

## GENERATION RULES

1. **Context-driven, not generic:** Every action must trace back to a specific data point from the venture's application, screening insights, or interaction notes. The "context_reference" field must cite the source explicitly. Do not produce generic accelerator advice.

2. **Growth idea alignment:** All actions across all 6 areas must collectively serve the venture's stated growth idea (new product/service, new segment, or new geography). The roadmap should read as a cohesive plan, not isolated functional checklists.

3. **Address the Cons:** At least 2 actions across the full roadmap must directly address risks or gaps identified in the screening Cons. Call these out clearly in the context_reference.

4. **Leverage the Pros:** At least 2 actions across the full roadmap should build on identified strengths from the screening Pros to create momentum. Call these out in the context_reference.

5. **Interaction notes integration:** If interaction notes reveal specific concerns, commitments, or pivots discussed with the venture, these must be reflected in relevant actions. Interaction notes often contain the most current and nuanced context — prioritize them.

6. **Prioritization logic:**
   - Areas where the venture explicitly requested help → High priority, actions should be more detailed and execution-ready
   - Areas where screening identified gaps but venture didn't request help → Medium priority, actions should be diagnostic and advisory
   - Areas where venture indicated "Don't need help" and no red flags were found → Low priority, actions should be lightweight checkpoints or validation exercises

7. **Timeline realism:** Spread actions across a realistic 12-16 week program timeline. Early actions should focus on assessment and planning; mid-program on execution; late-program on validation and sustainability.

8. **Sequencing:** Actions within each area should follow a logical progression (diagnose → plan → build → test → refine). Cross-functional dependencies should be noted where relevant (e.g., "GTM Action 3 depends on Product Action 2 completion").

9. **Deliverable clarity:** Each action should result in a tangible output the venture can use beyond the program — a document, framework, model, strategy, process, or validated decision.

10. **Tone:** Professional, supportive, and direct. This roadmap is a working document for both the Accelerate program team and the venture founder. Avoid jargon without explanation.

Return ONLY the JSON object, no additional text.
```

---

## Output Format Guidelines

### Roadmap Structure

For each of the 6 functional areas, the output includes:

- **relevance** — One sentence explaining why this area matters for this specific venture's growth idea
- **support_priority** — High | Medium | Low (derived from the venture's requested support status and screening insights)
- **actions** — Exactly 5 actions/deliverables, each containing the fields described below

### Action/Deliverable Fields

| Field | Description |
|-------|-------------|
| **id** | Unique identifier per stream: `prod_1`–`prod_5`, `gtm_1`–`gtm_5`, `cap_1`–`cap_5`, `team_1`–`team_5`, `sc_1`–`sc_5`, `ops_1`–`ops_5` |
| **title** | Concise action title (3-5 words) |
| **description** | What needs to be done and why (1-2 sentences, venture-specific) |
| **context_reference** | Which input data point drives this action — must cite the source explicitly (e.g., "Screening con: unclear GTM strategy", "Venture requested GTM help", "Interaction note: founder mentioned pricing challenges") |
| **timeline** | Week/Month range within the 12-16 week program (e.g., "Weeks 1-2", "Weeks 3-5", "Month 2-3") |
| **success_metric** | Measurable outcome the venture can validate against (e.g., "PRD document completed", "3 pilot customers onboarded") |
| **status** | Always `"pending"` on generation |
| **priority** | `high` | `medium` | `low` |

### The 6 Functional Areas

**1. PRODUCT** (`product`)

Focus on: Product readiness for the growth idea — feature gaps, MVP definition, product-market fit validation, product differentiation, technical feasibility, product roadmap alignment.

**2. GO-TO-MARKET** (`gtm`)

Focus on: Market entry or expansion strategy — pricing, positioning, channel strategy, sales enablement, marketing plan, competitive differentiation, launch planning, customer acquisition strategy for the new product/segment/geography.

**3. CAPITAL PLANNING** (`capital_planning`)

Focus on: Financial readiness — funding strategy, unit economics, cash flow projections, investment pitch readiness, grant/subsidy identification, financial modeling for the growth idea, burn rate management.

**4. TEAM** (`team`)

Focus on: Organizational readiness — hiring plan, skill gap analysis, leadership development, org structure for growth, advisory board, key hires needed, culture and retention during scaling.

**5. SUPPLY CHAIN** (`supply_chain`)

Focus on: Sourcing and fulfillment readiness — supplier identification, procurement strategy, inventory planning, logistics for new geography/product, vendor negotiations, quality control, cost optimization.

**6. OPERATIONS** (`operations`)

Focus on: Operational scalability — process documentation, technology/tools adoption, compliance and regulatory readiness, operational KPIs, automation opportunities, customer support scaling, standard operating procedures.

### Support Priority Assignment

| Priority | Condition | Action Depth |
|----------|-----------|--------------|
| **High** | Venture explicitly requested help in this area | Actions should be detailed and execution-ready |
| **Medium** | Screening identified gaps but venture didn't request help | Actions should be diagnostic and advisory |
| **Low** | Venture indicated "Don't need help" and no red flags found | Actions should be lightweight checkpoints or validation exercises |

### Action Priority Assignment

| Priority | Meaning | Examples |
|----------|---------|----------|
| **high** | Critical blocker — must be addressed first | Revenue model gaps, compliance blockers, key hire, undefined MVP |
| **medium** | Important for growth — schedule within program | Channel strategy, process optimization, vendor negotiations |
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
| 6 | **Prioritization logic** | High = requested help, Medium = screening gap but not requested, Low = no help needed + no red flags. |
| 7 | **Timeline realism** | Spread across 12-16 weeks: early = assess/plan, mid = execute, late = validate/sustain. |
| 8 | **Sequencing** | Diagnose → Plan → Build → Test → Refine. Note cross-functional dependencies. |
| 9 | **Deliverable clarity** | Each action produces a tangible, reusable output (document, framework, model, strategy, process). |
| 10 | **Tone** | Professional, supportive, direct. Working document for program team and founder. No unexplained jargon. |

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
    relevance: string;                          // Why this area matters for this venture
    support_priority: 'High' | 'Medium' | 'Low'; // Derived from requested support + screening
    actions: RoadmapAction[];                   // Exactly 5 actions
}

interface RoadmapAction {
    id: string;               // Unique ID: prod_1, gtm_2, cap_3, team_4, sc_5, ops_1
    title: string;            // Concise title (3-5 words)
    description: string;      // Venture-specific description (1-2 sentences)
    context_reference: string; // Explicit citation of input data source
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
    ├── 5. Build ventureData object from all sources
    ├── 6. Build prompt with venture data + VSM notes + interaction notes + AI analysis
    ├── 7. Call Claude API (temperature=0 for consistency)
    ├── 8. Parse JSON response (validate each stream has exactly 5 actions)
    ├── 9. Mark previous roadmaps as not current
    ├── 10. Insert new roadmap with version tracking
    │
    ▼
Return saved roadmap to frontend
```

---

## Fallback Behavior

If Claude's response fails to parse or a stream has fewer than 5 actions, the system uses hardcoded fallback deliverables per stream:

| Stream | Fallback Actions |
|--------|-----------------|
| **Product** | Product Audit, Feature Gap Analysis, MVP Definition, Pilot Plan, Product Roadmap Alignment |
| **GTM** | Market Analysis, ICP Definition, Channel Strategy, Sales Playbook, Launch Plan |
| **Capital Planning** | Financial Model, Unit Economics Analysis, Funding Strategy, Cash Flow Projection, Investor Readiness |
| **Team** | Org Structure Review, Skill Gap Analysis, Hiring Roadmap, Key Hire JDs, Retention Plan |
| **Supply Chain** | Vendor Assessment, Cost Optimization, Logistics Model, Quality SOP, Capacity Plan |
| **Operations** | Process Mapping, KPI Dashboard, SOP Pack, Compliance Review, Scaling Plan |

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
| Missing API key | 500 | `ANTHROPIC_API_KEY is not configured` |
| Invalid API key | 500 | `Invalid Anthropic API key.` |
| Rate limit | 500 | `Rate limit exceeded. Please try again later.` |
| Parse failure | 200 | Returns fallback roadmap data |
| DB save failure | 200 | Returns roadmap with `saved: false` flag |

---

## Version History

- **v1.0** (2026-03-01): Initial roadmap generation with Claude API, 6 workstreams, versioned storage
- **v2.0** (2026-03-06): Updated prompt to strategic program advisor role. Added detailed output format guidelines: context_reference tracing, 10 generation rules (context-driven, growth-aligned, con-addressing, pro-leveraging, interaction-notes-first, prioritization logic, timeline realism, sequencing, deliverable clarity, tone). Restructured output to include per-area relevance, support_priority, and 5 actions each with success_metric and context_reference. Renamed `funding` stream to `capital_planning`. Added Phase 1/2/3 timeline distribution and sequencing logic.

---

**Last Updated:** 2026-03-06
