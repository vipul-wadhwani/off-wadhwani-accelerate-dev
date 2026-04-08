-- ============================================================================
-- Expert Workbench Phase 1: Availability + Session enhancements for embedded Zoom
-- ============================================================================

-- 1. Expert availability (recurring weekly slots + one-off overrides)
CREATE TABLE IF NOT EXISTS expert_availability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  expert_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_recurring boolean DEFAULT true,
  specific_date date,           -- for one-off date overrides
  is_blocked boolean DEFAULT false, -- block a recurring slot for a specific date
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(expert_id, day_of_week, start_time, specific_date)
);

CREATE INDEX IF NOT EXISTS idx_ea_expert ON expert_availability(expert_id);
CREATE INDEX IF NOT EXISTS idx_ea_day ON expert_availability(day_of_week);

-- 2. Add Zoom Meeting SDK fields to mentor_sessions
ALTER TABLE mentor_sessions
  ADD COLUMN IF NOT EXISTS zoom_meeting_id bigint,
  ADD COLUMN IF NOT EXISTS zoom_meeting_password text,
  ADD COLUMN IF NOT EXISTS transcript_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'vp_scheduled';

-- 3. Extend mentor_profiles for richer expert data
ALTER TABLE mentor_profiles
  ADD COLUMN IF NOT EXISTS industry_sectors text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS years_experience int,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;

-- 4. RLS for expert_availability
ALTER TABLE expert_availability ENABLE ROW LEVEL SECURITY;

-- Experts can manage their own availability
CREATE POLICY expert_availability_own ON expert_availability
  FOR ALL USING (expert_id = (SELECT id FROM profiles WHERE id = auth.uid()));

-- Staff can view all availability
CREATE POLICY expert_availability_staff_read ON expert_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ops_manager', 'venture_mgr', 'committee_member', 'success_mgr')
    )
  );

-- Entrepreneurs can view availability of experts assigned to their ventures
CREATE POLICY expert_availability_entrepreneur_read ON expert_availability
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'entrepreneur'
    )
  );
