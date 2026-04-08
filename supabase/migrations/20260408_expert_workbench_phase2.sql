-- ============================================================================
-- Expert Workbench Phase 2: Meeting Requests + Expert Matching Cache
-- ============================================================================

-- 1. Meeting requests — full lifecycle from venture/VP request to expert response
CREATE TABLE IF NOT EXISTS meeting_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  expert_id uuid NOT NULL REFERENCES profiles(id),
  requested_by uuid NOT NULL REFERENCES profiles(id),
  requested_by_role text NOT NULL,
  meeting_goal text,
  problem_statement text,
  company_info jsonb,
  preferred_date date,
  preferred_time time,
  preferred_duration int DEFAULT 60,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'scheduled', 'completed', 'cancelled')),
  expert_response_note text,
  responded_at timestamptz,
  session_id uuid REFERENCES mentor_sessions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mr_venture ON meeting_requests(venture_id);
CREATE INDEX IF NOT EXISTS idx_mr_expert ON meeting_requests(expert_id);
CREATE INDEX IF NOT EXISTS idx_mr_status ON meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_mr_requested_by ON meeting_requests(requested_by);

-- 2. Expert matching cache — AI match results per venture
CREATE TABLE IF NOT EXISTS expert_matching_cache (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
  matched_experts jsonb NOT NULL,
  context_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emc_venture ON expert_matching_cache(venture_id);

-- 3. RLS for meeting_requests
ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

-- Experts see requests sent to them
CREATE POLICY mr_expert_own ON meeting_requests
  FOR ALL USING (expert_id = auth.uid());

-- Users see requests they created
CREATE POLICY mr_requester_own ON meeting_requests
  FOR ALL USING (requested_by = auth.uid());

-- Entrepreneurs see requests for their ventures
CREATE POLICY mr_entrepreneur_venture ON meeting_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ventures v
      WHERE v.id = meeting_requests.venture_id
      AND v.user_id = auth.uid()
    )
  );

-- Staff can view all
CREATE POLICY mr_staff_read ON meeting_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ops_manager', 'venture_mgr', 'committee_member', 'success_mgr')
    )
  );

-- 4. RLS for expert_matching_cache
ALTER TABLE expert_matching_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY emc_staff_all ON expert_matching_cache
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'ops_manager', 'venture_mgr', 'committee_member', 'success_mgr', 'entrepreneur')
    )
  );
