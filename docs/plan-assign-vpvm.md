# Plan: Assign VP/VM Feature

## Context
After a panel (Prime or Core/Select) approves a venture, the ops manager needs to assign a Venture Manager (VM) for Prime or Venture Partner (VP) for Core/Select. This introduces two new statuses in the pipeline: **"Assign VP/VM"** (pending assignment) and **"With VP/VM"** (assigned, ready for scheduling).

Current flow: `Panel Review → Approved → ...`
New flow: `Panel Review → Assign VP/VM → With VP/VM → Schedule Call → ...`

The trigger point is in `PanelFeedbackForm.tsx:348` where `status: 'Approved'` is set when panel recommends "proceed". The backend will intercept this and set `'Assign VP/VM'` instead (skipping `'Approved'`).

### Decisions
- **Panel approval → directly "Assign VP/VM"** (backend intercepts `'Approved'` and overrides)
- **Prime → `venture_mgr` role users as VM candidates, Core/Select → `committee_member` role users as VP candidates**

---

## Step 1: Database Migration

**Add new statuses to the CHECK constraint** on `ventures.status`.

Current dev constraint values: `Draft, Submitted, Under Review, Panel Review, Approved, Agreement Sent, Agreement Signed, Active, Completed, Rejected, Withdrawn, Joined Program`

Migration:
- Drop `valid_status` constraint
- Re-add with `'Assign VP/VM'` and `'With VP/VM'` included
- Apply to both dev (`gheqxkxsjhkdbhmdntmh`) and prod (`jenyuppryecuirvvlvkb`)

No new columns needed - reuse existing `assigned_vm_id` (UUID) for both VP and VM assignment.

---

## Step 2: Backend - New API Endpoints

**File: `backend/src/routes/ventures.ts`**

### 2a. `GET /api/ventures/vpvm-candidates?program=<program>`
- Role: `ops_manager`, `admin`
- For Prime programs → query `profiles` where `role = 'venture_mgr'`
- For Core/Select → query `profiles` where `role = 'committee_member'`
- Return `{ candidates: [{ id, full_name, email, role }] }`
- Must be registered BEFORE `/:id` route to avoid param conflict

### 2b. `POST /api/ventures/:id/assign-vpvm`
- Role: `ops_manager`, `admin`
- Body: `{ assigned_vm_id: string }`
- Validates venture is in `'Assign VP/VM'` status
- Fetches assignee's `full_name` from profiles
- Updates venture: `assigned_vm_id`, `venture_partner` (name), status → `'With VP/VM'`

---

## Step 3: Backend - Modify Approval Flow

**File: `backend/src/services/ventureService.ts`** (in `updateVenture`)

When status is being set to `'Approved'` and the venture has a program recommendation (Prime/Core/Select), override to `'Assign VP/VM'` instead. This keeps the transition logic centralized in the service layer.

---

## Step 4: Frontend - AssignVPVMModal Component

**New file: `src/components/AssignVPVMModal.tsx`**

Following the ScheduleCallModal pattern:
- Props: `venture`, `onClose`, `onAssigned`
- On mount: fetch candidates via `GET /api/ventures/vpvm-candidates?program=...`
- Display read-only: Applicant Name, Business Name, City, Program
- Dropdown: Select VP/VM from candidates
- Footer: Cancel + Assign buttons
- On submit: `POST /api/ventures/:id/assign-vpvm`

---

## Step 5: Frontend - Update OpsManagerDashboard

**File: `src/pages/OpsManagerDashboard.tsx`**

1. Add `'Assign VP/VM'` and `'With VP/VM'` to the Supabase `.in('status', [...])` query (line 134)
2. Add `venture_partner?: string` and `city?: string` to the Venture interface
3. Add new status cases in `getDisplayStatus()` with purple styling
4. Update status badge rendering for new statuses
5. Update "Assigned To" column: show `venture_partner` for "With VP/VM" ventures
6. Update Actions column:
   - `'Assign VP/VM'` status → "Assign VP/VM" button (Users icon)
   - `'With VP/VM'` status → "Schedule Call" button
7. Add state + render for AssignVPVMModal

---

## Step 6: Frontend - Update api.ts

**File: `src/lib/api.ts`**

Add methods:
- `getVPVMCandidates(program: string)` → `GET /api/ventures/vpvm-candidates?program=...`
- `assignVPVM(ventureId: string, assignedVmId: string)` → `POST /api/ventures/:id/assign-vpvm`

---

## Step 7: Update Other Dashboards

- **AdminDashboard.tsx**: Add `'Assign VP/VM'` and `'With VP/VM'` to `panelApprovedStatuses` array and `displayStatus()` function
- **ScheduledCallsPage.tsx**: Add status display cases
- **VSMDashboard.tsx**: Add status display cases (if ventures in these statuses are visible)

---

## Verification
1. Run `npm run build` in both frontend and backend to check for compilation errors
2. Test the flow: Panel approves venture → status becomes "Assign VP/VM" → ops manager sees it → clicks Assign → selects VP/VM → status becomes "With VP/VM" with assigned name shown
3. Verify the migration works on dev DB via Supabase MCP
