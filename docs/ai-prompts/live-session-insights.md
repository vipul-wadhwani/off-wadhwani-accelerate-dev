# Live Session Insight Snapshot — Production Prompt

**Last Updated:** 2026-04-22

## Purpose

Generate a **brief insight snapshot** from the most recent portion of a live meeting transcript. Returns a 2–3 sentence summary of what was just discussed plus 3–5 follow-up questions the VP/expert should ask.

Intended to run periodically during a live session so the mentor has fresh context without reading the full transcript.

**Source:** `backend/src/modules/liveSession/insightService.ts` → `generateInsightSnapshot()` (lines 15–60)
**Prompt literal:** lines 16–27

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 512 |
| **Temperature** | default (not set) |
| **Tools** | None |
| **Transcript slice** | First 3,000 chars of the recent transcript chunk passed in |
| **Storage** | `session_insight_snapshots` (`is_final: false`) |
| **Fallback** | On error, returns `null` (no snapshot saved) |

---

## Input Data

- `sessionId` — target row in `mentor_sessions`
- `recentTranscript` — string; truncated to 3,000 chars before prompting
- `topic` (optional) — session topic; defaults to *"Expert session"*

---

## Prompt Template

```
You are analyzing a live meeting transcript. Generate a brief insight snapshot.

Topic: <topic or "Expert session">

Recent transcript:
<recentTranscript sliced to 3000 chars>

Return a JSON object (no markdown):
{
  "summary": "2-3 sentence summary of what was just discussed",
  "questions": ["3-5 follow-up questions the VP/expert should ask based on the discussion"]
}
```

---

## Output Format

```json
{
  "summary": "2-3 sentence summary of what was just discussed",
  "questions": [
    "Follow-up question 1",
    "Follow-up question 2",
    "Follow-up question 3"
  ]
}
```

Saved as a row in `session_insight_snapshots`:

| Column | Source |
|--------|--------|
| `session_id` | input arg |
| `summary` | `insight.summary` |
| `questions` | `insight.questions` (defaults to `[]`) |
| `transcript_length` | `recentTranscript.length` |
| `is_final` | `false` |

---

## Related

- The **final** snapshot for a session (`is_final: true`) is inserted by `endSession()` in `summaryService.ts` using the full meeting-summary prompt — see [meeting-summary.md](./meeting-summary.md).
