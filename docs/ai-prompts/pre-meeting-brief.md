# Pre-Meeting Brief — Production Prompt

**Last Updated:** 2026-04-22

## Purpose

Generate a structured pre-meeting brief for a VP/mentor before they meet with an entrepreneur. The brief aggregates the venture profile, panel feedback and scorecard, gate questions, past sessions + their summaries, outstanding action items, and recent transcript excerpts — then asks Claude to synthesize:

- A 2–3 paragraph summary
- Red flags / risks
- Focus areas for the meeting
- 5 sharp key questions
- Outstanding action items to follow up on
- A 1–2 sentence progress trajectory

**Source:** `backend/src/modules/preMeetingBrief/briefService.ts` → `generateBrief()` (lines 104–371)
**Prompt literal:** lines 275–303

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 4,096 |
| **Temperature** | default (not set) |
| **Tools** | None |
| **Caller** | `generateBrief(sessionId, generatedBy)` via `getOrGenerateBrief()` |
| **Concurrency** | In-memory map prevents duplicate generations for the same session |
| **Cache** | 5-minute in-memory cache on `getLatestBrief()` |
| **Storage** | `pre_meeting_briefs` — versioned (`version` increments, never overwrites) |
| **Fallback** | On error, returns transient fallback object with `is_fallback: true` (not persisted, so next click retries); error captured in Sentry with `service: pre_meeting_brief` tag |

---

## Input Data

### Session (`mentor_sessions`)
- `id`, `venture_id`, `mentor_id`, `topic`, `scheduled_date`

### Venture Profile (`ventures` + `venture_applications`)
- `name`, `founder_name`, `city`, `location`, `status`
- `revenue_12m`, `full_time_employees`
- `support_request`, `blockers`
- `what_do_you_sell`, `who_do_you_sell_to`, `which_regions`
- `focus_product`, `focus_segment`, `focus_geography`, `growth_focus`
- `incremental_hiring`

### Panel Feedback (`panel_feedback` — most recent row)
- `panel_date`, `panel_expert_name`, `sme_name`
- `business_overview`, `annual_revenue_actuals`, `projected_annual_revenue`
- Ratings (out of 5): `rating_financial_health`, `rating_leadership`, `rating_clarity_expansion`
- Narrative: `insights_financial_health`, `insights_leadership`
- Expansion: `proposed_expansion_idea`, `expansion_idea_description`, `market_entry_routes`, `current_progress`
- `risks_red_flags`, `final_recommendation`, `program_category`, `support_type_proposal`
- Stream statuses (+ comments): `stream_gtm`, `stream_product_quality`, `stream_operations`, `stream_supply_chain`, `stream_org_design`, `stream_finance`

### Gate Questions (`venture_assessments.gate_questions.gate_questions`)
Numbered list of panel gate questions.

### Past Sessions (`mentor_sessions`)
- Up to 10 previous sessions (status `ended` or `scheduled`) for the same venture, excluding the current one.

### Past Summaries (`meeting_summaries`)
- Joined by `session_id`; first 200 chars of `summary_text` inlined into the past-sessions list.

### Outstanding Actions
- Flattened from `meeting_summaries.action_items` across past sessions.

### Past Transcripts (`meeting_transcripts`)
- Up to 5 most recent; each truncated to 1,500 chars with a `[Session <date>]` header.

---

## Prompt Template

```
You are preparing a pre-meeting brief for a venture partner who is about to meet with an entrepreneur. Generate a structured brief using ALL the context provided below.

## Venture Profile
<ventureContext>

## Upcoming Session
Topic: <session.topic or "General discussion">
Date: <session.scheduled_date>

## Panel Feedback & Scorecard          (only if panelContext is present)
<panelContext>

## Panel Gate Questions                 (only if gateQuestionsContext is present)
<gateQuestionsContext>

## Past Sessions (<count> total)
<pastContext>

## Outstanding Action Items from Previous Sessions   (only if any)
<numbered list>

## Recent Transcript Excerpts           (only if any)
<transcriptContext>

Generate a JSON object (no markdown, no explanation) with these fields:
{
  "summary": "2-3 paragraph overview of the venture, their progress, and current situation. Incorporate insights from the application form, panel feedback, and any past interactions.",
  "red_flags": ["list of concerns, inconsistencies, or risks to watch for — from panel feedback, scorecard ratings, past transcripts, and any gaps in information"],
  "focus_areas": ["3-5 specific topics to cover in this meeting based on panel gate questions, feedback, and their needs"],
  "key_questions": ["5 sharp, specific questions informed by panel feedback, gate questions, and past discussion context"],
  "action_items": ["outstanding action items from previous sessions that should be followed up on"],
  "progress_summary": "1-2 sentence trajectory summary — are they improving, stagnating, or declining? Reference panel scores and past session trends."
}
```

---

## Output Format

```typescript
interface BriefContent {
    summary: string;              // 2-3 paragraphs
    red_flags: string[];
    focus_areas: string[];        // 3-5 items
    key_questions: string[];      // 5 items
    action_items: string[];
    progress_summary: string;     // 1-2 sentences
}
```

Response post-processing: strips a leading ```` ```json ```` / trailing ```` ``` ```` fence if Claude adds one despite the instruction.

Persisted row in `pre_meeting_briefs`:

| Column | Value |
|--------|-------|
| `session_id` | input arg |
| `venture_id` | `session.venture_id` |
| `generated_by` | input arg (user id) |
| `brief_content` | `BriefContent` JSONB |
| `version` | previous max version + 1 |

---

## Data Flow

```
getOrGenerateBrief(sessionId, generatedBy)
      │
      ├── 1. Fetch latest pre_meeting_briefs row → if exists, return it
      ├── 2. Check in-flight map → if generating, await existing promise
      │
      ├── 3. generateBrief(sessionId, generatedBy)
      │      ├── Fetch session, venture, application
      │      ├── Fetch latest panel_feedback
      │      ├── Fetch venture_assessments.gate_questions
      │      ├── Fetch up to 10 past sessions, their summaries, transcripts
      │      ├── Compute nextVersion = maxVersion + 1
      │      ├── Build prompt with all context
      │      ├── Call Claude
      │      ├── Strip JSON fences, parse
      │      ├── Insert row into pre_meeting_briefs (new version)
      │      └── Invalidate cache
      │
      ▼
Return saved brief (or transient fallback on error)
```
