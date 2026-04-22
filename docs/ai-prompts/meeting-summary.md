# Meeting Summary — Production Prompt

**Last Updated:** 2026-04-22

## Purpose

At the end of a session, summarize the full transcript into: a 3–5 sentence narrative summary, 3–5 key takeaways, and a list of action items (each with title, assignee, status).

Saved to `meeting_summaries`, and the same summary is also inserted as the session's **final** insight snapshot (`session_insight_snapshots.is_final = true`) if no final snapshot exists yet.

**Source:** `backend/src/modules/liveSession/summaryService.ts` → `endSession()` (lines 16–112)
**Prompt literal:** lines 49–62

---

## Implementation Details

| Parameter | Value |
|-----------|-------|
| **AI Provider** | Anthropic (Claude) |
| **Model** | `claude-sonnet-4-5-20250929` |
| **Max Tokens** | 1,024 |
| **Temperature** | default (not set) |
| **Tools** | None |
| **Transcript slice** | First 8,000 chars of `meeting_transcripts.full_text` |
| **Min length** | Skipped if transcript ≤ 50 chars |
| **Storage (primary)** | `meeting_summaries` (one row per session) |
| **Storage (secondary)** | `session_insight_snapshots` (`is_final: true`, only if no existing final) |
| **Fallback** | On error, logs to console; session still ends, no summary saved |

---

## Input Data

- `sessionId` — target row in `mentor_sessions`
- Derived:
  - `fullText` — `meeting_transcripts.full_text` (after `finalizeTranscript`)
  - `session.topic` — defaults to *"Expert session"*
  - `venture.name` — joined from `ventures`; defaults to *"Unknown"*

---

## Prompt Template

```
Analyze this meeting transcript and generate a structured summary.

Topic: <session.topic>
Venture: <venture.name>

Transcript:
<fullText sliced to 8000 chars>

Return a JSON object (no markdown):
{
  "summary_text": "3-5 sentence comprehensive summary of the meeting",
  "key_points": ["3-5 key takeaways from the discussion"],
  "action_items": [{"title": "action item description", "assignee": "who should do it", "status": "pending"}]
}
```

---

## Output Format

```json
{
  "summary_text": "3-5 sentence comprehensive summary of the meeting",
  "key_points": [
    "Key takeaway 1",
    "Key takeaway 2"
  ],
  "action_items": [
    { "title": "Follow up on pricing model", "assignee": "Founder", "status": "pending" }
  ]
}
```

### TypeScript Shape

```typescript
interface MeetingSummaryResult {
    summary_text: string;                 // 3-5 sentences
    key_points: string[];                 // 3-5 items
    action_items: Array<{
        title: string;
        assignee: string;
        status: 'pending' | string;
    }>;
}
```

---

## Data Flow

```
endSession(sessionId)
      │
      ├── 1. finalizeTranscript(sessionId)
      ├── 2. getTranscript() → fullText
      ├── 3. Update mentor_sessions { status: 'ended', ended_at: now }
      ├── 4. If fullText.length > 50:
      │      ├── Call Claude with prompt above
      │      ├── Parse JSON
      │      ├── Insert into meeting_summaries
      │      └── If no final snapshot exists → insert into session_insight_snapshots (is_final: true)
      │
      ▼
Return { summary, transcript }
```
