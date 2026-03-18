# Wadhwani Accelerate - Database Schema Report

**Date:** 2 March 2026
**Project:** Accelerate-dev-active (`gheqxkxsjhkdbhmdntmh`)
**Region:** ap-south-1 | **Postgres:** 17.6.1 | **Database:** Supabase

---

## 1. Schema Evolution: Old vs New

### Tables Comparison

| # | Table | Old Schema | New Schema | Change |
|---|-------|-----------|------------|--------|
| 1 | `profiles` | Present | Present | No change |
| 2 | `programs` | Present | Present | No change |
| 3 | `support_hours` | Present | Present | No change |
| 4 | `venture_applications` | Present | Present | No change |
| 5 | `venture_assessments` | Present | Present | No change |
| 6 | `venture_deliverables` | Present | Present | No change |
| 7 | `venture_interactions` | Present (UNRESTRICTED) | Present (RLS enabled) | **Fixed: RLS enabled** |
| 8 | `venture_milestones` | Present | Present | No change |
| 9 | `venture_roadmaps` | Present | Present | **New: UPDATE policy added** |
| 10 | `venture_status_history` | Present | Present | No change |
| 11 | `venture_streams` | Present | Present | No change |
| 12 | `ventures` | Present | Present | No change |
| 13 | `venture_history` | Present | **Removed** | Replaced by `venture_status_history` |
| 14 | `panel_feedback` | Not present | **Added** | New table |
| 15 | `panelists` | Not present | **Added** | New table |
| 16 | `venture_agreements` | Not present | **Added** | New table |
| 17 | `venture_analytics` (view) | Not present | **Added** | New view (SECURITY DEFINER) |
| 18 | `ventures_complete` (view) | Not present | **Added** | New view (SECURITY DEFINER) |

### Key Improvements

1. **`venture_interactions` RLS fixed** -- was UNRESTRICTED in old schema, now has 4 proper RLS policies (staff create, staff view, creator update, creator delete)
2. **`venture_roadmaps` UPDATE policy added** -- the table had INSERT and SELECT policies but no UPDATE, which blocked setting `is_current = false` on old roadmaps. Migration `20260302103455` added `staff_update_roadmaps`
3. **`venture_history` renamed to `venture_status_history`** -- more descriptive naming, same audit trail purpose
4. **3 new tables added** -- `panel_feedback`, `panelists`, `venture_agreements` for the selection committee workflow

---

## 2. Current Table Inventory (15 tables + 2 views)

| Table | Rows | RLS | Policies | Indexes |
|-------|------|-----|----------|---------|
| `ventures` | 20 | Yes | 5 | 8 |
| `venture_applications` | 20 | Yes | 4 | 7 |
| `venture_streams` | 104 | Yes | 4 | 5 |
| `venture_assessments` | 10 | Yes | 2 | 7 |
| `venture_status_history` | 12 | Yes | 2 | 3 |
| `venture_interactions` | 8 | Yes | 4 | 6 |
| `venture_roadmaps` | 2 | Yes | 4 | 7 |
| `venture_deliverables` | 0 | Yes | 3 | 8 |
| `venture_milestones` | 0 | Yes | 2 | 6 |
| `venture_agreements` | 0 | Yes | 3 | 4 |
| `support_hours` | 0 | Yes | 2 | 4 |
| `panel_feedback` | 11 | Yes | 3 | 3 |
| `panelists` | 7 | Yes | 2 | 4 |
| `profiles` | 5 | Yes | 3 | 4 |
| `programs` | 5 | **No** | 0 | 2 |

---

## 3. Migrations Applied

| Version | Name | Description |
|---------|------|-------------|
| `20260227070845` | `create_panel_feedback_table` | Panel feedback for selection committee |
| `20260227075631` | `add_stream_comment_columns_to_panel_feedback` | Per-stream comment fields |
| `20260227080018` | `add_prime_panel_feedback_columns` | Prime program-specific rating columns |
| `20260302103455` | `add_update_policy_venture_roadmaps` | UPDATE RLS policy for roadmap versioning |

---

## 4. Security Audit

### ERRORS (3) -- Must Fix Before Production

| # | Issue | Table/View | Severity | Recommendation |
|---|-------|-----------|----------|----------------|
| 1 | **RLS Disabled** | `programs` | ERROR | Enable RLS and add a SELECT policy for authenticated users. This is a read-only lookup table but should still have RLS. |
| 2 | **SECURITY DEFINER View** | `ventures_complete` | ERROR | Recreate as SECURITY INVOKER so it respects the querying user's RLS policies, not the view creator's. |
| 3 | **SECURITY DEFINER View** | `venture_analytics` | ERROR | Same as above -- recreate as SECURITY INVOKER. |

### WARNINGS (7) -- Should Fix

| # | Issue | Entity | Severity | Recommendation |
|---|-------|--------|----------|----------------|
| 1 | Mutable search_path | `handle_new_user` function | WARN | Set `search_path = ''` in function definition |
| 2 | Mutable search_path | `update_updated_at_column` function | WARN | Set `search_path = ''` |
| 3 | Mutable search_path | `log_venture_status_change` function | WARN | Set `search_path = ''` |
| 4 | Mutable search_path | `update_panel_feedback_updated_at` function | WARN | Set `search_path = ''` |
| 5 | Mutable search_path | `create_support_hours_on_approval` function | WARN | Set `search_path = ''` |
| 6 | Extensions in public schema | `pg_trgm`, `btree_gin` | WARN | Move to `extensions` schema |
| 7 | Overly permissive INSERT policy | `panel_feedback` | WARN | Replace `WITH CHECK (true)` with role-based check |
| 8 | Leaked password protection | Auth config | WARN | Enable HaveIBeenPwned check in Auth settings |

---

## 5. RLS Policy Coverage

| Table | SELECT | INSERT | UPDATE | DELETE | Complete? |
|-------|--------|--------|--------|--------|-----------|
| `ventures` | Staff + Owner | Owner | Staff + Owner (draft) | -- | Missing DELETE policy |
| `venture_applications` | Via venture | Owner | Staff + Owner (unlocked) | -- | Missing DELETE |
| `venture_assessments` | Staff only | Staff only | -- | -- | **Missing UPDATE** |
| `venture_streams` | Via venture | Owner | Staff + Owner (unlocked) | -- | Missing DELETE |
| `venture_deliverables` | Via venture | Staff | Staff + Owner (unlocked) | -- | Missing DELETE |
| `venture_milestones` | Via venture | Staff | Staff (via ALL) | Staff (via ALL) | OK |
| `venture_roadmaps` | Staff + Owner | Staff | Staff | -- | OK |
| `venture_interactions` | Staff (not deleted) | Staff | Creator/Admin | -- | OK |
| `venture_agreements` | Via venture | Staff | Staff + Entrepreneur (sign) | -- | Missing DELETE |
| `venture_status_history` | Staff + Owner | -- (trigger) | -- | -- | OK (append-only) |
| `panel_feedback` | Authenticated | Authenticated (too open) | Own only | -- | INSERT too permissive |
| `panelists` | Authenticated | Staff | Staff (via ALL) | Staff (via ALL) | OK |
| `profiles` | Public | Own | Own | -- | OK |
| `programs` | **No RLS** | **No RLS** | **No RLS** | **No RLS** | **Not protected** |
| `support_hours` | Via venture | Staff | Staff (via ALL) | Staff (via ALL) | OK |

---

## 6. Index Quality Assessment

**Total indexes:** 83 across 15 tables

### Highlights (Well Indexed)
- `ventures` -- trigram search index on `name`, partial indexes on soft-deleted rows
- `venture_assessments` -- unique partial index `idx_one_current_per_type` ensures only one current assessment per type per venture
- `venture_roadmaps` -- unique partial index `idx_one_current_roadmap` ensures only one current roadmap per venture
- `venture_streams` -- unique composite index on `(venture_id, stream_name)` prevents duplicate streams
- Smart partial indexes filter out deleted/completed records to keep indexes lean

### No Issues Found
Index coverage is comprehensive. All foreign keys have corresponding indexes. All common query patterns (by venture_id, by status, by date) are covered.

---

## 7. Production Readiness Checklist

| Category | Status | Details |
|----------|--------|---------|
| **RLS on all tables** | FAIL | `programs` has no RLS |
| **No SECURITY DEFINER views** | FAIL | 2 views need conversion |
| **Function search paths** | WARN | 5 functions need `search_path = ''` |
| **Extensions in proper schema** | WARN | `pg_trgm`, `btree_gin` in public |
| **Leaked password protection** | WARN | Disabled in Auth settings |
| **All FKs indexed** | PASS | All foreign keys have indexes |
| **Soft-delete support** | PASS | `ventures` has `deleted_at`/`deleted_by` |
| **Versioning/audit trail** | PASS | Assessments, roadmaps, status history all versioned |
| **Data integrity constraints** | PASS | CHECK constraints on enums, ranges, percentages |
| **Unique constraints** | PASS | Proper uniqueness on emails, venture-stream combos, current records |

---

## 8. Recommended Actions (Priority Order)

### P0 -- Before Production Launch
1. Enable RLS on `programs` table with authenticated SELECT policy
2. Recreate `ventures_complete` and `venture_analytics` views as SECURITY INVOKER
3. Add `search_path = ''` to all 5 functions

### P1 -- Soon After Launch
4. Tighten `panel_feedback` INSERT policy to restrict by role
5. Add UPDATE policy to `venture_assessments` (currently staff can INSERT but not UPDATE)
6. Move `pg_trgm` and `btree_gin` to `extensions` schema
7. Enable leaked password protection in Supabase Auth settings

### P2 -- Nice to Have
8. Add DELETE policies where missing (or confirm soft-delete-only approach)
9. Add `venture_assessments` UPDATE policy for staff to modify existing assessments
10. Consider adding `updated_at` trigger to `venture_roadmaps` (currently only has `created_at`)

---

*Report generated from live database inspection on 2 March 2026.*
