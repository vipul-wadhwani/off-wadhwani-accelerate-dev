# Panel SCALE Scorecard — Production Prompt

**Last Updated:** 2026-04-17

## Purpose

Generate a **Panel Recommendation** rating for each of the 7 SCALE scorecard dimensions, based on what emerged during panel interactions (call transcripts, meeting notes, panel discussion notes). The panel rating may agree with or differ from the application-stage screening rating — it reflects new information, clarifications, or concerns raised during panel conversations.

The output is a **dual-column scorecard**: each dimension carries both the `application_rating` (carried forward from screening) and a fresh `panel_rating` with a 2-sentence brief grounded in the panel discussion.

**Source:** `backend/src/services/aiService.ts` → `buildPanelInsightsPrompt()` (lines 767-891)
**Generator:** `generatePanelInsights()` (lines 715-765)

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 2,500 |
| **Temperature** | 0.3 |
| **Tools** | `web_search_20260209` (max 3 uses) |
| **API Endpoint** | `POST /api/ventures/:id/generate-insights?type=panel` |
| **Allowed Roles** | `success_mgr`, `venture_mgr`, `committee_member`, `admin` |
| **Storage** | `venture_assessments.panel_ai_analysis` (JSONB, shape: `{ panel_scorecard, generated_at }`) |

---

## When Used

Triggered when a panel member clicks **"Generate Panel Insights"** before or during the interview stage. The venture has already been screened and has an application-stage SCALE scorecard. This prompt produces the panel column so panelists can see side-by-side ratings and override where needed.

---

## Input Data

### 1. Application-Based Screening Scorecard (carried forward)
Read from `ventureData.prior_ai_analysis.scorecard` — the 7-dimension scorecard generated at screening stage. Each item's `rating` becomes the `application_rating` column.

### 2. Venture Information
- Company name, founder
- `revenue_12m`, `revenue_potential_3y`, `full_time_employees`
- `financial_condition`, `time_commitment`, `second_line_team`, `target_jobs`
- `screening_recommendation` — the VSM's prior recommendation

### 3. Current Business
- `what_do_you_sell`, `who_do_you_sell_to`, `which_regions`

### 4. New Growth Idea
- `growth_focus`, `focus_product`, `focus_segment`, `focus_geography`

### 5. Interaction Transcripts (primary panel evidence)
- Concatenated transcripts from `venture_interactions` table (calls, meetings, emails, notes)

### 6. Additional Panel Notes
- Free-text notes captured by the panelist

### 7. Screening Manager's Notes
- `vsmNotes` param

### 8. Corporate Presentation (optional)
- Extracted text, truncated at 8,000 chars

---

## Rating Logic

For each of the 7 dimensions (**Size, Sector, Capital, Ambition, Leadership, Jobs / Employment Generation Potential, Venture Clarity**):

- **If the panel discussion revealed new information that changes the rating** → set `panel_rating` accordingly and explain what changed in `panel_brief`.
- **If the panel discussion confirmed the application rating** → keep the same `panel_rating` and state what was confirmed.
- **If the dimension was not discussed** → carry forward the `application_rating` and state: *"Not discussed in panel interactions — application rating carried forward."*

The `panel_rating` is the AI's recommendation — the panelist can override it on the frontend. Optional `panel_remarks` free-text is added by the panelist.

---

## Output Format

```json
{
  "panel_scorecard": [
    {
      "dimension": "Size",
      "application_rating": "<carried from screening>",
      "panel_rating": "Green | Yellow | Red",
      "panel_brief": "<exactly 2 sentences: what was revealed + whether it changes assessment>"
    },
    { "dimension": "Sector", ... },
    { "dimension": "Capital", ... },
    { "dimension": "Ambition", ... },
    { "dimension": "Leadership", ... },
    { "dimension": "Jobs / Employment Generation Potential", ... },
    { "dimension": "Venture Clarity", ... }
  ]
}
```

## TypeScript Schema

```typescript
interface PanelScorecardDimension {
    dimension: string;
    application_rating: 'Green' | 'Yellow' | 'Red';  // from screening scorecard
    panel_rating: 'Green' | 'Yellow' | 'Red';        // AI recommendation, panelist-editable
    panel_brief: string;                              // exactly 2 sentences
    panel_remarks?: string;                           // optional free-text from panelist
}

interface PanelInsights {
    panel_scorecard: PanelScorecardDimension[];       // always 7 items
    generated_at: string;
}
```

---

## Brief Writing Rules

1. **Exactly 2 sentences** per dimension.
2. **Sentence 1**: State what was revealed or clarified during the panel discussion for this dimension.
3. **Sentence 2**: Explain whether this changes the assessment and why.
4. **Dynamic and specific** — reference actual statements from the transcripts/notes.
5. **Never use individual names** — replace with role-based references (e.g. *"the founder"*, *"the CEO"*, *"the panelist"*, *"the screening manager"*) to preserve scorecard anonymity.
6. **Strip citation tags** (`<cite>`, `</cite>`) from output.

---

## Fallback Behavior

If Claude's response fails to parse or has fewer than 7 items, `PANEL_FALLBACK_SCORECARD` (aiService.ts:893-901) is returned. The fallback populates `application_rating` from the real screening scorecard (if available) and sets `panel_rating` to `Yellow` with *"Automated analysis incomplete. Manual review required."*

---

## Data Flow

```
Panel Dashboard → click "Generate Panel Insights"
      │
      ▼
POST /api/ventures/:id/generate-insights?type=panel
      │
      ├── 1. Verify role (success_mgr, venture_mgr, committee_member, admin)
      ├── 2. Fetch venture + current assessment (incl. prior_ai_analysis.scorecard)
      ├── 3. Fetch interaction transcripts from venture_interactions
      ├── 4. Extract screening scorecard → becomes application_rating column
      ├── 5. Call Claude with web_search tool (up to 3 uses)
      ├── 6. Parse JSON response (validate 7 items)
      ├── 7. Strip <cite> tags, hydrate application_rating from screening
      ├── 8. Save to venture_assessments.panel_ai_analysis
      │
      ▼
Return PanelInsights to frontend (panelist can then edit panel_rating / panel_remarks)
```

---

## Panelist Override Flow

After generation, the panelist sees the scorecard on Panel / Selection Committee / Venture Manager dashboards with:
- `application_rating` column — locked, read-only
- `panel_rating` column — editable dropdown (Green/Yellow/Red)
- `panel_brief` — AI-generated, read-only
- `panel_remarks` — free-text, panelist-editable

Overrides are saved via `POST /api/ventures/:id/panel-assessment` which writes the full 7-item array back to `venture_assessments.panel_ai_analysis.panel_scorecard`.
