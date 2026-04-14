# AI Test Framework — Module Documentation

> This file travels with the module. When you copy the module to a new branch,
> read this file first — it tells you exactly what to add and where.

---

## Purpose

A developer/stakeholder tool for testing AI features against real venture data
in any environment. Stakeholders can:

- Select any venture from the database
- Choose a feature to test (Screening Scorecard, Panel Scorecard, Journey Roadmap)
- See exactly what input context gets sent to the AI
- View and tweak the prompt before running
- Run the test and see a rendered output (not just raw JSON)

**This module never writes to the database.** It is read-only + AI call only.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Admin Browser (React)                               │
│  src/modules/TestFramework/                          │
│    TestFrameworkPage.tsx  ←  3-panel UI              │
│    api.ts                 ←  typed fetch wrapper      │
│    components/            ←  VentureSelector,        │
│                               FeatureSelector,        │
│                               ContextPanel,           │
│                               ScorecardOutput,        │
│                               RoadmapOutput           │
└──────────────┬──────────────────────────────────────┘
               │  fetch /api/test-framework/*
               │  (Bearer token — Supabase JWT)
┌──────────────▼──────────────────────────────────────┐
│  Express Backend                                      │
│  backend/src/modules/testFramework/                  │
│    routes.ts   ←  3 endpoints (GET ventures,         │
│                                GET context/:id/:feat, │
│                                POST run)              │
│    prompts.ts  ←  self-contained prompt builders     │
│    cache.ts    ←  in-memory TTL Map (no Redis)       │
└──────────────┬──────────────────────────────────────┘
               │  read-only SELECT queries
               │  + Anthropic API call (POST /run only)
┌──────────────▼──────────────────────────────────────┐
│  Supabase (read-only)   +   Anthropic Claude API      │
└─────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Zero DB writes** | Safe to run in any environment — staging, prod, any branch |
| **Self-contained prompts** | `prompts.ts` duplicates the prompt logic from `aiService.ts`. The module has no import dependency on any existing service file. It can be dropped into any branch independently. |
| **In-memory TTL cache** | Venture list cached 5 min, context cached 5 min per (ventureId, feature). No Redis, no DB table. Cache is lost on server restart. |
| **Prompts are editable** | The frontend shows the fully rendered prompt in a textarea. Users can tweak it before running — this is the core testing use case. |
| **Admin-only access** | Routes require `authenticateUser` middleware. The frontend route is under `ProtectedRoute allowedRoles={['admin']}`. |
| **No AdminDashboard modification** | The page is a standalone route at `/admin/test-framework`, accessible via the admin sidebar nav item. No changes to `AdminDashboard.tsx`. |
| **Prompt sync note** | `prompts.ts` is intentionally a copy of the prompts in `aiService.ts`. When prompts are updated in production (`aiService.ts`), update `prompts.ts` in this module too. Search for `// Keep in sync with aiService.ts` in `prompts.ts`. |

---

## Complete File Structure

```
src/modules/TestFramework/            ← Frontend module (this folder)
├── CLAUDE.md                         ← This file
├── index.ts                          ← Re-exports TestFrameworkPage
├── types.ts                          ← All TypeScript interfaces
├── api.ts                            ← Typed fetch client for backend endpoints
├── TestFrameworkPage.tsx             ← Main 3-panel page component
└── components/
    ├── VentureSelector.tsx           ← Searchable venture dropdown
    ├── FeatureSelector.tsx           ← Feature radio cards (Screening/Panel/Roadmap)
    ├── ContextPanel.tsx              ← Collapsible JSON viewer + Prompt editor (tabs)
    ├── ScorecardOutput.tsx           ← SCALE scorecard + Panel scorecard renderers
    └── RoadmapOutput.tsx             ← 6-stream roadmap renderer

backend/src/modules/testFramework/    ← Backend module
├── cache.ts                          ← Simple TTL Map cache
├── prompts.ts                        ← Self-contained prompt builders (all 3 features)
├── routes.ts                         ← 3 REST endpoints + local JSON parsers
└── index.ts                          ← Re-exports testFrameworkRoutes
```

---

## Integration Checklist — Adding to a New Branch

When you copy both module folders to a new branch, make exactly **3 small changes**
to existing files. Nothing else needs to be touched.

---

### Change 1 of 3 — `backend/src/routes/index.ts`

Add 2 lines. The import goes with the other module imports (bottom of the import block).
The `router.use` goes at the end of the mount block.

```diff
  import { sessionRoutes } from '../modules/liveSession';
+ import { testFrameworkRoutes } from '../modules/testFramework';

  // ...existing mounts...
  router.use('/sessions', sessionRoutes);
+ router.use('/test-framework', testFrameworkRoutes);
```

**Exact location:** After the last existing `import` line and after the last existing
`router.use(...)` line in that file.

---

### Change 2 of 3 — `src/layouts/AdminLayout.tsx`

Add `FlaskConical` to the lucide-react import and add one nav item to `navItems`.

```diff
- import { Rocket, LayoutDashboard, Users, BarChart3, Building2, LogOut } from 'lucide-react';
+ import { Rocket, LayoutDashboard, Users, BarChart3, Building2, LogOut, FlaskConical } from 'lucide-react';

  const navItems = [
      { to: '/admin/dashboard', label: 'Application Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/dashboard/ventures', label: 'Venture Dashboard', icon: Building2, end: false },
      { to: '/admin/dashboard/screening-performance', label: 'Screening Performance', icon: BarChart3, end: false },
      { to: '/admin/dashboard/users', label: 'Users', icon: Users, end: false },
+     { to: '/admin/test-framework', label: 'AI Test Framework', icon: FlaskConical, end: false },
  ];
```

---

### Change 3 of 3 — `src/App.tsx`

Add 1 import and 1 protected route. The import goes with the other module imports.
The route goes after the closing `</Route>` of the `/admin/dashboard` block and before
the `<Route path="*" ...>` catch-all.

```diff
  import { VPVMRequestDetailPage } from './pages/VPVMRequestDetailPage';
+ import { TestFrameworkPage } from './modules/TestFramework';

  // ...inside <Routes>...

          </Route>  {/* end of /admin/dashboard nested routes */}

+         {/* AI Test Framework — standalone page under admin, no DB writes */}
+         <Route path="/admin/test-framework" element={
+           <ProtectedRoute allowedRoles={['admin']}>
+             <TestFrameworkPage />
+           </ProtectedRoute>
+         } />

          <Route path="*" element={<Navigate to="/" replace />} />
```

---

## Environment Variables Required

No new environment variables are needed. The module reuses what's already in the project:

| Variable | Used for | Already in project |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API calls (POST /run only) | Yes — used by `aiService.ts` |
| `SUPABASE_URL` | Read-only DB queries | Yes — used by `config/supabase.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role Supabase client | Yes — used by `config/supabase.ts` |
| `VITE_API_URL` | Frontend → backend URL | Yes — already in `.env` |

---

## API Endpoints

All endpoints require a valid Supabase JWT in the `Authorization: Bearer <token>` header.

| Method | Path | Cache | Description |
|---|---|---|---|
| `GET` | `/api/test-framework/ventures` | 5 min | List all ventures (id, name, founder, status) |
| `GET` | `/api/test-framework/context/:ventureId/:feature` | 5 min | Input context + rendered prompt + model config |
| `POST` | `/api/test-framework/run` | none | Run AI with custom prompt, return raw + parsed |

**feature** values: `screening` \| `panel` \| `roadmap`

### POST /run request body
```json
{
  "feature": "screening",
  "customPrompt": "... full prompt text ..."
}
```

### POST /run response
```json
{
  "success": true,
  "data": {
    "feature": "screening",
    "rawText": "... Claude's raw response ...",
    "parsed": { "scorecard": [...] },
    "durationMs": 4230
  }
}
```

---

## Model Config per Feature

| Feature | Model | Max Tokens | Temperature | Tools |
|---|---|---|---|---|
| Screening Scorecard | claude-sonnet-4-5-20250929 | 2,500 | 0.7 | web_search |
| Panel Scorecard | claude-sonnet-4-5-20250929 | 2,500 | 0.3 | web_search (max 3) |
| Journey Roadmap | claude-sonnet-4-5-20250929 | 8,000 | 0.0 | none |

---

## Input Context per Feature

### Screening Scorecard
Reads from: `ventures`, `venture_applications`

Sections shown in UI:
- `venture_profile` — name, founder, city, status
- `financials` — revenue_12m, revenue_potential_3y, financial_condition
- `team` — employees, time_commitment, second_line_team, target_jobs
- `growth_idea` — growth_focus, focus_product/segment/geography
- `current_business` — what_do_you_sell, who_do_you_sell_to, regions
- `vsm_notes` — screening manager's notes
- `corporate_presentation` — availability + character count

### Panel Scorecard
Reads from: `ventures`, `venture_applications`, `venture_assessments`, `interactions`

Sections shown in UI:
- All venture profile fields (same as screening)
- `screening_scorecard` — existing AI scorecard from screening stage
- `interactions` — count + transcript preview (last 20 interactions)
- `vsm_notes`

### Journey Roadmap
Reads from: `ventures`, `venture_applications`, `venture_assessments`, `interactions`

Sections shown in UI:
- All venture profile fields
- `screening_scorecard` — from prior screening assessment
- `panel_feedback` — from committee assessment or venture.panel_feedback
- `panel_scorecard` — from committee assessment
- `gate_questions` — from venture.gate_questions
- `interactions` — count of interaction notes

---

## Keeping Prompts in Sync

The prompts in `backend/src/modules/testFramework/prompts.ts` are intentional
copies of the production prompts in `backend/src/services/aiService.ts`.

**When the production prompts are updated:**
1. Open `backend/src/services/aiService.ts`
2. Find `buildInsightsPrompt`, `buildPanelInsightsPrompt`, `buildRoadmapPrompt`
3. Copy the updated prompt text into the corresponding function in `prompts.ts`
   - `buildInsightsPrompt` → `buildScreeningPrompt`
   - `buildPanelInsightsPrompt` → `buildPanelPrompt`
   - `buildRoadmapPrompt` → `buildRoadmapPrompt` (same name)

The test framework will then reflect the latest prompts on next context load
(cache clears after 5 min or on server restart).

---

## What This Module Does NOT Touch

- `backend/src/services/aiService.ts` — unchanged
- `backend/src/services/ventureService.ts` — unchanged
- Any database table — no INSERT, UPDATE, DELETE
- Any existing route file — only `routes/index.ts` gets 2 additive lines
- `AdminDashboard.tsx` — unchanged
- Any existing page or component — unchanged
