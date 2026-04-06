-- ============================================================================
-- VP/VM Availability: weekly recurring slots + blocked dates
-- Mirrors panelist_availability pattern for venture_mgr users
-- ============================================================================

-- 1. Weekly recurring availability slots
CREATE TABLE IF NOT EXISTS vpvm_availability (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vpvm_availability_one_hour CHECK (end_time = (start_time + '01:00:00'::interval)),
  CONSTRAINT vpvm_availability_unique_slot UNIQUE (user_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_vpvm_availability_user ON vpvm_availability(user_id);

-- 2. Blocked dates (specific days VP/VM is unavailable)
CREATE TABLE IF NOT EXISTS vpvm_blocked_dates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vpvm_blocked_dates_unique UNIQUE (user_id, blocked_date)
);

CREATE INDEX IF NOT EXISTS idx_vpvm_blocked_dates_user ON vpvm_blocked_dates(user_id);

-- 3. RLS Policies
ALTER TABLE vpvm_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE vpvm_blocked_dates ENABLE ROW LEVEL SECURITY;

-- VP/VM can manage their own availability
CREATE POLICY "users_manage_own_availability" ON vpvm_availability FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "staff_view_all_availability" ON vpvm_availability FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin', 'ops_manager', 'success_mgr')
  ));

CREATE POLICY "users_manage_own_blocked_dates" ON vpvm_blocked_dates FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "staff_view_all_blocked_dates" ON vpvm_blocked_dates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('admin', 'ops_manager', 'success_mgr')
  ));
