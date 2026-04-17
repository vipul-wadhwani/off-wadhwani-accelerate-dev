# Venture Journey Roadmap — Production Prompt

**Last Updated:** 2026-04-17

## Purpose

Generate a personalized **12-16 week journey roadmap** with actionable deliverables across six functional support areas (Product, GTM, Capital Planning, Team, Supply Chain, Operations) for ventures accepted into the Wadhwani Accelerate program.

Used by Venture Managers, Panelists, and Selection Committee members to create structured growth plans that are context-driven, growth-idea-aligned, and traceable to specific screening and panel insights.

**Source:** `backend/src/services/aiService.ts` → `buildRoadmapPrompt()` (lines 395-555)
**Generator:** `generateVentureRoadmap()` (lines 363-393)

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 8,000 |
| **Temperature** | 0 (deterministic) |
| **Tools** | None |
| **API Endpoint** | `POST /api/ventures/:id/generate-roadmap` |
| **Auto-trigger** | Fire-and-forget on VP/VM assignment (ventures.ts:629-693) |
| **Allowed Roles** | `venture_mgr`, `committee_member`, `admin` |
| **Storage Table** | `venture_roadmaps` (versioned, `is_current` flag) |

---

## Input Data

### 1. Business Profile (`ventures` + `venture_applications`)
- Company name, founder, type, city, state
- `revenue_12m`, `revenue_potential_3y`, `full_time_employees`
- `growth_focus`, `what_do_you_sell`, `who_do_you_sell_to`, `which_regions`
- `focus_product`, `focus_segment`, `focus_geography`
- `blockers`, `support_request`, `incremental_hiring`

### 2. Screening Context (`venture_assessments`)
- `vsmNotes` ← `assessment.notes`
- `aiAnalysis` ← `assessment.ai_analysis` (screening SCALE scorecard + legacy strengths/risks)
- `interactionNotes` ← concatenated `venture_interactions` transcripts

### 3. Corporate Presentation (optional)
- Text extracted from `corporate_presentation_url`, truncated at 8,000 chars

### 4. Panel Feedback (`panel_feedback` table — most recent row)
All fields including:
- Panel expert name, date, SME, final recommendation, program category
- Section A: business overview, revenue actuals/projected, financial/leadership ratings + insights
- Section B: proposed expansion idea, type, market entry routes, progress, incremental revenue/jobs, clarity rating
- Section C: support stream statuses (`stream_gtm`, `stream_product_quality`, `stream_operations`, `stream_supply_chain`, `stream_org_design`, `stream_finance`), risks/red flags, support proposal
- Section D: final recommendation, additional notes

### 5. Panel SCALE Scorecard (`venture_assessments.panel_ai_analysis.panel_scorecard`)
- 7-dimension dual-column scorecard with `application_rating` + `panel_rating` + `panel_brief` + `panel_remarks`
- Injected into the prompt as pretty-printed JSON

### 6. Panel Gate Questions (`venture_assessments.gate_questions`)
- 6 Yes/No gate questions across Alternatives, Mindset, Resources categories

---

## Roadmap Area → Panel Stream Mapping

| Roadmap Area | Panel Stream Field | `support_status` Mapping |
|---|---|---|
| Product | `stream_product_quality` | `need_deep_support` → **Need Deep Support** |
| GTM | `stream_gtm` | `need_some_advice` → **Need Some Guidance** |
| Capital Planning | `stream_finance` | `not_started` / `on_track` / `completed` → **Do Not Need Help** |
| Team | `stream_org_design` | |
| Supply Chain | `stream_supply_chain` | |
| Operations | `stream_operations` | |

---

## Output Format

For each of the 6 areas:

```json
{
  "product": {
    "relevance": "<one sentence: why Product matters for this venture's growth idea>",
    "support_status": "Need Deep Support | Need Some Guidance | Do Not Need Help",
    "end_goal": "<specific measurable outcome, e.g. 'Product roadmap defined and MVP validated with 3 pilot customers'>",
    "actions": [
      {
        "id": "prod_1",
        "title": "<3-5 words>",
        "description": "<what + why, 1-2 sentences>",
        "context_reference": "<explicit citation: panel stream, SCALE rating, screening con, interaction note>",
        "timeline": "<e.g. 'Weeks 1-2', 'Month 2'>",
        "success_metric": "<measurable outcome>",
        "status": "pending",
        "priority": "high | medium | low"
      },
      { "id": "prod_2", ... }, { "id": "prod_3", ... }, { "id": "prod_4", ... }, { "id": "prod_5", ... }
    ]
  },
  "gtm":              { ... support_status from stream_gtm ... },
  "capital_planning": { ... support_status from stream_finance ... },
  "team":             { ... support_status from stream_org_design ... },
  "supply_chain":     { ... support_status from stream_supply_chain ... },
  "operations":       { ... support_status from stream_operations ... }
}
```

### TypeScript Schema

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
    relevance: string;
    support_status: 'Need Deep Support' | 'Need Some Guidance' | 'Do Not Need Help';
    end_goal: string;
    actions: RoadmapAction[];  // exactly 5
}

interface RoadmapAction {
    id: string;                 // prod_1..5, gtm_1..5, cap_1..5, team_1..5, sc_1..5, ops_1..5
    title: string;              // 3-5 words
    description: string;
    context_reference: string;
    timeline: string;
    success_metric: string;
    status: 'pending';
    priority: 'high' | 'medium' | 'low';
}
```

---

## Generation Rules

1. **Context-driven** — Every action must trace to a specific input data point. `context_reference` must cite the source explicitly. No generic accelerator advice.
2. **Growth idea aligned** — All 30 actions must collectively serve the venture's stated growth idea.
3. **Address the Cons** — ≥2 actions across the roadmap must directly address screening Cons (cited in `context_reference`).
4. **Leverage the Pros** — ≥2 actions should build on screening Pros.
5. **Interaction notes first** — Interaction notes contain the most current context; prioritize them.
6. **Prioritization**:
   - `need_deep_support` → detailed, execution-ready actions, priority = `high`
   - `need_some_advice` → diagnostic/advisory actions, priority = `medium`
   - `not_started` / `on_track` / `completed` → lightweight checkpoints, priority = `low`
7. **Timeline realism** — Spread across 12-16 weeks. Phase 1 (W1-4): Diagnose & Plan. Phase 2 (W5-10): Build & Execute. Phase 3 (W11-16): Validate & Sustain.
8. **Sequencing** — Diagnose → Plan → Build → Test → Refine. Note cross-functional dependencies.
9. **Deliverable clarity** — Each action produces a tangible, reusable output.
10. **Tone** — Professional, supportive, direct. No unexplained jargon.
11. **Panel feedback integration** — Stream statuses drive priorities. `need_deep_support` = High. Panelist-flagged risks/red flags must be addressed by ≥1 action. Panel expansion idea and support proposal must be incorporated into relevant areas. Panelist's financial health rating → capital_planning. Leadership rating → team.
12. **SCALE scorecard alignment** — Red `panel_rating` dimensions → ≥1 direct remediation action each. Green → ≥1 action building on the strength. Yellow → monitoring/advisory action.
13. **Per-stream end goal coherence** — Each `end_goal` states a specific measurable outcome (no "By week X" prefix). Must be grounded in panel expansion idea and relevant SCALE dimension. The 5 actions must collectively lead to that end goal.

---

## Support Status → Action Depth

| `support_status` | Panel Stream Values | Action Depth | Default Priority |
|------------------|--------------------|--------------|-----------------| 
| **Need Deep Support** | `need_deep_support` | Detailed, sequenced, execution-ready | `high` |
| **Need Some Guidance** | `need_some_advice` | Diagnostic, advisory, capacity-building | `medium` |
| **Do Not Need Help** | `not_started`, `on_track`, `completed` | Lightweight checkpoints / validation | `low` |

---

## Fallback Behavior

If Claude's response fails to parse or any area has fewer than 5 actions, hardcoded fallback deliverables per area are used (aiService.ts `FALLBACK_ROADMAP`). Each fallback area includes generic `support_status: "Need Some Guidance"`, a generic `end_goal`, and 5 generic actions flagged for manual review.

---

## Roadmap Versioning (`venture_roadmaps` table)

```
venture_roadmaps
├── id (UUID)
├── venture_id (FK → ventures)
├── generated_by (FK → profiles)
├── generation_source          -- 'ai_generated'
├── based_on_assessment_id     -- Links to assessment used as input
├── roadmap_data (JSONB)       -- The full roadmap JSON
├── roadmap_version (INTEGER)  -- Auto-incrementing
├── is_current (BOOLEAN)       -- Only one is current per venture
├── generation_duration_seconds
├── generation_model           -- 'claude-sonnet-4-5-20250929'
├── created_at
└── updated_at
```

On new generation: existing roadmaps for the venture are flipped to `is_current=false`, new row inserted with incremented `roadmap_version` and `is_current=true`.

---

## Data Flow

```
VP/VM assignment (fire-and-forget)  OR  "Generate Roadmap" button
      │
      ▼
POST /api/ventures/:id/generate-roadmap
      │
      ├── 1. Verify role (venture_mgr, committee_member, admin)
      ├── 2. Fetch venture + application + assessments
      ├── 3. Select current assessment (is_current=true, fallback to [0])
      ├── 4. Extract corporate presentation text (if URL present)
      ├── 5. Fetch latest panel_feedback row
      ├── 6. Fetch venture_interactions → concat transcripts
      ├── 7. Read panel_scorecard from assessment.panel_ai_analysis.panel_scorecard
      ├── 8. Read gate_questions from assessment.gate_questions
      ├── 9. Build prompt (temperature=0 for determinism)
      ├── 10. Call Claude, parse JSON (validate 6 areas × 5 actions each)
      ├── 11. Mark previous roadmaps as not current
      ├── 12. Insert new roadmap with version tracking
      │
      ▼
Return saved roadmap to frontend
```

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

## Frontend Integration

```typescript
api.generateRoadmap(ventureId: string): Promise<{ roadmap: VentureRoadmap }>
api.getRoadmap(ventureId: string): Promise<{ roadmap: VentureRoadmap | null }>
```

**Used by:**
- `src/pages/VentureManagerDashboard.tsx` — Accelerate Prime roadmaps
- `src/pages/SelectionCommitteeDashboard.tsx` — Accelerate Core/Select roadmaps
- `src/pages/VPVMVentureDetail.tsx` — VP/VM workbench view
