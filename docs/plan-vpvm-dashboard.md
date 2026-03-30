# Plan: VP/VM Dashboard

## Context
VP/VM candidates (Venture Managers for Prime, Venture Partners for Core/Select) are assigned to ventures by ops managers. They need their own dashboard to see and manage their assigned ventures portfolio — showing summary metrics (venture count, revenue, jobs) and a card grid of assigned ventures.

Currently these users share `venture_mgr`/`committee_member` roles with panel members but are distinguished by NOT being in the `panelists` table. They need a separate route and dashboard since the existing panel dashboards (`VentureManagerDashboard`, `SelectionCommitteeDashboard`) show all program ventures, not user-assigned ones.

---

## Step 1: Routing — Detect VP/VM vs Panelist

**File: `src/App.tsx`**

The challenge: `venture_mgr` and `committee_member` roles are shared between panelists and VP/VM candidates. We need to route them to different dashboards.

Approach: In the role-based redirect logic (likely in App.tsx or a ProtectedRoute component), check if the logged-in user is a panelist. If not, redirect to `/vpvm/dashboard` instead of `/vmanager/dashboard` or `/committee/dashboard`.

- Fetch panelists list on auth, check if current user's name is in it
- Panelists → existing panel dashboard routes
- Non-panelists (VP/VM) → new `/vpvm/dashboard` route

**New routes:**
```
/vpvm/dashboard           → VPVMLayout → VPVMDashboard
/vpvm/dashboard/venture/:id → VPVMLayout → VPVMVentureDetail
```

---

## Step 2: VPVMLayout Component

**New file: `src/layouts/VPVMLayout.tsx`**

Follow the `OpsManagerLayout.tsx` pattern (simpler sidebar):
- Sidebar with "Wadhwani Accelerate" logo
- Nav item: "My Ventures" (icon: Building)
- Bottom: "Settings" link + user profile with sign-out
- Main content area with `<Outlet />`

---

## Step 3: VPVMDashboard Page

**New file: `src/pages/VPVMDashboard.tsx`**

### Data Fetching
- Query ventures where `assigned_vm_id = current_user.id` AND status in `['With VP/VM', 'Active', 'Completed']`
- Join with `venture_applications` to get revenue/jobs data
- Use Supabase client directly (like OpsManagerDashboard pattern)

### Summary Cards (3 cards)
1. **No. of Ventures** — count of assigned ventures
2. **Revenue** — Current (sum of `revenue_12m`) + Incremental (sum of `revenue_potential_3y`)
3. **Jobs** — Current FTE (sum of `full_time_employees`) + Incremental jobs (sum of `target_jobs` or `incremental_hiring`)

Reuse `formatRevenue()` and `formatEmployees()` from `src/utils/formatters.ts`.

### Filters
- Search by company name (text input)
- Status filter dropdown ("All Statuses", "With VP/VM", "Active", "Completed")

### Venture Cards (grid, 3 columns)
Each card shows:
- Business name + status dot (green/amber/red based on venture health)
- Founder name, City, Program (Prime/Core/Select)
- Revenue: Current + Target
- Jobs: Current + Target

Cards are clickable → navigate to `/vpvm/dashboard/venture/:id` (detail page).

---

## Step 3b: VPVMVentureDetail Page

**New file: `src/pages/VPVMVentureDetail.tsx`**

**Route:** `/vpvm/dashboard/venture/:id`

When a VP/VM clicks a venture card, they see a full detail page with:

### Header
- Venture name (large) + "View Details" button (links to full venture details if needed)
- Subtext: Name, City, Program

### Key Performance Indicators (collapsible section)
- Revenue: Current + Incremental revenue
- Jobs: Current FTE + Incremental Jobs
- Months in Program: calculated from joined date
- Status: green/amber/red dot

### Panel Scorecard (collapsible)
- Show panel feedback data if available

### Roadmap (collapsible, with "Edit Roadmap" action)
- 6 stream cards in 3x2 grid: Product, Go-To-Market, Team, Financial Planning, Supply Chain, Operations
- Each card shows: stream name, status badge (Don't need help / Need guidance / Need deep support), Goal text
- Reuse `venture_streams` data and `StatusSelect` component patterns

### Interactions (collapsible, with "+ Add Interaction" button)
- List of interactions (calls, meetings, notes)
- Reuse `InteractionsSection` component if it exists, or build similar

### Generate Streams
- Button to generate streams and deliverables (reuse existing `generate-roadmap` API)

**Data:** Fetch via `api.getVenture(id)` which returns venture + streams + milestones.

---

## Step 4: Backend — Filter Ventures for VP/VM

**File: `backend/src/services/ventureService.ts`** (`getVentures` function)

Currently `venture_mgr` and `committee_member` see all ventures. We need to support filtering by `assigned_vm_id` without breaking existing panel member access.

Approach: Add a query parameter `assigned_to_me=true` that the VP/VM dashboard passes. When present, filter by `assigned_vm_id = userId`.

```
GET /api/ventures?assigned_to_me=true
```

In `getVentures()`: if `assigned_to_me` query param is truthy, add `.eq('assigned_vm_id', userId)`.

This avoids needing to distinguish roles in the backend — the frontend decides which filter to use.

---

## Step 5: Wire Up Auth Redirect

**File: `src/App.tsx`** (or wherever role-based redirects happen)

Add logic to detect VP/VM candidates and redirect them:
- On login, if role is `venture_mgr` or `committee_member`:
  - Check if user's name is in the `panelists` table
  - If yes → existing panel routes
  - If no → redirect to `/vpvm/dashboard`

---

## Key Files

| File | Action |
|------|--------|
| `src/App.tsx` | Add `/vpvm/dashboard` routes, VP/VM redirect logic |
| `src/layouts/VPVMLayout.tsx` | **New** — sidebar layout |
| `src/pages/VPVMDashboard.tsx` | **New** — portfolio card grid + summary metrics |
| `src/pages/VPVMVentureDetail.tsx` | **New** — venture detail with KPIs, roadmap, interactions |
| `backend/src/services/ventureService.ts` | Add `assigned_to_me` filter support |
| `src/utils/formatters.ts` | Reuse existing `formatRevenue`, `formatEmployees` |

---

## Test Users

| Email | Name | Role | Password |
|-------|------|------|----------|
| `vm1.prime@wadhwanifoundation.org` | Ankit Sharma | VM (Prime) | Wadhwani123456 |
| `vm2.prime@wadhwanifoundation.org` | Priya Menon | VM (Prime) | Wadhwani123456 |
| `vp1.coreselect@wadhwanifoundation.org` | Deepak Nair | VP (Core/Select) | Wadhwani123456 |
| `vp2.coreselect@wadhwanifoundation.org` | Meera Iyer | VP (Core/Select) | Wadhwani123456 |

---

## Verification
1. Run `npm run build` for both frontend and backend
2. Log in as a VP/VM user (e.g., `vm1.prime@wadhwanifoundation.org` / `Wadhwani123456`)
3. Verify redirect to `/vpvm/dashboard`
4. Verify only assigned ventures appear
5. Verify summary metrics calculate correctly
6. Verify search and status filter work
7. Click a venture card → verify detail page loads with KPIs, roadmap, interactions
