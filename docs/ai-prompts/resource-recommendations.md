# Resource Recommendations — Production Prompt

**Last Updated:** 2026-04-22

## Purpose

For a given deliverable, generate **exactly 4 resource recommendations** of one of four types:

- `expert_connect` — mentors / advisors
- `service_provider` — service provider companies
- `masterclass` — courses / workshops
- `research` — reports / articles / case studies

The schema and label shown to Claude differ per type, but the prompt structure is shared.

**Source:** `backend/src/services/aiService.ts` → `generateRecommendations()` (lines 1037–1094)
**Prompt literal:** lines 1060–1072

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 2,000 |
| **Temperature** | default (not set) |
| **Tools** | None |
| **Preconditions** | `ANTHROPIC_API_KEY` must be set (throws otherwise) |
| **Fallback** | None — errors surface as `Failed to generate recommendations: <msg>` |
| **Count** | Always exactly 4 |

---

## Input Data

- `type` — one of `expert_connect | service_provider | masterclass | research`
- `deliverable` — `{ title, description? }`
- `ventureContext` — `{ name, what_do_you_sell?, growth_focus? }`

---

## Per-Type Schema

Inlined into the prompt as `${schemaByType[type]}`.

| Type | Schema |
|------|--------|
| `expert_connect` | `[{ "name": "string", "title": "string (role/position)", "rating": number (4.0-5.0), "description": "string (1 sentence about their expertise)", "tags": ["string", "string", "string"] }]` |
| `service_provider` | `[{ "name": "string (company name)", "rating": number (4.0-5.0), "description": "string (1 sentence about their services)", "tags": ["string", "string"] }]` |
| `masterclass` | `[{ "title": "string", "instructor": "string", "description": "string (1 sentence)", "tags": ["string", "string", "string"], "date": "YYYY-MM-DD" }]` |
| `research` | `[{ "title": "string", "type": "Report\|Article\|Case Study", "description": "string (1 sentence)", "tags": ["string", "string", "string"] }]` |

## Per-Type Label

Inlined as `${typeLabel[type]}`.

| Type | Label |
|------|-------|
| `expert_connect` | `expert mentors/advisors` |
| `service_provider` | `service provider companies` |
| `masterclass` | `masterclass courses/workshops` |
| `research` | `research resources (reports, articles, case studies)` |

---

## Prompt Template

```
You are an AI recommendation engine for a venture growth platform. Generate exactly 4 realistic <typeLabel> that would be relevant and helpful for the following deliverable.

**Venture:** <ventureContext.name>
**Business:** <ventureContext.what_do_you_sell>
**Growth Focus:** <ventureContext.growth_focus>

**Deliverable:** <deliverable.title>
**Description:** <deliverable.description>

Return ONLY a valid JSON array with exactly 4 objects matching this schema:
<schemaByType[type]>

Make recommendations specific and relevant to the deliverable and venture context. Use realistic but fictional names. For ratings, use values between 4.5 and 4.9. For masterclass dates, use dates within the next 3 months from today.
```

---

## Output Format

A JSON array of 4 objects, shape matching the `type` argument. Parsed via `text.match(/\[[\s\S]*\]/)` then `JSON.parse`.

### Notes

- **Fictional content**: The prompt explicitly asks Claude to use *realistic but fictional* names. These are not looked up against any real directory of experts/providers.
- **Ratings**: The prompt says 4.5–4.9; the schema says 4.0–5.0. Claude generally follows the tighter 4.5–4.9 range in practice.
- **Masterclass dates**: "Within the next 3 months from today" — Claude uses its own notion of today, which may lag the real date.
