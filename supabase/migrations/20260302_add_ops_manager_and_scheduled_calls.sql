-- Phase 1a: Add ops_manager role to profiles CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('entrepreneur','success_mgr','venture_mgr','committee_member','ops_manager','admin'));

-- Phase 1b: Update handle_new_user() trigger to detect ops_manager
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN NEW.email ILIKE '%ops%' THEN 'ops_manager'
      WHEN NEW.email ILIKE '%admin%' THEN 'admin'
      WHEN NEW.email ILIKE '%committee%' OR NEW.email ILIKE '%meetul%' THEN 'committee_member'
      WHEN NEW.email ILIKE '%ravi%' THEN 'venture_mgr'
      WHEN NEW.email ILIKE '%rajesh%' THEN 'success_mgr'
      ELSE 'entrepreneur'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 1c: Create scheduled_calls table
CREATE TABLE IF NOT EXISTS scheduled_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venture_id UUID NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  panelist_id UUID NOT NULL REFERENCES panelists(id) ON DELETE CASCADE,
  scheduled_by UUID NOT NULL REFERENCES profiles(id),
  call_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','completed','cancelled','no_show','rescheduled')),
  meet_link TEXT,
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_venture_id ON scheduled_calls(venture_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_panelist_id ON scheduled_calls(panelist_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status ON scheduled_calls(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_call_date ON scheduled_calls(call_date);

-- Enable RLS
ALTER TABLE scheduled_calls ENABLE ROW LEVEL SECURITY;

-- RLS Policies: staff can read, ops_manager/admin can write
CREATE POLICY "Staff can view scheduled calls"
  ON scheduled_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ops_manager', 'admin', 'success_mgr', 'venture_mgr', 'committee_member')
    )
  );

CREATE POLICY "Ops manager can insert scheduled calls"
  ON scheduled_calls FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ops_manager', 'admin')
    )
  );

CREATE POLICY "Ops manager can update scheduled calls"
  ON scheduled_calls FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ops_manager', 'admin')
    )
  );
