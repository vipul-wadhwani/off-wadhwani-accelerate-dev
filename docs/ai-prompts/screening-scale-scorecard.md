# Screening SCALE Scorecard — Production Prompt

**Last Updated:** 2026-04-18

## Purpose

Generate a structured **SCALE scorecard** for venture applications. Used by Venture Screening Managers (VSMs) to evaluate startups applying to the Wadhwani Accelerate program.

The prompt produces a **single scorecard table** with 7 dimensions — each rated **Red / Yellow / Green** with an exactly-2-sentence brief. No lengthy narratives. The screening manager should be able to glance at the table and immediately understand where the venture stands.

**Source:** `backend/src/services/aiService.ts` → `buildInsightsPrompt()` (lines 149-309)
**Generator:** `generateVentureInsights()` (lines 98-147)

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 2,500 |
| **Temperature** | 0.7 |
| **Tools** | `web_search_20260209` (max 3 uses) — for sector growth data lookup |
| **API Endpoint** | `POST /api/ventures/:id/generate-insights?type=screening` |
| **Allowed Roles** | `success_mgr`, `venture_mgr`, `committee_member`, `admin` |
| **Storage** | `venture_assessments.ai_analysis` (JSONB) |

---

## When Used

Triggered when a Screening Manager clicks **"Generate AI Analysis"** on the VSM Dashboard during initial application review.

---

## Input Data

Pulled from `ventures` + `venture_applications` tables and passed to the prompt:

### Venture Information
- Company name, founder, business type, designation, city, state
- `revenue_12m` — Current revenue (12 months)
- `revenue_potential_3y` — Target **incremental** revenue over 3 years (not total)
- `full_time_employees`
- `growth_dimensions_selected` / `growth_focus` — product / segment / geography
- `target_jobs` — Planned hires
- `financial_condition` — e.g. "PAT profitable and cash positive"
- `time_commitment` — Owner involvement
- `second_line_team` — Leadership team status
- `incremental_hiring` — Funding Plan text
- `min_investment`

### Current Business
- `what_do_you_sell`, `who_do_you_sell_to`, `which_regions`

### New Growth Idea
- `growth_focus`, `focus_product`, `focus_segment`, `focus_geography`
- `support_request` — applicant's free-text description of what help they need (primary field; saved by application form)
- `support_description` — legacy alias for the same field (fallback if `support_request` is empty)

### Growth Idea Support Status (`venture_streams` table)
Applicant self-assessed support need per functional area, set during the application form:
- `stream_name` — one of: Product, GTM, Capital Planning, Supply Chain, Operations, Team
- `status` — e.g. `Need some advice`, `Need help`, `Not started`, `Done`

### Additional Context
- `growth_current` / `growth_target` (JSON blobs)
- Screening Manager's notes (`vsmNotes` param)
- Corporate presentation text (extracted from URL, truncated at 8,000 chars)

---

## SCALE Dimensions & Rating Criteria

| # | Dimension | Green | Yellow | Red |
|---|-----------|-------|--------|-----|
| 1 | **Size** | Core ₹25Cr–₹85Cr ARR; Select ₹85Cr–₹425Cr ARR; Prime ₹4Cr+ with path to ₹25Cr in 3Y | Below threshold but showing growth momentum | Significantly below minimum / pre-revenue |
| 2 | **Sector** | 8%+ 3Y CAGR, projected above GDP | 5–8% CAGR (GDP-level) or mixed | Stagnant, declining, or structural headwinds |
| 3 | **Capital** | Positive cash flow & PAT (SMBs) / 12+ mo runway (startups) | Cash-positive but PAT-negative / 6–12 mo runway | Negative cash + PAT / <6 mo runway / not disclosed |
| 4 | **Ambition** | 8%+ incremental CAGR, doubles in 5Y (Core/Select) or 3Y (Prime) | 4–8% CAGR | <4% CAGR or no clear target |
| 5 | **Leadership** | Fully/Actively involved founder **AND** experienced second-line team | One signal weak/unclear | Neither signal evident |
| 6 | **Jobs / Employment** | 50+ (Core/Prime) / 150+ (Select) | 25–49 (Core/Prime) / 75–149 (Select) | <25 (Core/Prime) / <75 (Select) |
| 7 | **Venture Clarity** | All selected growth dimensions specific & concrete | At least one clear; others vague | Most/all vague despite being selected |

### Key Calculation Rules

- **Size**: Program tier is inferred from revenue — <₹25Cr → Prime, ₹25–85Cr → Core, ₹85Cr+ → Select. State inferred tier in the brief.
- **Sector**: MUST use `web_search` tool. Search "[sector] India market size CAGR growth" and cite data in the brief.
- **Ambition**: `revenue_potential_3y` is **incremental** on top of base. Formulas:
  - Incremental % = `(revenue_potential_3y / revenue_12m) × 100`
  - CAGR = `((revenue_12m + revenue_potential_3y) / revenue_12m)^(1/3) − 1`
  - State both in the brief.
- **Venture Clarity**: Only evaluate the dimensions the applicant selected. Don't penalize for unselected dimensions.
- **Missing data**: Default to Red (or Yellow if partially available) and state what's missing.

### Revenue Value Handling
- Numeric values in Cr (e.g. `"25"` = ₹25Cr) → use directly
- Legacy text ranges (e.g. `"5Cr-25Cr"`) → use midpoint
- `"50Cr+"` → use ₹50Cr

---

## Output Format

```json
{
  "scorecard": [
    {
      "dimension": "Size",
      "assessment": "Current Revenue",
      "rating": "Green | Yellow | Red",
      "brief": "<exactly 2 sentences: sentence 1 = data point; sentence 2 = rating rationale>"
    },
    { "dimension": "Sector", "assessment": "Growth Sector", ... },
    { "dimension": "Capital", "assessment": "Balance Sheet Strength", ... },
    { "dimension": "Ambition", "assessment": "Revenue Addition", ... },
    { "dimension": "Leadership", "assessment": "Committed Team", ... },
    { "dimension": "Jobs / Employment Generation Potential", "assessment": "Direct Jobs Creation (3Y)", ... },
    { "dimension": "Venture Clarity", "assessment": "New Venture Definition", ... }
  ]
}
```

## TypeScript Schema

```typescript
interface ScorecardDimension {
    dimension: string;
    assessment: string;
    rating: 'Green' | 'Yellow' | 'Red';
    brief: string;                    // exactly 2 sentences
}

interface AIInsights {
    scorecard: ScorecardDimension[];  // always 7 items
    generated_at: string;             // ISO timestamp
}
```

---

## Brief Writing Rules

1. **Exactly 2 sentences** per dimension. No more, no less.
2. **Sentence 1**: State the key data point or finding specific to this venture.
3. **Sentence 2**: Explain the implication or why it maps to the given rating.
4. **Dynamic content only** — reference the venture's actual data. No generic boilerplate.
5. **Strip citation tags** (`<cite>`, `</cite>`) from output.

---

## Fallback Behavior

If Claude's response fails to parse or has fewer than 7 items, a `FALLBACK_SCORECARD` (aiService.ts:311-319) is returned — all 7 dimensions rated `Yellow` with the message *"Automated analysis incomplete. Manual review required."*

---

## Data Flow

```
VSM Dashboard → click "Generate AI Analysis"
      │
      ▼
POST /api/ventures/:id/generate-insights?type=screening
      │
      ├── 1. Verify role (success_mgr, venture_mgr, committee_member, admin)
      ├── 2. Fetch venture + application + venture_streams data from Supabase
      ├── 3. Extract corporate presentation text (if available)
      ├── 4. Call Claude with web_search tool (up to 3 uses)
      ├── 5. Parse JSON response (validate 7 items)
      ├── 6. Strip <cite> tags
      ├── 7. Save to venture_assessments.ai_analysis
      │
      ▼
Return AIInsights to frontend
```
