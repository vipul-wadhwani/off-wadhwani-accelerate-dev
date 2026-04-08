-- ============================================================================
-- Expert Workbench Phase 3: Pre-Meeting Briefs, Transcripts, Summaries
-- ============================================================================

-- 1. Pre-meeting briefs — AI-generated, versioned, never overwritten
CREATE TABLE IF NOT EXISTS pre_meeting_briefs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES ventures(id),
  generated_by uuid REFERENCES profiles(id),
  brief_content jsonb NOT NULL,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmb_session ON pre_meeting_briefs(session_id);
CREATE INDEX IF NOT EXISTS idx_pmb_venture ON pre_meeting_briefs(venture_id);

-- 2. Meeting transcripts — stored transcript chunks
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
  chunks jsonb DEFAULT '[]',
  full_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mt_session ON meeting_transcripts(session_id);

-- 3. Meeting summaries — post-meeting AI summaries
CREATE TABLE IF NOT EXISTS meeting_summaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
  summary_text text NOT NULL,
  key_points text[] DEFAULT '{}',
  action_items jsonb DEFAULT '[]',
  ai_insights jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_msm_session ON meeting_summaries(session_id);

-- 4. Session insight snapshots — AI insights captured during meeting
CREATE TABLE IF NOT EXISTS session_insight_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
  summary text NOT NULL,
  questions text[] DEFAULT '{}',
  transcript_length int,
  is_final boolean DEFAULT false,
  snapshot_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sis_session ON session_insight_snapshots(session_id);

-- 5. RLS policies
ALTER TABLE pre_meeting_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_insight_snapshots ENABLE ROW LEVEL SECURITY;

-- Staff + mentors can read/write all
CREATE POLICY pmb_staff ON pre_meeting_briefs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ops_manager','venture_mgr','committee_member','success_mgr','mentor'))
);

CREATE POLICY mt_staff ON meeting_transcripts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ops_manager','venture_mgr','committee_member','success_mgr','mentor'))
);

CREATE POLICY ms_staff ON meeting_summaries FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ops_manager','venture_mgr','committee_member','success_mgr','mentor'))
);

CREATE POLICY sis_staff ON session_insight_snapshots FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','ops_manager','venture_mgr','committee_member','success_mgr','mentor'))
);

-- Entrepreneurs can read their venture's data
CREATE POLICY pmb_entrepreneur ON pre_meeting_briefs FOR SELECT USING (
  EXISTS (SELECT 1 FROM ventures v WHERE v.id = pre_meeting_briefs.venture_id AND v.user_id = auth.uid())
);

CREATE POLICY mt_entrepreneur ON meeting_transcripts FOR SELECT USING (
  EXISTS (SELECT 1 FROM mentor_sessions ms JOIN ventures v ON v.id = ms.venture_id WHERE ms.id = meeting_transcripts.session_id AND v.user_id = auth.uid())
);

CREATE POLICY ms_entrepreneur ON meeting_summaries FOR SELECT USING (
  EXISTS (SELECT 1 FROM mentor_sessions ms JOIN ventures v ON v.id = ms.venture_id WHERE ms.id = meeting_summaries.session_id AND v.user_id = auth.uid())
);
