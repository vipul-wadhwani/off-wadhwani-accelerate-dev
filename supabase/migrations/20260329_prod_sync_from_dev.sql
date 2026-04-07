-- ============================================================================
-- PROD SYNC MIGRATION — 2026-03-29
-- Brings prod DB in sync with dev DB
-- Project: Accelerate-v1-prod (jenyuppryecuirvvlvkb)
--
-- PREREQUISITES:
--   1. Prod backup taken (scripts/backups/prod/2026-03-29.sql)
--   2. Reviewed and approved by Vipul
--
-- CHANGES:
--   1. Add profiles_role_check constraint (includes ops_manager)
--   2. Update handle_new_user() to read role from metadata + ON CONFLICT
--   3. Add kpi_status column to venture_applications
--   4. Add composite index on venture_interactions
--   5. Seed programs table (0 rows in prod, 5 in dev)
--   6. Backfill missing profiles from auth.users (18 exist, 2 missing)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Add profiles_role_check constraint
--    Prod: missing entirely | Dev: has it with ops_manager
-- ============================================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('entrepreneur','success_mgr','venture_mgr','committee_member','ops_manager','admin'));


-- ============================================================================
-- 2. Update handle_new_user() trigger function
--    Prod: doesn't read role from raw_user_meta_data, no ON CONFLICT
--    Dev:  reads role from metadata first, has ON CONFLICT DO NOTHING
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role text;
BEGIN
  -- Get role from metadata if provided, otherwise auto-assign
  user_role := COALESCE(new.raw_user_meta_data->>'role', NULL);

  IF user_role IS NULL THEN
    IF new.email ILIKE '%admin%' OR new.email ILIKE '%@wadhwani%' THEN
      user_role := 'admin';
    ELSIF new.email ILIKE '%committee%' THEN
      user_role := 'committee_member';
    ELSIF new.email ILIKE '%venture%manager%' OR new.email ILIKE '%vm@%' THEN
      user_role := 'venture_mgr';
    ELSIF new.email ILIKE '%success%' OR new.email ILIKE '%vsm@%' THEN
      user_role := 'success_mgr';
    ELSE
      user_role := 'entrepreneur';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, full_name, email, role, last_login_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    user_role,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. Add kpi_status column to venture_applications
--    Prod: missing | Dev: exists with default 'Grey (Not Started Yet)'
-- ============================================================================
ALTER TABLE venture_applications
  ADD COLUMN IF NOT EXISTS kpi_status text DEFAULT 'Grey (Not Started Yet)';


-- ============================================================================
-- 4. Add composite index on venture_interactions
--    Prod: missing | Dev: exists
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_interactions_venture_created
  ON venture_interactions(venture_id, created_by);


-- ============================================================================
-- 5. Seed programs table
--    Prod: 0 rows | Dev: 5 programs
-- ============================================================================
INSERT INTO public.programs (id, name, tier)
VALUES
  ('40bb02c3-5fc3-4e73-87bc-5db1f77a0325', 'Accelerate Prime', 1),
  ('34823405-c4dd-4c05-b182-e31d65a69104', 'Accelerate Core', 2),
  ('6bf55118-8ab3-4842-914b-bdda1fac9fe5', 'Accelerate Select', 3),
  ('661cc6e8-88f7-4b14-adcb-939c11faa592', 'Ignite', 4),
  ('c4eabd45-91da-42cc-bf3e-90e3ddb6f8ee', 'Liftoff', 5)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 6. Backfill missing profiles — SKIPPED (handle separately)
--    Prod has 20 auth.users but only 18 profiles.
--    Missing: srisakthinattarayan@gmail.com, srinattarayan@gmail.com
--    To backfill later, run:
--      INSERT INTO public.profiles (id, full_name, email, role, last_login_at)
--      SELECT id, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
--             email, COALESCE(raw_user_meta_data->>'role', 'entrepreneur'), now()
--      FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles)
--      ON CONFLICT (id) DO NOTHING;
-- ============================================================================


COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION:
--   Run these queries to confirm success:
--
--   -- Check profiles_role_check exists
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
--
--   -- Check kpi_status column exists
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'venture_applications' AND column_name = 'kpi_status';
--
--   -- Check programs seeded
--   SELECT count(*) FROM programs;  -- should be 5
--
--
--   -- Check index exists
--   SELECT indexname FROM pg_indexes WHERE indexname = 'idx_interactions_venture_created';
-- ============================================================================
