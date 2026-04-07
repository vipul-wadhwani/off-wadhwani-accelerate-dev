-- ============================================================================
-- Mentor Workbench: tables for mentor profiles, venture assignments, sessions
-- Supports Flow 1: VP/VM schedules mentor-venture session
-- ============================================================================

-- 0. Add 'mentor' to the profiles role check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['entrepreneur', 'success_mgr', 'venture_mgr', 'committee_member', 'admin', 'ops_manager', 'mentor']));

-- 1. Mentor profiles (extends profiles for mentor-specific data)
CREATE TABLE IF NOT EXISTS mentor_profiles (
  id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  expertise_areas text[] DEFAULT '{}',
  bio text,
  max_sessions_per_week int DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Mentor-Venture assignments (which mentors are assigned to which ventures)
CREATE TABLE IF NOT EXISTS mentor_venture_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mentor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_venture_unique UNIQUE (mentor_id, venture_id)
);

CREATE INDEX IF NOT EXISTS idx_mva_mentor ON mentor_venture_assignments(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mva_venture ON mentor_venture_assignments(venture_id);

-- 3. Mentor sessions (scheduled/completed mentoring calls)
CREATE TABLE IF NOT EXISTS mentor_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id text UNIQUE NOT NULL,
  mentor_id uuid NOT NULL REFERENCES profiles(id),
  venture_id uuid NOT NULL REFERENCES ventures(id),
  scheduled_by uuid REFERENCES profiles(id),
  topic text,
  mentee_name text,
  duration_minutes int DEFAULT 60,
  join_url text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ms_mentor ON mentor_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_ms_venture ON mentor_sessions(venture_id);
CREATE INDEX IF NOT EXISTS idx_ms_status ON mentor_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ms_date ON mentor_sessions(scheduled_date);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_venture_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_sessions ENABLE ROW LEVEL SECURITY;

-- mentor_profiles: mentors manage own, staff can read all, admin can write all
CREATE POLICY "mentor_own_profile" ON mentor_profiles FOR ALL
  USING (id = auth.uid());

CREATE POLICY "staff_view_mentor_profiles" ON mentor_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin', 'ops_manager', 'venture_mgr', 'committee_member', 'success_mgr')
  ));

CREATE POLICY "admin_manage_mentor_profiles" ON mentor_profiles FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- mentor_venture_assignments: mentors see own, VP/VM see assigned ventures, admin sees all
CREATE POLICY "mentor_own_assignments" ON mentor_venture_assignments FOR SELECT
  USING (mentor_id = auth.uid());

CREATE POLICY "staff_view_assignments" ON mentor_venture_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin', 'ops_manager', 'venture_mgr', 'committee_member', 'success_mgr')
  ));

CREATE POLICY "admin_manage_assignments" ON mentor_venture_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin', 'venture_mgr', 'committee_member')
  ));

-- mentor_sessions: mentors see own, VP/VM see their ventures' sessions, entrepreneurs see own venture, admin all
CREATE POLICY "mentor_own_sessions" ON mentor_sessions FOR ALL
  USING (mentor_id = auth.uid());

CREATE POLICY "staff_view_sessions" ON mentor_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin', 'ops_manager', 'venture_mgr', 'committee_member', 'success_mgr')
  ));

CREATE POLICY "staff_create_sessions" ON mentor_sessions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin', 'venture_mgr', 'committee_member')
  ));

CREATE POLICY "entrepreneur_view_own_sessions" ON mentor_sessions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ventures v
    WHERE v.id = mentor_sessions.venture_id
    AND v.user_id = auth.uid()
  ));

-- Allow mentors to read venture data for their assigned ventures
CREATE POLICY "mentor_view_assigned_ventures" ON ventures FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mentor_venture_assignments mva
    WHERE mva.venture_id = ventures.id
    AND mva.mentor_id = auth.uid() AND mva.status = 'active'
  ));

CREATE POLICY "mentor_view_assigned_venture_apps" ON venture_applications FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mentor_venture_assignments mva
    WHERE mva.venture_id = venture_applications.venture_id
    AND mva.mentor_id = auth.uid() AND mva.status = 'active'
  ));

CREATE POLICY "mentor_view_assigned_venture_roadmaps" ON venture_roadmaps FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mentor_venture_assignments mva
    WHERE mva.venture_id = venture_roadmaps.venture_id
    AND mva.mentor_id = auth.uid() AND mva.status = 'active'
  ));

CREATE POLICY "mentor_view_assigned_venture_deliverables" ON venture_deliverables FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mentor_venture_assignments mva
    WHERE mva.venture_id = venture_deliverables.venture_id
    AND mva.mentor_id = auth.uid() AND mva.status = 'active'
  ));

CREATE POLICY "mentor_view_assigned_venture_streams" ON venture_streams FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM mentor_venture_assignments mva
    WHERE mva.venture_id = venture_streams.venture_id
    AND mva.mentor_id = auth.uid() AND mva.status = 'active'
  ));
