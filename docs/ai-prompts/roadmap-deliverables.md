# Roadmap Deliverables — Production Prompt

**Last Updated:** 2026-04-22

## Purpose

Convert a generated venture roadmap into **4–5 concrete, trackable deliverables per stream**, across all 6 functional streams (Product, GTM, Capital Planning, Team, Supply Chain, Operations).

Runs as a second-stage step after the roadmap itself (see [venture-journey-roadmap.md](./venture-journey-roadmap.md)). The roadmap gives strategic actions; this prompt turns them into discrete work items the venture team or VP/VM can mark as done.

**Source:** `backend/src/services/aiService.ts` → `generateDeliverables()` (lines 950–1032)
**Prompt literal:** lines 966–996

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 4,000 |
| **Temperature** | 0 (deterministic) |
| **Tools** | None |
| **Preconditions** | `ANTHROPIC_API_KEY` must be set (throws otherwise) |
| **Fallback** | None — errors surface as `Failed to generate deliverables: <msg>` |

---

## Input Data

### `ventureContext`
- `name`, `founder_name`, `what_do_you_sell`, `growth_focus`

### `roadmapData`
The generated roadmap object. Each of the 6 stream keys (`product`, `gtm`, `capital_planning`, `team`, `supply_chain`, `operations`) contributes:
- `end_goal` — stream-level goal
- `support_status` — applicant's self-assessed need (e.g., *Need some advice*, *Need help*)
- `actions` — array of `{ title, description }` items

Flattened into the prompt as:
```
### <stream_key> (Support: <support_status>)
Goal: <end_goal>
Actions:
- <action.title>: <action.description>
- ...
```

---

## Prompt Template

```
You are a venture growth advisor. Based on the roadmap below, generate 4-5 specific, actionable deliverables for each of the 6 streams. Each deliverable should be a concrete, measurable work item that the venture team or VP/VM can track.

**Venture:** <ventureContext.name>
**Founder:** <ventureContext.founder_name>
**Business:** <ventureContext.what_do_you_sell>
**Growth Focus:** <ventureContext.growth_focus>

**Roadmap:**
<streamSummaries>

**Instructions:**
- Generate 4-5 deliverables per stream
- Each deliverable title should be 5-10 words, specific and actionable (e.g., "Develop Core API Specifications for Real-time Sensor Data Ingestion")
- Each description should be 1-2 sentences explaining the deliverable
- Deliverables should progress from foundational to advanced within each stream
- Make deliverables specific to THIS venture's context, not generic

Return ONLY a JSON object with this structure:
{
  "product": [
    { "title": "...", "description": "..." },
    ...
  ],
  "gtm": [...],
  "capital_planning": [...],
  "team": [...],
  "supply_chain": [...],
  "operations": [...]
}

Return ONLY the JSON, no additional text.
```

---

## Output Format

Claude returns a JSON object keyed by stream; the backend then:

1. Matches the JSON against the 6-key response structure.
2. Takes at most 5 items per stream (`slice(0, 5)`).
3. Normalizes each item into the final deliverable shape with `status: 'pending'` and `display_order` 1-indexed.

```typescript
type StreamKey = 'product' | 'gtm' | 'capital_planning' | 'team' | 'supply_chain' | 'operations';

interface Deliverable {
    title: string;           // 5-10 words
    description: string;     // 1-2 sentences
    status: 'pending';       // always 'pending' on generation
    display_order: number;   // 1-indexed within stream
}

type DeliverablesByStream = Record<StreamKey, Deliverable[]>;
```

Missing / malformed streams default to `[]`.
