# Pre-Meeting Brief — Prompt Reference

> **Source:** `backend/src/modules/preMeetingBrief/briefService.ts`
> **Model:** `claude-sonnet-4-20250514` | **Max tokens:** 4096
> **Endpoint:** `POST /api/briefs/generate` (requires `session_id`)

---

## How It Works

When a VP/VM clicks "Generate Brief" for an upcoming or completed session, the backend:

1. Fetches context from **5 data sources** (see below)
2. Assembles a structured prompt
3. Sends it to Claude
4. Parses the JSON response and saves it as a new versioned brief (never overwrites)

Briefs are cached in-memory for 5 minutes per session to avoid repeated DB hits.

---

## Input Context (5 Data Sources)

### 1. Application Form
**Table:** `venture_applications`
**Fields used:**
- `product_description`, `problem_statement`, `support_request`, `blockers`
- `revenue_12m`, `full_time_employees`
- `what_do_you_sell`, `who_do_you_sell_to`, `which_regions`
- `business_type`, `current_product`, `current_segment`, `current_geography`
- `focus_product`, `focus_segment`, `focus_geography`
- `growth_focus`, `incremental_hiring`

Also pulls from `ventures` table: `name`, `founder_name`, `city`, `state`, `status`

### 2. Panel Scorecard & Feedback
**Table:** `panel_feedback` (latest entry for the venture)
**Fields used:**
- **Ratings (1-5):** `rating_financial_health`, `rating_leadership`, `rating_clarity_expansion`
- **Insights:** `insights_financial_health`, `insights_leadership`
- **Financials:** `annual_revenue_actuals`, `projected_annual_revenue`
- **Expansion:** `proposed_expansion_idea`, `expansion_idea_description`, `market_entry_routes`
- **Assessment:** `final_recommendation`, `risks_red_flags`, `current_progress`
- **Program:** `program_category`, `support_type_proposal`
- **Stream statuses + comments:** GTM, Product/Quality, Operations, Supply Chain, Org Design, Finance
- **Meta:** `panel_date`, `panel_expert_name`, `sme_name`, `business_overview`

### 3. Panel Gate Questions
**Table:** `venture_assessments` (latest entry with gate questions)
**Field:** `gate_questions` (JSONB containing array of 6 questions)

### 4. Previous Session Transcripts
**Table:** `meeting_transcripts`
- Last **5** sessions (by date)
- Up to **1,500 characters** per transcript
- Labeled with session date for context
- **Conditional:** Only included if past sessions exist (not for first connect)

### 5. Outstanding Action Items
**Table:** `meeting_summaries` → `action_items` (JSONB array)
- Extracted from all past session summaries
- Flattened into a numbered list
- **Conditional:** Only included if past sessions exist (not for first connect)

---

## Prompt Template

```
You are preparing a pre-meeting brief for a venture partner who is about to
meet with an entrepreneur. Generate a structured brief using ALL the context
provided below.

## Venture Profile
Company: {name}
Founder: {founder_name}
Location: {city, state}
Revenue: {revenue_12m}
Employees: {full_time_employees}
Status: {status}
Product: {product_description}
Problem Statement: {problem_statement}
Support Needed: {support_request}
Current Blockers: {blockers}
What They Sell: {what_do_you_sell}
Target Customers: {who_do_you_sell_to}
Regions: {which_regions}
Business Type: {business_type}
Current Product: {current_product}
Current Segment: {current_segment}
Current Geography: {current_geography}
Focus Product: {focus_product}
Focus Segment: {focus_segment}
Focus Geography: {focus_geography}
Growth Focus: {growth_focus}
Incremental Hiring: {incremental_hiring}

## Upcoming Session
Topic: {topic}
Date: {scheduled_date}

## Panel Feedback & Scorecard          ← only if panel feedback exists
Panel Date: {panel_date}
Panel Expert: {panel_expert_name}
SME: {sme_name}
Business Overview: {business_overview}
Annual Revenue (Actuals): {annual_revenue_actuals}
Projected Annual Revenue: {projected_annual_revenue}
Rating — Financial Health: {rating}/5
Rating — Leadership: {rating}/5
Rating — Clarity of Expansion: {rating}/5
Financial Health Insights: {insights}
Leadership Insights: {insights}
Proposed Expansion: {expansion_idea}
Expansion Details: {description}
Market Entry Routes: {routes}
Current Progress: {progress}
Risks & Red Flags: {risks}
Final Recommendation: {recommendation}
Program Category: {category}
Support Type: {type}
Stream GTM: {status} — {comments}
Stream Product/Quality: {status} — {comments}
Stream Operations: {status} — {comments}
Stream Supply Chain: {status} — {comments}
Stream Org Design: {status} — {comments}
Stream Finance: {status} — {comments}

## Panel Gate Questions                 ← only if gate questions exist
1. {question_1}
2. {question_2}
...
6. {question_6}

## Past Sessions ({count} total)
- {date}: {topic} ({status})
  Summary: {summary_text (first 200 chars)}

## Outstanding Action Items             ← only if past sessions exist
1. {action_item_title}
2. {action_item_title}
...

## Recent Transcript Excerpts           ← only if past sessions exist
[Session {date}]
{full_text (first 1500 chars)}
---
[Session {date}]
{full_text (first 1500 chars)}
...
```

---

## Output Structure (JSON)

```json
{
  "summary": "2-3 paragraph overview of the venture, their progress, and current situation. Incorporates insights from the application form, panel feedback, and any past interactions.",
  "red_flags": ["concerns, inconsistencies, or risks — from panel feedback, scorecard ratings, past transcripts, and information gaps"],
  "focus_areas": ["3-5 specific topics to cover in this meeting based on panel gate questions, feedback, and their needs"],
  "key_questions": ["5 sharp, specific questions informed by panel feedback, gate questions, and past discussion context"],
  "action_items": ["outstanding action items from previous sessions that should be followed up on"],
  "progress_summary": "1-2 sentence trajectory summary — improving, stagnating, or declining? References panel scores and past session trends."
}
```

---

## Notes

- **First connect (no past sessions):** Transcript excerpts, action items, and past session sections are omitted. The brief focuses on application form + panel feedback + gate questions.
- **Versioning:** Each generation creates a new version (v1, v2, ...). Previous versions are accessible via `GET /api/briefs/:sessionId/history`.
- **Caching:** In-memory cache with 5-minute TTL per session. Cache is cleared after a new brief is generated.
- **Fallback:** If Claude fails, a basic fallback brief is saved with venture name + product description.
