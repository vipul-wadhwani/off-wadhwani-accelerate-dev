# Expert Workbench — Modular Implementation Plan

## Context
Client requires an Expert Workbench where VPs, Ventures, and Experts never leave the platform — meetings are embedded, briefs are AI-generated, and expert matching happens in-context. Everything must be **modular** (`src/modules/<Module>/`) so it can be unplugged and reused in other platforms.

---

## Module Structure

### Frontend
```
src/modules/
  Zoom/                          # Embedded Zoom Meeting SDK
    components/ZoomMeetingRoom.tsx, ZoomToolbar.tsx
    hooks/useZoomSignature.ts, useZoomMeeting.ts
    types.ts, index.ts

  Availability/                  # Expert availability management
    components/AvailabilityGrid.tsx, SlotPicker.tsx, ManageAvailabilityPage.tsx
    hooks/useAvailability.ts
    types.ts, index.ts

  ExpertMatching/                # AI-powered expert discovery
    components/DiscoverExpertsPage.tsx, ExpertMatchCard.tsx, MatchResultsPanel.tsx, VPMatchExperts.tsx
    hooks/useExpertMatch.ts, useExpertSearch.ts
    types.ts, index.ts

  MeetingRequests/               # Request lifecycle
    components/CreateRequestModal.tsx, RequestCard.tsx, RequestListPage.tsx, ExpertRequestInbox.tsx
    hooks/useRequests.ts
    types.ts, index.ts

  PreMeetingBrief/               # AI brief generation + history
    components/BriefPanel.tsx, BriefHistoryList.tsx, GenerateBriefButton.tsx
    hooks/useBrief.ts
    types.ts, index.ts

  LiveSession/                   # In-meeting experience (the integration point)
    components/LiveSessionPage.tsx, RightPanel.tsx, TranscriptPanel.tsx, InsightsPanel.tsx, ActionItemsPanel.tsx, QuickActions.tsx
    hooks/useTranscript.ts, useLiveInsights.ts
    types.ts, index.ts

  Intelligence/                  # Market intelligence (Phase 5, lower priority)
    components/IntelligenceDashboard.tsx
    hooks/useIntelligence.ts
    types.ts, index.ts
```

### Backend
```
backend/src/modules/
  zoom/          zoomRoutes.ts, zoomSdkService.ts
  availability/  availabilityRoutes.ts, availabilityService.ts
  expertMatching/ matchingRoutes.ts, matchingService.ts
  meetingRequests/ requestRoutes.ts, requestService.ts
  preMeetingBrief/ briefRoutes.ts, briefService.ts
  liveSession/   sessionRoutes.ts, transcriptService.ts, insightService.ts, summaryService.ts
```

Each module has an `index.ts` barrel export. Cross-module imports go through barrel only.

---

## Database Migration

**File:** `supabase/migrations/20260408_expert_workbench_v2.sql`

### New Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `expert_availability` | Weekly slot grid | `expert_id, day_of_week, start_time, end_time, is_recurring, specific_date, is_blocked` |
| `meeting_requests` | Request lifecycle | `venture_id, expert_id, requested_by, requested_by_role, meeting_goal, problem_statement, company_info (jsonb), preferred_date/time, status, expert_response_note, session_id (FK)` |
| `pre_meeting_briefs` | Cached AI briefs (versioned, never overwritten) | `session_id, venture_id, generated_by, brief_content (jsonb), version` |
| `meeting_transcripts` | Stored transcripts | `session_id, chunks (jsonb[]), full_text` |
| `meeting_summaries` | Post-meeting AI summaries | `session_id, summary_text, action_items (jsonb), ai_insights (jsonb)` |
| `expert_matching_cache` | Cached AI match results | `venture_id, matched_experts (jsonb), context_hash` |

### Column Additions

- `mentor_sessions`: Add `zoom_meeting_id bigint`, `zoom_meeting_password text`, `transcript_enabled boolean DEFAULT true`, `source text` (vp_scheduled / venture_request / ops_scheduled)
- `mentor_profiles`: Add `industry_sectors text[]`, `tier text`, `years_experience int`, `linkedin_url text`, `company text`, `designation text`, `is_available boolean`

---

## Implementation Phases

### Phase 1: Foundation — Zoom Embedding + Availability

#### Step 1.1: Zoom SDK Signature Backend
- **Create** `backend/src/modules/zoom/zoomSdkService.ts` — HMAC-SHA256 signature using `ZOOM_SDK_KEY`/`ZOOM_SDK_SECRET`
- **Create** `backend/src/modules/zoom/zoomRoutes.ts` — `POST /api/zoom/signature`, `GET /api/zoom/meeting/:sessionId`
- **Modify** `backend/src/services/zoomService.ts` — return `meeting_id` + `password` (not just `join_url`), store in `mentor_sessions`
- **Modify** `backend/src/routes/index.ts` — mount zoom routes
- **Test:** Call `/api/zoom/signature` with a valid meeting number, verify signature returned

#### Step 1.2: Embedded Zoom Frontend
- **Create** `src/modules/Zoom/` — `useZoomMeeting.ts` hook (dynamic import of `@zoom/meetingsdk`), `ZoomMeetingRoom.tsx` component
- **Add NPM dep:** `@zoom/meetingsdk`
- **Test:** Navigate to test page, join a Zoom meeting embedded in the browser

#### Step 1.3: Availability Backend
- **Create** `backend/src/modules/availability/` — CRUD for `expert_availability`, `getAvailableSlots(expertId, date)` minus booked sessions
- **Routes:** `GET/PUT /api/availability/:expertId`, `GET /api/availability/:expertId/slots?date=`
- **Test:** Expert sets availability, API returns correct open slots

#### Step 1.4: Availability Frontend
- **Create** `src/modules/Availability/` — `AvailabilityGrid.tsx` (weekly drag-select), `SlotPicker.tsx` (venture picks from available), `ManageAvailabilityPage.tsx`
- **Modify** `ExpertLayout.tsx` (add "Availability" nav), `App.tsx` (add route)
- **Test:** Expert sets availability via grid, venture can see available slots via SlotPicker

---

### Phase 2: Expert Matching + Meeting Requests

#### Step 2.1: Expert Matching Backend
- **Create** `backend/src/modules/expertMatching/` — Claude-powered matching (venture profile vs expert profiles), tiering rules (Liftoff → Liftoff only; Accelerate → both), cache results
- **Routes:** `POST /api/matching/find`, `GET /api/matching/experts`
- **Test:** Post venture_id, receive ranked top-5 with match rationale

#### Step 2.2: Expert Matching Frontend
- **Create** `src/modules/ExpertMatching/` — `DiscoverExpertsPage.tsx` (venture flow), `VPMatchExperts.tsx` (VP flow), `ExpertMatchCard.tsx`, `MatchResultsPanel.tsx`
- **Modify** `App.tsx` — add routes for venture and VP expert discovery
- **Test:** Venture clicks "Find Experts", sees AI-ranked cards with scores

#### Step 2.3: Meeting Requests Backend
- **Create** `backend/src/modules/meetingRequests/` — create request (auto-populate company_info from venture), accept (create Zoom meeting + `mentor_session`, link `session_id`), decline (notify), list by status
- **Routes:** `POST /api/meeting-requests`, `GET /api/meeting-requests`, `PUT /api/meeting-requests/:id/accept|decline`
- **Modify** `emailService.ts` — add request notification templates
- **Test:** Venture sends request → expert accepts → Zoom meeting created → session appears in both dashboards

#### Step 2.4: Meeting Requests Frontend
- **Create** `src/modules/MeetingRequests/` — `CreateRequestModal.tsx` (pre-filled company info + editable goal + SlotPicker), `RequestListPage.tsx` (tabs), `ExpertRequestInbox.tsx`
- **Modify** `ExpertDashboard.tsx` (add pending requests section), `ExpertLayout.tsx` (add "Requests" nav), `App.tsx`
- **Test:** End-to-end: venture discovers expert → sends request → expert accepts → session appears → both can join

---

### Phase 3: Pre-Meeting Brief + Live Session

#### Step 3.1: Pre-Meeting Brief Backend
- **Create** `backend/src/modules/preMeetingBrief/` — `generateBrief(sessionId)` pulls venture profile, past transcripts, past action items, past briefs. Claude generates structured brief. **Never overwrites** — each generation = new row with `version++`
- **Routes:** `POST /api/briefs/generate`, `GET /api/briefs/:sessionId` (latest), `GET /api/briefs/:sessionId/history`
- **Test:** Generate brief for a venture, verify structured output stored with version

#### Step 3.2: Pre-Meeting Brief Frontend
- **Create** `src/modules/PreMeetingBrief/` — `BriefPanel.tsx` (renders brief: summary, red flags, focus areas, action items), `BriefHistoryList.tsx`, `GenerateBriefButton.tsx`
- **Test:** VP clicks "Generate Brief" before meeting, sees structured brief with red flags highlighted

#### Step 3.3: Live Session Backend
- **Create** `backend/src/modules/liveSession/` — `transcriptService.ts` (append chunks, finalize to full_text), `insightService.ts` (Claude snapshot from recent transcript), `summaryService.ts` (post-meeting summary + action items)
- **Routes:** `POST /api/sessions/:id/transcript`, `GET /api/sessions/:id/transcript`, `POST /api/sessions/:id/insights`, `POST /api/sessions/:id/end`
- **Test:** Append transcript chunks, generate insight, end session → summary created

#### Step 3.4: Live Session Frontend (the core in-meeting experience)
- **Create** `src/modules/LiveSession/` — `LiveSessionPage.tsx` (left: ZoomMeetingRoom, right: RightPanel), `RightPanel.tsx` (tabs: Brief, Actions, Transcript, Insights), `TranscriptPanel.tsx`, `InsightsPanel.tsx`, `ActionItemsPanel.tsx`, `QuickActions.tsx` ("Connect to Expert", "Master Class", "Service Provider")
- **Modify** `App.tsx` — add route `/meeting/:sessionId` (accessible by mentor, venture_mgr, committee_member, entrepreneur)
- **Modify** `ExpertDashboard.tsx`, `ExpertSessions.tsx` — "Join" navigates to `/meeting/:sessionId` instead of external link
- **Test:** VP joins embedded meeting, sees live transcript, generates insight snapshot, uses "Connect to Expert" to book session mid-call

---

### Phase 4: Dashboard Integration + Post-Meeting

#### Step 4.1: VP Workbench Enhancement
- **Modify** `VPVMDashboard.tsx` — add "Upcoming Meetings" section with "View Brief" + "Join Meeting" buttons
- **Modify** `VPVMVentureDetail.tsx` — add "Match Experts" link, "Meeting History" tab (completed sessions with transcript + summary + brief)
- **Create** `src/pages/PostMeetingReview.tsx` — shared post-meeting view: brief, transcript, summary, action items, insights

#### Step 4.2: Venture Dashboard Enhancement
- **Modify** entrepreneur dashboard — add "Upcoming Meetings", "Pending Requests", "Completed Meetings" sections
- **Modify** `DashboardLayout.tsx` — add "Experts" nav item

#### Step 4.3: Expert Workbench Enhancement
- **Modify** `ExpertDashboard.tsx` — restructure: Pending Requests → Upcoming Sessions → Completed Sessions
- **Modify** `ExpertProfile.tsx` — make read-only ("managed by Resource Network")
- **Add** post-meeting review route for experts

#### Step 4.4: Auto Post-Meeting Flow
- On Zoom `onMeetingEnd` → call `POST /api/sessions/:id/end` → backend finalizes transcript + generates summary → frontend redirects to `PostMeetingReview`

---

### Phase 5: Market Intelligence (Lower Priority)
- **Create** `src/modules/Intelligence/` + `backend/src/modules/intelligence/` — Claude analyzes session summaries → generates market insight cards by sector/geography/theme

---

## Dependency Graph

```
Phase 1.1 (Zoom BE) ──────── Phase 1.3 (Availability BE)
    │                              │
Phase 1.2 (Zoom FE)          Phase 1.4 (Availability FE)
    │                              │
    └──────────┬───────────────────┘
               │
Phase 2.1 (Matching BE) ──── Phase 2.3 (Requests BE)  ← uses Zoom meeting creation
    │                              │
Phase 2.2 (Matching FE)      Phase 2.4 (Requests FE)  ← uses SlotPicker
    │                              │
    └──────────┬───────────────────┘
               │
Phase 3.1 (Brief BE) ──────── Phase 3.3 (LiveSession BE)
    │                              │
Phase 3.2 (Brief FE)         Phase 3.4 (LiveSession FE)  ← uses Zoom + Brief + Matching
    │                              │
    └──────────┬───────────────────┘
               │
        Phase 4 (Dashboard wiring)
               │
        Phase 5 (Intelligence)
```

Within each phase, .1/.3 (backend) can run in parallel, then .2/.4 (frontend) can run in parallel.

---

## Key Technical Decisions

1. **Zoom Meeting SDK** (Component View) — renders inside a div, not iframe. Uses `ZOOM_SDK_KEY`/`ZOOM_SDK_SECRET` for client signatures. Separate from existing S2S OAuth (which creates meetings).

2. **Transcript capture** — Zoom SDK `onCaptionMessage` callback captures live captions. Frontend sends chunks to backend every 30 seconds. No webhooks needed.

3. **Brief versioning** — Briefs are NEVER overwritten. Each generation = new row with incremented version. History always available.

4. **Module boundaries** — Cross-module imports only through `index.ts` barrel. `LiveSession` is the integration point that imports from `Zoom`, `PreMeetingBrief`, `ExpertMatching`, and `Availability`.

5. **Backend module pattern** — Each module exports routes that are mounted in `backend/src/routes/index.ts`. Services follow existing patterns (Anthropic SDK, Supabase service client).

---

## File Count Estimate

| Phase | New Files | Modified Files |
|-------|-----------|----------------|
| 1 (Zoom + Availability) | ~14 | 4 |
| 2 (Matching + Requests) | ~16 | 6 |
| 3 (Brief + LiveSession) | ~18 | 5 |
| 4 (Dashboard wiring) | ~3 | 8 |
| 5 (Intelligence) | ~4 | 2 |
| **Total** | **~55** | **~25** |

---

## Env Vars Required

Already configured: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ANTHROPIC_API_KEY`
Needs values: `ZOOM_SDK_KEY`, `ZOOM_SDK_SECRET` (from Zoom Meeting SDK app — separate from S2S OAuth app)

---

## Verification (per phase)

1. **Phase 1:** Expert sets availability → Zoom meeting joins embedded in browser
2. **Phase 2:** Venture discovers experts (AI top 5) → sends request → expert accepts → Zoom meeting created → both see in dashboard
3. **Phase 3:** VP generates AI brief → joins embedded meeting → sees live transcript + brief + actions in right panel → ends meeting → summary generated
4. **Phase 4:** All three dashboards (VP, Venture, Expert) show complete meeting lifecycle — upcoming, active, completed with full post-meeting artifacts
