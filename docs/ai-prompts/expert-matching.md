# Expert Matching — Production Prompt

**Last Updated:** 2026-04-22

## Purpose

Rank available experts/mentors for a given venture. Claude receives the venture's profile and the full list of available experts, then returns the top N matches with a score (0–100) and a one-sentence rationale each.

Used in the Ops/VM workbench when pairing ventures with mentors.

**Source:** `backend/src/modules/expertMatching/matchingService.ts` → `matchExperts()` (lines 97–194)
**Prompt literal:** lines 139–155

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 1,024 |
| **Temperature** | default (not set) |
| **Tools** | None |
| **Caller** | `matchExperts(ventureId, matchCount = 5)` |
| **Fallback** | On error, returns first N experts with `score: 0` and rationale *"AI matching unavailable — showing all experts"* |

---

## Input Data

### Venture Context (`ventures` + `venture_applications`)
- `name`, `founder_name`, `city`, `location`
- `program_recommendation`, `revenue_12m`, `full_time_employees`, `growth_focus`
- `product_description`, `problem_statement`, `support_request`, `blockers` (optional; only included if present)

### Expert List (`mentor_profiles` + `profiles`)
Every available expert (`is_available !== false`), flattened into a numbered list:
```
1. <full_name> | Expertise: <expertise_areas> | Industries: <industry_sectors> | Experience: <years> yrs | Company: <company>
```

---

## Prompt Template

```
You are an expert matching engine for a venture mentorship platform.

Given this venture's profile:
<ventureContext>

And these available experts:
<expertList>

Select the top <matchCount> best-matched experts for this venture. Consider:
- Expertise alignment with the venture's product, problem, and growth focus
- Industry relevance
- Experience level appropriate for the venture's stage

Return a JSON array (no markdown, no explanation) with exactly <matchCount> objects:
[{"index": 1, "score": 95, "rationale": "One sentence explaining the match"}]

Where "index" is the expert's number from the list above, "score" is 0-100 match percentage.
```

---

## Output Format

```json
[
  { "index": 1, "score": 95, "rationale": "One sentence explaining the match" },
  { "index": 4, "score": 88, "rationale": "..." }
]
```

The backend looks up each expert by `index - 1` against the original expert list and returns a `MatchedExpert[]` with full profile fields + `score` + `rationale`.

### TypeScript Schema

```typescript
interface MatchedExpert {
    expert_id: string;
    full_name: string;
    email: string;
    expertise_areas: string[];
    bio: string;
    industry_sectors: string[];
    years_experience: number | null;
    company: string | null;
    score: number;       // 0-100
    rationale: string;   // one sentence
}
```
