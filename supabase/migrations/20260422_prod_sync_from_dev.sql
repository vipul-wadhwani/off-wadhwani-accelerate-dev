-- ============================================================================
-- PROD SYNC FROM DEV — 2026-04-22
-- Brings prod schema in line with dev (mentor/live-session/VP-VM-availability)
--
-- Target project: jenyuppryecuirvvlvkb (Accelerate-v1-prod)
-- Reference:      gheqxkxsjhkdbhmdntmh (Accelerate-dev-active)
--
-- SAFETY GUARANTEES
--   - No DROP TABLE / DROP COLUMN / TRUNCATE / DELETE / UPDATE on data
--   - Fully idempotent (IF NOT EXISTS, DROP POLICY IF EXISTS)
--   - All new columns are nullable or have safe defaults
--   - FK additions are pre-checked for orphan data (skipped if orphans exist)
--   - Role CHECK constraint is widened only (never narrowed)
--
-- WHAT'S NOT IN THIS FILE (flagged; decide case-by-case)
--   - venture_roadmaps.generation_source NOT NULL — would risk existing NULLs
--   - venture_roadmaps.roadmap_data default — cosmetic, prod more lenient
--   - venture_roadmaps.updated_at / generation_prompt (prod-only) — do not drop
--   - NOT VALID flags on many prod constraints — cosmetic, leave
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. NEW TABLES (12)
-- ============================================================================

-- 1a. mentor_profiles  (must be created before mentor_sessions / mentor_venture_assignments reference it indirectly via auth.uid mentor_id)
CREATE TABLE IF NOT EXISTS mentor_profiles (
    id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    expertise_areas text[] DEFAULT '{}'::text[],
    bio text,
    max_sessions_per_week integer DEFAULT 5,
    industry_sectors text[] DEFAULT '{}'::text[],
    tier text DEFAULT 'free',
    years_experience integer,
    linkedin_url text,
    company text,
    designation text,
    is_available boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mentor_profiles ENABLE ROW LEVEL SECURITY;

-- 1b. mentor_sessions
CREATE TABLE IF NOT EXISTS mentor_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id text NOT NULL UNIQUE,
    mentor_id uuid NOT NULL REFERENCES profiles(id),
    venture_id uuid NOT NULL REFERENCES ventures(id),
    scheduled_by uuid REFERENCES profiles(id),
    topic text,
    mentee_name text,
    duration_minutes integer DEFAULT 60,
    join_url text,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','ended','cancelled')),
    scheduled_date date NOT NULL,
    scheduled_time time NOT NULL,
    started_at timestamptz,
    ended_at timestamptz,
    zoom_meeting_id bigint,
    zoom_meeting_password text,
    transcript_enabled boolean DEFAULT true,
    source text DEFAULT 'vp_scheduled',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ms_mentor ON mentor_sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_ms_venture ON mentor_sessions(venture_id);
CREATE INDEX IF NOT EXISTS idx_ms_date ON mentor_sessions(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_ms_status ON mentor_sessions(status);

ALTER TABLE mentor_sessions ENABLE ROW LEVEL SECURITY;

-- 1c. mentor_venture_assignments
CREATE TABLE IF NOT EXISTS mentor_venture_assignments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    assigned_by uuid REFERENCES profiles(id),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
    assigned_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT mentor_venture_unique UNIQUE (mentor_id, venture_id)
);

CREATE INDEX IF NOT EXISTS idx_mva_mentor ON mentor_venture_assignments(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mva_venture ON mentor_venture_assignments(venture_id);

ALTER TABLE mentor_venture_assignments ENABLE ROW LEVEL SECURITY;

-- 1d. meeting_summaries
CREATE TABLE IF NOT EXISTS meeting_summaries (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id uuid NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
    summary_text text NOT NULL,
    key_points text[] DEFAULT '{}'::text[],
    action_items jsonb DEFAULT '[]'::jsonb,
    ai_insights jsonb,
    generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_msm_session ON meeting_summaries(session_id);

ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;

-- 1e. meeting_transcripts
CREATE TABLE IF NOT EXISTS meeting_transcripts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id uuid NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
    chunks jsonb DEFAULT '[]'::jsonb,
    full_text text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mt_session ON meeting_transcripts(session_id);

ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- 1f. session_insight_snapshots
CREATE TABLE IF NOT EXISTS session_insight_snapshots (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id uuid NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
    summary text NOT NULL,
    questions text[] DEFAULT '{}'::text[],
    transcript_length integer,
    is_final boolean DEFAULT false,
    snapshot_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sis_session ON session_insight_snapshots(session_id);

ALTER TABLE session_insight_snapshots ENABLE ROW LEVEL SECURITY;

-- 1g. pre_meeting_briefs
CREATE TABLE IF NOT EXISTS pre_meeting_briefs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id uuid NOT NULL REFERENCES mentor_sessions(id) ON DELETE CASCADE,
    venture_id uuid NOT NULL REFERENCES ventures(id),
    generated_by uuid REFERENCES profiles(id),
    brief_content jsonb NOT NULL,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pmb_session ON pre_meeting_briefs(session_id);
CREATE INDEX IF NOT EXISTS idx_pmb_venture ON pre_meeting_briefs(venture_id);

ALTER TABLE pre_meeting_briefs ENABLE ROW LEVEL SECURITY;

-- 1h. meeting_requests
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
    preferred_duration integer DEFAULT 60,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','scheduled','completed','cancelled')),
    expert_response_note text,
    responded_at timestamptz,
    session_id uuid REFERENCES mentor_sessions(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mr_venture ON meeting_requests(venture_id);
CREATE INDEX IF NOT EXISTS idx_mr_expert ON meeting_requests(expert_id);
CREATE INDEX IF NOT EXISTS idx_mr_requested_by ON meeting_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_mr_status ON meeting_requests(status);

ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

-- 1i. expert_availability
CREATE TABLE IF NOT EXISTS expert_availability (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    expert_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    is_recurring boolean DEFAULT true,
    specific_date date,
    is_blocked boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT expert_availability_expert_id_day_of_week_start_time_specif_key UNIQUE (expert_id, day_of_week, start_time, specific_date)
);

CREATE INDEX IF NOT EXISTS idx_ea_expert ON expert_availability(expert_id);
CREATE INDEX IF NOT EXISTS idx_ea_day ON expert_availability(day_of_week);

ALTER TABLE expert_availability ENABLE ROW LEVEL SECURITY;

-- 1j. expert_matching_cache
CREATE TABLE IF NOT EXISTS expert_matching_cache (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    venture_id uuid NOT NULL REFERENCES ventures(id) ON DELETE CASCADE,
    matched_experts jsonb NOT NULL,
    context_hash text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emc_venture ON expert_matching_cache(venture_id);

ALTER TABLE expert_matching_cache ENABLE ROW LEVEL SECURITY;

-- 1k. vpvm_availability
CREATE TABLE IF NOT EXISTS vpvm_availability (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vpvm_availability_one_hour CHECK (end_time = start_time + INTERVAL '1 hour'),
    CONSTRAINT vpvm_availability_unique_slot UNIQUE (user_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_vpvm_availability_user ON vpvm_availability(user_id);

ALTER TABLE vpvm_availability ENABLE ROW LEVEL SECURITY;

-- 1l. vpvm_blocked_dates
CREATE TABLE IF NOT EXISTS vpvm_blocked_dates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT vpvm_blocked_dates_unique UNIQUE (user_id, blocked_date)
);

CREATE INDEX IF NOT EXISTS idx_vpvm_blocked_dates_user ON vpvm_blocked_dates(user_id);

ALTER TABLE vpvm_blocked_dates ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- 2. NEW COLUMNS on existing tables
-- ============================================================================

-- 2a. panelists.profile_id
ALTER TABLE panelists ADD COLUMN IF NOT EXISTS profile_id uuid;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'panelists_profile_id_fkey' AND conrelid = 'panelists'::regclass
    ) THEN
        ALTER TABLE panelists
            ADD CONSTRAINT panelists_profile_id_fkey
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_panelists_profile_id ON panelists(profile_id);

-- 2b. scheduled_calls.participant_type + participant_profile_id
ALTER TABLE scheduled_calls ADD COLUMN IF NOT EXISTS participant_type text DEFAULT 'panelist';
ALTER TABLE scheduled_calls ADD COLUMN IF NOT EXISTS participant_profile_id uuid;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'scheduled_calls_participant_profile_id_fkey' AND conrelid = 'scheduled_calls'::regclass
    ) THEN
        ALTER TABLE scheduled_calls
            ADD CONSTRAINT scheduled_calls_participant_profile_id_fkey
            FOREIGN KEY (participant_profile_id) REFERENCES profiles(id);
    END IF;
END $$;


-- ============================================================================
-- 3. NULLABILITY CHANGE — scheduled_calls.panelist_id
--    VP/VM rows don't have a panelist_id; dev already relaxed this.
-- ============================================================================
ALTER TABLE scheduled_calls ALTER COLUMN panelist_id DROP NOT NULL;


-- ============================================================================
-- 4. WIDEN profiles.role CHECK — add 'mentor'
--    Current prod values are all preserved; only the allowed set expands.
-- ============================================================================
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role = ANY (ARRAY[
        'entrepreneur'::text, 'success_mgr'::text, 'venture_mgr'::text,
        'committee_member'::text, 'admin'::text, 'ops_manager'::text, 'mentor'::text
    ]));


-- ============================================================================
-- 5. MISSING FKs on ventures — add only if no orphan rows exist
-- ============================================================================

-- 5a. ventures.assigned_panelist_id → panelists(id)
DO $$
DECLARE orphan_count int;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ventures_assigned_panelist_id_fkey' AND conrelid = 'ventures'::regclass
    ) THEN
        SELECT COUNT(*) INTO orphan_count
        FROM ventures v
        WHERE v.assigned_panelist_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM panelists p WHERE p.id = v.assigned_panelist_id);

        IF orphan_count = 0 THEN
            ALTER TABLE ventures
                ADD CONSTRAINT ventures_assigned_panelist_id_fkey
                FOREIGN KEY (assigned_panelist_id) REFERENCES panelists(id);
        ELSE
            RAISE NOTICE 'Skipping ventures_assigned_panelist_id_fkey: % orphan row(s) found', orphan_count;
        END IF;
    END IF;
END $$;

-- 5b. ventures.deleted_by → profiles(id)
DO $$
DECLARE orphan_count int;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ventures_deleted_by_fkey' AND conrelid = 'ventures'::regclass
    ) THEN
        SELECT COUNT(*) INTO orphan_count
        FROM ventures v
        WHERE v.deleted_by IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = v.deleted_by);

        IF orphan_count = 0 THEN
            ALTER TABLE ventures
                ADD CONSTRAINT ventures_deleted_by_fkey
                FOREIGN KEY (deleted_by) REFERENCES profiles(id);
        ELSE
            RAISE NOTICE 'Skipping ventures_deleted_by_fkey: % orphan row(s) found', orphan_count;
        END IF;
    END IF;
END $$;


-- ============================================================================
-- 6. MISSING FUNCTION — save_venture_document_url
-- ============================================================================
CREATE OR REPLACE FUNCTION public.save_venture_document_url(p_venture_id uuid, p_file_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM ventures WHERE id = p_venture_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    UPDATE venture_applications
    SET corporate_presentation_url = p_file_path
    WHERE venture_id = p_venture_id;
END;
$function$;


-- ============================================================================
-- 7. RLS POLICIES on new tables
-- ============================================================================

-- 7a. mentor_profiles
DROP POLICY IF EXISTS admin_manage_mentor_profiles ON mentor_profiles;
CREATE POLICY admin_manage_mentor_profiles ON mentor_profiles FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS mentor_own_profile ON mentor_profiles;
CREATE POLICY mentor_own_profile ON mentor_profiles FOR ALL
    USING (id = auth.uid());

DROP POLICY IF EXISTS staff_view_mentor_profiles ON mentor_profiles;
CREATE POLICY staff_view_mentor_profiles ON mentor_profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr'])));

-- 7b. mentor_sessions
DROP POLICY IF EXISTS entrepreneur_view_own_sessions ON mentor_sessions;
CREATE POLICY entrepreneur_view_own_sessions ON mentor_sessions FOR SELECT
    USING (EXISTS (SELECT 1 FROM ventures v WHERE v.id = mentor_sessions.venture_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS mentor_own_sessions ON mentor_sessions;
CREATE POLICY mentor_own_sessions ON mentor_sessions FOR ALL
    USING (mentor_id = auth.uid());

DROP POLICY IF EXISTS staff_create_sessions ON mentor_sessions;
CREATE POLICY staff_create_sessions ON mentor_sessions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','venture_mgr','committee_member'])));

DROP POLICY IF EXISTS staff_view_sessions ON mentor_sessions;
CREATE POLICY staff_view_sessions ON mentor_sessions FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr'])));

-- 7c. mentor_venture_assignments
DROP POLICY IF EXISTS admin_manage_assignments ON mentor_venture_assignments;
CREATE POLICY admin_manage_assignments ON mentor_venture_assignments FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','venture_mgr','committee_member'])));

DROP POLICY IF EXISTS mentor_own_assignments ON mentor_venture_assignments;
CREATE POLICY mentor_own_assignments ON mentor_venture_assignments FOR SELECT
    USING (mentor_id = auth.uid());

DROP POLICY IF EXISTS staff_view_assignments ON mentor_venture_assignments;
CREATE POLICY staff_view_assignments ON mentor_venture_assignments FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr'])));

-- 7d. meeting_summaries
DROP POLICY IF EXISTS ms_entrepreneur ON meeting_summaries;
CREATE POLICY ms_entrepreneur ON meeting_summaries FOR SELECT
    USING (EXISTS (SELECT 1 FROM mentor_sessions ms JOIN ventures v ON v.id = ms.venture_id
        WHERE ms.id = meeting_summaries.session_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS ms_staff ON meeting_summaries;
CREATE POLICY ms_staff ON meeting_summaries FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr','mentor'])));

-- 7e. meeting_transcripts
DROP POLICY IF EXISTS mt_entrepreneur ON meeting_transcripts;
CREATE POLICY mt_entrepreneur ON meeting_transcripts FOR SELECT
    USING (EXISTS (SELECT 1 FROM mentor_sessions ms JOIN ventures v ON v.id = ms.venture_id
        WHERE ms.id = meeting_transcripts.session_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS mt_staff ON meeting_transcripts;
CREATE POLICY mt_staff ON meeting_transcripts FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr','mentor'])));

-- 7f. session_insight_snapshots
DROP POLICY IF EXISTS sis_staff ON session_insight_snapshots;
CREATE POLICY sis_staff ON session_insight_snapshots FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr','mentor'])));

-- 7g. pre_meeting_briefs
DROP POLICY IF EXISTS pmb_entrepreneur ON pre_meeting_briefs;
CREATE POLICY pmb_entrepreneur ON pre_meeting_briefs FOR SELECT
    USING (EXISTS (SELECT 1 FROM ventures v WHERE v.id = pre_meeting_briefs.venture_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS pmb_staff ON pre_meeting_briefs;
CREATE POLICY pmb_staff ON pre_meeting_briefs FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr','mentor'])));

-- 7h. meeting_requests
DROP POLICY IF EXISTS mr_entrepreneur_venture ON meeting_requests;
CREATE POLICY mr_entrepreneur_venture ON meeting_requests FOR SELECT
    USING (EXISTS (SELECT 1 FROM ventures v WHERE v.id = meeting_requests.venture_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS mr_expert_own ON meeting_requests;
CREATE POLICY mr_expert_own ON meeting_requests FOR ALL
    USING (expert_id = auth.uid());

DROP POLICY IF EXISTS mr_requester_own ON meeting_requests;
CREATE POLICY mr_requester_own ON meeting_requests FOR ALL
    USING (requested_by = auth.uid());

DROP POLICY IF EXISTS mr_staff_read ON meeting_requests;
CREATE POLICY mr_staff_read ON meeting_requests FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr'])));

-- 7i. expert_availability
DROP POLICY IF EXISTS expert_availability_entrepreneur_read ON expert_availability;
CREATE POLICY expert_availability_entrepreneur_read ON expert_availability FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'entrepreneur'));

DROP POLICY IF EXISTS expert_availability_own ON expert_availability;
CREATE POLICY expert_availability_own ON expert_availability FOR ALL
    USING (expert_id = (SELECT id FROM profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS expert_availability_staff_read ON expert_availability;
CREATE POLICY expert_availability_staff_read ON expert_availability FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr'])));

-- 7j. expert_matching_cache
DROP POLICY IF EXISTS emc_staff_all ON expert_matching_cache;
CREATE POLICY emc_staff_all ON expert_matching_cache FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','venture_mgr','committee_member','success_mgr','entrepreneur'])));

-- 7k. vpvm_availability
DROP POLICY IF EXISTS staff_view_all_availability ON vpvm_availability;
CREATE POLICY staff_view_all_availability ON vpvm_availability FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','success_mgr'])));

DROP POLICY IF EXISTS users_manage_own_availability ON vpvm_availability;
CREATE POLICY users_manage_own_availability ON vpvm_availability FOR ALL
    USING (user_id = auth.uid());

-- 7l. vpvm_blocked_dates
DROP POLICY IF EXISTS staff_view_all_blocked_dates ON vpvm_blocked_dates;
CREATE POLICY staff_view_all_blocked_dates ON vpvm_blocked_dates FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
        AND profiles.role = ANY (ARRAY['admin','ops_manager','success_mgr'])));

DROP POLICY IF EXISTS users_manage_own_blocked_dates ON vpvm_blocked_dates;
CREATE POLICY users_manage_own_blocked_dates ON vpvm_blocked_dates FOR ALL
    USING (user_id = auth.uid());


-- ============================================================================
-- 8. ADDITIVE MENTOR POLICIES on existing tables
--    These reference mentor_venture_assignments (created above) and grant
--    assigned mentors read access to the relevant venture-scoped tables.
-- ============================================================================

DROP POLICY IF EXISTS mentor_view_assigned_ventures ON ventures;
CREATE POLICY mentor_view_assigned_ventures ON ventures FOR SELECT
    USING (EXISTS (SELECT 1 FROM mentor_venture_assignments mva
        WHERE mva.venture_id = ventures.id AND mva.mentor_id = auth.uid() AND mva.status = 'active'));

DROP POLICY IF EXISTS mentor_view_assigned_venture_apps ON venture_applications;
CREATE POLICY mentor_view_assigned_venture_apps ON venture_applications FOR SELECT
    USING (EXISTS (SELECT 1 FROM mentor_venture_assignments mva
        WHERE mva.venture_id = venture_applications.venture_id AND mva.mentor_id = auth.uid() AND mva.status = 'active'));

DROP POLICY IF EXISTS mentor_view_assigned_venture_deliverables ON venture_deliverables;
CREATE POLICY mentor_view_assigned_venture_deliverables ON venture_deliverables FOR SELECT
    USING (EXISTS (SELECT 1 FROM mentor_venture_assignments mva
        WHERE mva.venture_id = venture_deliverables.venture_id AND mva.mentor_id = auth.uid() AND mva.status = 'active'));

DROP POLICY IF EXISTS mentor_view_assigned_venture_roadmaps ON venture_roadmaps;
CREATE POLICY mentor_view_assigned_venture_roadmaps ON venture_roadmaps FOR SELECT
    USING (EXISTS (SELECT 1 FROM mentor_venture_assignments mva
        WHERE mva.venture_id = venture_roadmaps.venture_id AND mva.mentor_id = auth.uid() AND mva.status = 'active'));

DROP POLICY IF EXISTS mentor_view_assigned_venture_streams ON venture_streams;
CREATE POLICY mentor_view_assigned_venture_streams ON venture_streams FOR SELECT
    USING (EXISTS (SELECT 1 FROM mentor_venture_assignments mva
        WHERE mva.venture_id = venture_streams.venture_id AND mva.mentor_id = auth.uid() AND mva.status = 'active'));


COMMIT;

-- ============================================================================
-- DONE. Verify with:
--   SELECT table_name FROM information_schema.tables
--     WHERE table_schema='public' AND table_type='BASE TABLE'
--     ORDER BY table_name;
--   -- Should now list 33 tables (same as dev).
--
--   SELECT conname FROM pg_constraint WHERE conname = 'profiles_role_check';
--   -- Should show the widened constraint (includes 'mentor').
-- ============================================================================
