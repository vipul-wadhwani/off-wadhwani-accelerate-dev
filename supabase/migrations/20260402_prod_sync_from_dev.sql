-- ============================================================================
-- PROD SYNC FROM DEV — 2026-04-02
-- Brings prod schema in line with dev
-- ============================================================================

-- ============================================================================
-- 1. NEW COLUMNS on venture_deliverables
-- ============================================================================
ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS owner text;
ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS health text DEFAULT 'on_track';

-- ============================================================================
-- 2. NEW TABLES
-- ============================================================================

-- 2a. deliverable_checklist_items
CREATE TABLE IF NOT EXISTS deliverable_checklist_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deliverable_id uuid NOT NULL REFERENCES venture_deliverables(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_deliverable ON deliverable_checklist_items(deliverable_id);

-- 2b. deliverable_notes
CREATE TABLE IF NOT EXISTS deliverable_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deliverable_id uuid NOT NULL REFERENCES venture_deliverables(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  action_items text[] DEFAULT '{}',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_deliverable ON deliverable_notes(deliverable_id);

-- 2c. deliverable_recommendations
CREATE TABLE IF NOT EXISTS deliverable_recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deliverable_id uuid NOT NULL REFERENCES venture_deliverables(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_recommendation_type CHECK (
    recommendation_type IN ('expert_connect', 'service_provider', 'masterclass', 'research')
  ),
  CONSTRAINT unique_deliverable_type UNIQUE (deliverable_id, recommendation_type)
);

CREATE INDEX IF NOT EXISTS idx_recommendations_deliverable ON deliverable_recommendations(deliverable_id);

-- ============================================================================
-- 3. RLS POLICIES for new tables
-- ============================================================================

-- 3a. deliverable_checklist_items
ALTER TABLE deliverable_checklist_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'view_checklist_via_venture') THEN
    CREATE POLICY "view_checklist_via_venture"
      ON deliverable_checklist_items FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM venture_deliverables vd
          JOIN ventures v ON v.id = vd.venture_id
          WHERE vd.id = deliverable_checklist_items.deliverable_id
          AND (
            v.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid()
              AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
            )
          )
          AND v.deleted_at IS NULL
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_manage_checklist') THEN
    CREATE POLICY "staff_manage_checklist"
      ON deliverable_checklist_items FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'entrepreneurs_update_own_checklist') THEN
    CREATE POLICY "entrepreneurs_update_own_checklist"
      ON deliverable_checklist_items FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM venture_deliverables vd
          JOIN ventures v ON v.id = vd.venture_id
          WHERE vd.id = deliverable_checklist_items.deliverable_id
          AND v.user_id = auth.uid()
          AND v.workbench_locked = false
        )
      );
  END IF;
END $$;

-- Trigger for updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_checklist_items_updated_at') THEN
    CREATE TRIGGER update_checklist_items_updated_at
      BEFORE UPDATE ON deliverable_checklist_items
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 3b. deliverable_notes
ALTER TABLE deliverable_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'view_notes_via_venture') THEN
    CREATE POLICY "view_notes_via_venture"
      ON deliverable_notes FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM venture_deliverables vd
          JOIN ventures v ON v.id = vd.venture_id
          WHERE vd.id = deliverable_notes.deliverable_id
          AND (
            v.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid()
              AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
            )
          )
          AND v.deleted_at IS NULL
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_manage_notes') THEN
    CREATE POLICY "staff_manage_notes"
      ON deliverable_notes FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'entrepreneurs_insert_own_notes') THEN
    CREATE POLICY "entrepreneurs_insert_own_notes"
      ON deliverable_notes FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM venture_deliverables vd
          JOIN ventures v ON v.id = vd.venture_id
          WHERE vd.id = deliverable_notes.deliverable_id
          AND v.user_id = auth.uid()
          AND v.workbench_locked = false
        )
      );
  END IF;
END $$;

-- 3c. deliverable_recommendations
ALTER TABLE deliverable_recommendations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'view_recommendations_via_venture') THEN
    CREATE POLICY "view_recommendations_via_venture"
      ON deliverable_recommendations FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM venture_deliverables vd
          JOIN ventures v ON v.id = vd.venture_id
          WHERE vd.id = deliverable_recommendations.deliverable_id
          AND (
            v.user_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM profiles
              WHERE id = auth.uid()
              AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
            )
          )
          AND v.deleted_at IS NULL
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'staff_manage_recommendations') THEN
    CREATE POLICY "staff_manage_recommendations"
      ON deliverable_recommendations FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
        )
      );
  END IF;
END $$;

-- ============================================================================
-- 4. CHECK CONSTRAINTS (missing from prod)
-- ============================================================================

-- panel_feedback ratings (1-5)
ALTER TABLE panel_feedback ADD CONSTRAINT panel_feedback_rating_business_model_clarity_check CHECK ((rating_business_model_clarity >= 1) AND (rating_business_model_clarity <= 5)) NOT VALID;
ALTER TABLE panel_feedback ADD CONSTRAINT panel_feedback_rating_clarity_expansion_check CHECK ((rating_clarity_expansion >= 1) AND (rating_clarity_expansion <= 5)) NOT VALID;
ALTER TABLE panel_feedback ADD CONSTRAINT panel_feedback_rating_execution_seriousness_check CHECK ((rating_execution_seriousness >= 1) AND (rating_execution_seriousness <= 5)) NOT VALID;
ALTER TABLE panel_feedback ADD CONSTRAINT panel_feedback_rating_financial_health_check CHECK ((rating_financial_health >= 1) AND (rating_financial_health <= 5)) NOT VALID;
ALTER TABLE panel_feedback ADD CONSTRAINT panel_feedback_rating_financial_readiness_check CHECK ((rating_financial_readiness >= 1) AND (rating_financial_readiness <= 5)) NOT VALID;
ALTER TABLE panel_feedback ADD CONSTRAINT panel_feedback_rating_historical_growth_check CHECK ((rating_historical_growth >= 1) AND (rating_historical_growth <= 5)) NOT VALID;
ALTER TABLE panel_feedback ADD CONSTRAINT panel_feedback_rating_leadership_check CHECK ((rating_leadership >= 1) AND (rating_leadership <= 5)) NOT VALID;
ALTER TABLE panel_feedback ADD CONSTRAINT panel_feedback_rating_team_leadership_check CHECK ((rating_team_leadership >= 1) AND (rating_team_leadership <= 5)) NOT VALID;

-- panelist_availability
ALTER TABLE panelist_availability ADD CONSTRAINT end_minus_start_one_hour CHECK (end_time = (start_time + '01:00:00'::interval)) NOT VALID;
ALTER TABLE panelist_availability ADD CONSTRAINT panelist_availability_day_of_week_check CHECK ((day_of_week >= 0) AND (day_of_week <= 6)) NOT VALID;

-- panelists
ALTER TABLE panelists ADD CONSTRAINT panelists_program_check CHECK (program IN ('Prime', 'Core', 'Select')) NOT VALID;

-- profiles (username_length — profiles_role_check already exists on prod)
ALTER TABLE profiles ADD CONSTRAINT username_length CHECK (char_length(full_name) >= 2) NOT VALID;

-- scheduled_calls
ALTER TABLE scheduled_calls ADD CONSTRAINT scheduled_calls_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')) NOT VALID;

-- support_hours
ALTER TABLE support_hours ADD CONSTRAINT non_negative_allocated CHECK (allocated >= 0) NOT VALID;
ALTER TABLE support_hours ADD CONSTRAINT non_negative_used CHECK (used >= 0) NOT VALID;

-- venture_agreements
ALTER TABLE venture_agreements ADD CONSTRAINT valid_agreement_status CHECK (status IN ('Draft', 'Sent', 'Viewed', 'Signed', 'Rejected', 'Expired')) NOT VALID;
ALTER TABLE venture_agreements ADD CONSTRAINT valid_agreement_type CHECK (agreement_type IN ('partnership', 'nda', 'milestone')) NOT VALID;

-- venture_applications
ALTER TABLE venture_applications ADD CONSTRAINT positive_investment CHECK ((min_investment IS NULL) OR (min_investment >= 0)) NOT VALID;
ALTER TABLE venture_applications ADD CONSTRAINT venture_applications_revenue_potential_12m_check CHECK ((revenue_potential_12m IS NULL) OR (revenue_potential_12m IN ('5Cr - 15 Cr', '15Cr - 50Cr', '50Cr+'))) NOT VALID;
ALTER TABLE venture_applications ADD CONSTRAINT venture_applications_target_jobs_check CHECK ((target_jobs IS NULL) OR (target_jobs >= 0)) NOT VALID;

-- venture_assessments
ALTER TABLE venture_assessments ADD CONSTRAINT positive_duration CHECK ((assessment_duration_minutes IS NULL) OR (assessment_duration_minutes >= 0)) NOT VALID;
ALTER TABLE venture_assessments ADD CONSTRAINT valid_assessment_type CHECK (assessment_type IN ('screening', 'committee')) NOT VALID;
ALTER TABLE venture_assessments ADD CONSTRAINT valid_assessor_role CHECK (assessor_role IN ('success_mgr', 'committee_member', 'venture_mgr', 'admin')) NOT VALID;
ALTER TABLE venture_assessments ADD CONSTRAINT valid_decision CHECK ((decision IS NULL) OR (decision IN ('recommend', 'reject', 'needs_more_info'))) NOT VALID;

-- venture_deliverables
ALTER TABLE venture_deliverables ADD CONSTRAINT valid_deliverable_status CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'cancelled')) NOT VALID;
ALTER TABLE venture_deliverables ADD CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')) NOT VALID;
ALTER TABLE venture_deliverables ADD CONSTRAINT venture_deliverables_health_check CHECK (health IN ('on_track', 'needs_attention', 'at_risk')) NOT VALID;

-- venture_interactions
ALTER TABLE venture_interactions ADD CONSTRAINT positive_duration CHECK ((duration_minutes IS NULL) OR (duration_minutes >= 0)) NOT VALID;
ALTER TABLE venture_interactions ADD CONSTRAINT valid_interaction_type CHECK (interaction_type IN ('call', 'meeting', 'email', 'note')) NOT VALID;

-- venture_milestones
ALTER TABLE venture_milestones ADD CONSTRAINT completed_requires_timestamp CHECK (((status = 'Completed') AND (completed_at IS NOT NULL)) OR (status <> 'Completed')) NOT VALID;
ALTER TABLE venture_milestones ADD CONSTRAINT valid_milestone_status CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Blocked', 'Cancelled')) NOT VALID;
ALTER TABLE venture_milestones ADD CONSTRAINT valid_progress CHECK ((progress_percentage >= 0) AND (progress_percentage <= 100)) NOT VALID;

-- venture_roadmaps
ALTER TABLE venture_roadmaps ADD CONSTRAINT positive_generation_duration CHECK ((generation_duration_seconds IS NULL) OR (generation_duration_seconds >= 0)) NOT VALID;
ALTER TABLE venture_roadmaps ADD CONSTRAINT valid_generation_source CHECK (generation_source IN ('ai_generated', 'manual', 'imported')) NOT VALID;

-- venture_status_history
ALTER TABLE venture_status_history ADD CONSTRAINT valid_status_type CHECK (status_type IN ('application', 'screening', 'committee', 'agreement', 'workbench_lock', 'program_assignment', 'venture_partner', 'assignment')) NOT VALID;

-- venture_streams
ALTER TABLE venture_streams ADD CONSTRAINT valid_completion CHECK ((completion_percentage >= 0) AND (completion_percentage <= 100)) NOT VALID;
ALTER TABLE venture_streams ADD CONSTRAINT valid_stream_status CHECK (status IN ('Not started', 'On track', 'Need some advice', 'Need deep support', 'Completed')) NOT VALID;

-- ============================================================================
-- 5. VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW venture_analytics AS
SELECT v.id,
    v.name,
    v.status,
    v.created_at,
    va.revenue_12m,
    va.full_time_employees,
    p.name AS program_name,
    p.tier AS program_tier,
    EXTRACT(day FROM (now() - v.updated_at)) AS days_in_status,
    EXTRACT(day FROM (now() - v.created_at)) AS days_since_submission,
    (EXISTS ( SELECT 1
           FROM venture_assessments
          WHERE (venture_assessments.venture_id = v.id))) AS has_assessment,
    ( SELECT round(avg(
                CASE
                    WHEN (venture_streams.status = 'Completed'::text) THEN 100
                    ELSE 0
                END)) AS round
           FROM venture_streams
          WHERE (venture_streams.venture_id = v.id)) AS stream_completion_rate
   FROM ((ventures v
     LEFT JOIN venture_applications va ON ((va.venture_id = v.id)))
     LEFT JOIN programs p ON ((p.id = v.program_id)))
  WHERE (v.deleted_at IS NULL);

CREATE OR REPLACE VIEW ventures_complete AS
SELECT v.id,
    v.user_id,
    v.created_at,
    v.updated_at,
    v.name,
    v.founder_name,
    v.city,
    v.location,
    v.program_id,
    v.program_name,
    v.status,
    v.assigned_vsm_id,
    v.assigned_vm_id,
    v.venture_partner,
    v.workbench_locked,
    v.locked_reason,
    v.deleted_at,
    v.deleted_by,
    va.revenue_12m,
    va.revenue_potential_3y,
    va.full_time_employees,
    va.incremental_hiring,
    va.target_jobs,
    va.growth_focus,
    va.support_request,
    p.name AS program_display_name,
    p.tier AS program_tier,
    sh.allocated AS support_hours_allocated,
    sh.used AS support_hours_used,
    sh.balance AS support_hours_balance,
    vsm.full_name AS vsm_name,
    vm.full_name AS vm_name,
    entrepreneur.full_name AS entrepreneur_name,
    entrepreneur.email AS entrepreneur_email,
    ( SELECT jsonb_build_object('decision', venture_assessments.decision, 'program_recommendation', venture_assessments.program_recommendation, 'ai_analysis', venture_assessments.ai_analysis, 'assessed_at', venture_assessments.created_at) AS jsonb_build_object
           FROM venture_assessments
          WHERE ((venture_assessments.venture_id = v.id) AND (venture_assessments.is_current = true) AND (venture_assessments.assessment_type = 'screening'::text))
          ORDER BY venture_assessments.created_at DESC
         LIMIT 1) AS latest_screening,
    ( SELECT jsonb_build_object('decision', venture_assessments.decision, 'venture_partner', v.venture_partner, 'assessed_at', venture_assessments.created_at) AS jsonb_build_object
           FROM venture_assessments
          WHERE ((venture_assessments.venture_id = v.id) AND (venture_assessments.is_current = true) AND (venture_assessments.assessment_type = 'committee'::text))
          ORDER BY venture_assessments.created_at DESC
         LIMIT 1) AS latest_committee_review
   FROM ((((((ventures v
     LEFT JOIN venture_applications va ON ((va.venture_id = v.id)))
     LEFT JOIN programs p ON ((p.id = v.program_id)))
     LEFT JOIN support_hours sh ON ((sh.venture_id = v.id)))
     LEFT JOIN profiles vsm ON ((vsm.id = v.assigned_vsm_id)))
     LEFT JOIN profiles vm ON ((vm.id = v.assigned_vm_id)))
     LEFT JOIN profiles entrepreneur ON ((entrepreneur.id = v.user_id)))
  WHERE (v.deleted_at IS NULL);
