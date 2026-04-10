# Prod Backup - 2026-03-29

## Files
- `2026-03-29.sql` — Main SQL backup with INSERT statements for:
  - profiles (18 rows)
  - ventures (13 rows)  
  - panelists (12 rows)
  - panelist_availability (13 rows)
  - panelist_blocked_dates (2 rows)
  - venture_status_history (9 rows)
  - scheduled_calls (1 row)

- `2026-03-29_panel_feedback.json` — Panel feedback (2 rows)
- `2026-03-29_venture_applications.json` — Application form data (13 rows)
- `2026-03-29_venture_assessments.json` — AI scorecards + VSM notes (8 rows)
- `2026-03-29_venture_streams.json` — Workstream statuses (78 rows)
- `2026-03-29_venture_interactions.json` — Call transcripts (3 rows)

## Empty tables (0 rows, not backed up)
programs, venture_milestones, venture_deliverables, support_hours, venture_agreements, venture_roadmaps

## auth.users
20 users documented as comments in the SQL file. Must be recreated via Supabase Auth Admin API.

## How to restore
1. Recreate auth.users via Supabase Auth Admin API
2. Run the SQL file: `psql <connection_string> -f 2026-03-29.sql`
3. Load JSON files via application code or Supabase REST API
