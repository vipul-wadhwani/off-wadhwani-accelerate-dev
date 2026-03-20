-- =============================================================================
-- PRODUCTION DATABASE MIGRATION
-- Source: Accelerate-dev-active (gheqxkxsjhkdbhmdntmh)
-- Target: Accelerate-v1-prod  (jenyuppryecuirvvlvkb)
-- Generated: 2026-03-20
-- =============================================================================
-- DO NOT RUN THIS ON DEV. This file is for prod only.
-- Run via Supabase SQL editor or apply_migration on the prod project.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1: Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- -----------------------------------------------------------------------------
-- STEP 2: Custom ENUM types
-- -----------------------------------------------------------------------------
CREATE TYPE public.expansion_type AS ENUM (
    'international',
    'domestic'
);

CREATE TYPE public.final_recommendation AS ENUM (
    'proceed',
    'hold',
    'revisit_later'
);

CREATE TYPE public.program_category AS ENUM (
    'core',
    'select'
);

CREATE TYPE public.stream_status AS ENUM (
    'not_started',
    'on_track',
    'need_some_advice',
    'need_deep_support',
    'completed'
);


-- -----------------------------------------------------------------------------
-- STEP 3: Tables (ordered by dependency)
-- -----------------------------------------------------------------------------

-- 3.1 programs (no FK dependencies within public schema)
CREATE TABLE public.programs (
    id          uuid          NOT NULL DEFAULT uuid_generate_v4(),
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    name        text          NOT NULL,
    description text,
    tier        integer       NOT NULL,
    min_revenue numeric,
    max_revenue numeric,
    support_hours_allocated integer DEFAULT 0,
    duration_months         integer,
    is_active   boolean       NOT NULL DEFAULT true,
    metadata    jsonb         DEFAULT '{}'::jsonb,
    CONSTRAINT programs_pkey PRIMARY KEY (id),
    CONSTRAINT programs_name_key UNIQUE (name)
);

-- 3.2 panelists (no FK dependencies within public schema)
CREATE TABLE public.panelists (
    id         uuid        NOT NULL DEFAULT uuid_generate_v4(),
    name       text        NOT NULL,
    email      text        NOT NULL,
    phone      text,
    program    text        NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT panelists_pkey PRIMARY KEY (id),
    CONSTRAINT panelists_email_key UNIQUE (email)
);

-- 3.3 profiles (FK to auth.users)
CREATE TABLE public.profiles (
    id            uuid        NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    full_name     text        NOT NULL,
    email         text,
    phone         text,
    avatar_url    text,
    role          text        NOT NULL,
    is_active     boolean     NOT NULL DEFAULT true,
    last_login_at timestamptz,
    preferences   jsonb       DEFAULT '{}'::jsonb,
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.4 ventures (FK to programs, profiles, panelists, auth.users)
CREATE TABLE public.ventures (
    id                    uuid        NOT NULL DEFAULT uuid_generate_v4(),
    user_id               uuid,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    name                  text        NOT NULL,
    founder_name          text,
    city                  text,
    location              text,
    program_id            uuid,
    program_name          text,
    status                text        NOT NULL DEFAULT 'Draft'::text,
    assigned_vsm_id       uuid,
    assigned_vm_id        uuid,
    venture_partner       text,
    workbench_locked      boolean     NOT NULL DEFAULT true,
    locked_reason         text,
    deleted_at            timestamptz,
    deleted_by            uuid,
    assigned_panelist_id  uuid,
    agreement_status      text        DEFAULT 'Draft'::text,
    agreement_accepted_at timestamptz,
    CONSTRAINT ventures_pkey PRIMARY KEY (id),
    CONSTRAINT ventures_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE RESTRICT,
    CONSTRAINT ventures_program_id_fkey FOREIGN KEY (program_id)
        REFERENCES public.programs (id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT ventures_assigned_vsm_id_fkey FOREIGN KEY (assigned_vsm_id)
        REFERENCES public.profiles (id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT ventures_assigned_vm_id_fkey FOREIGN KEY (assigned_vm_id)
        REFERENCES public.profiles (id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT ventures_deleted_by_fkey FOREIGN KEY (deleted_by)
        REFERENCES public.profiles (id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT ventures_assigned_panelist_id_fkey FOREIGN KEY (assigned_panelist_id)
        REFERENCES public.panelists (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.5 venture_applications (FK to ventures)
CREATE TABLE public.venture_applications (
    id                         uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id                 uuid        NOT NULL,
    created_at                 timestamptz NOT NULL DEFAULT now(),
    updated_at                 timestamptz NOT NULL DEFAULT now(),
    registered_company_name    text,
    company_type               text,
    what_do_you_sell           text,
    who_do_you_sell_to         text,
    which_regions              text,
    founder_email              text,
    founder_phone              text,
    founder_designation        text,
    referred_by                text,
    revenue_12m                text,
    revenue_potential_3y       text,
    min_investment             numeric,
    full_time_employees        text,
    incremental_hiring         text,
    growth_focus               text[],
    focus_product              text,
    focus_segment              text,
    focus_geography            text,
    blockers                   text,
    support_request            text,
    state                      text,
    corporate_presentation_url text,
    additional_data            jsonb       DEFAULT '{}'::jsonb,
    revenue_potential_12m      text,
    target_jobs                integer,
    financial_condition        text,
    time_commitment            text,
    second_line_team           text,
    CONSTRAINT venture_applications_pkey PRIMARY KEY (id),
    CONSTRAINT venture_applications_venture_id_key UNIQUE (venture_id),
    CONSTRAINT venture_applications_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE
);

-- 3.6 venture_assessments (FK to ventures, auth.users, self-referential)
CREATE TABLE public.venture_assessments (
    id                          uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id                  uuid        NOT NULL,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    assessment_version          integer     NOT NULL DEFAULT 1,
    supersedes_id               uuid,
    is_current                  boolean     NOT NULL DEFAULT true,
    assessed_by                 uuid        NOT NULL,
    assessor_role               text        NOT NULL,
    assessment_type             text        NOT NULL,
    assessment_date             timestamptz NOT NULL DEFAULT now(),
    notes                       text,
    internal_comments           text,
    ai_analysis                 jsonb,
    ai_generated_at             timestamptz,
    program_recommendation      text,
    decision                    text,
    decision_rationale          text,
    assessment_duration_minutes integer,
    panel_ai_analysis           jsonb,
    panel_ai_generated_at       timestamptz,
    gate_questions              jsonb,
    CONSTRAINT venture_assessments_pkey PRIMARY KEY (id),
    CONSTRAINT venture_assessments_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_assessments_assessed_by_fkey FOREIGN KEY (assessed_by)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT venture_assessments_supersedes_id_fkey FOREIGN KEY (supersedes_id)
        REFERENCES public.venture_assessments (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.7 venture_streams (FK to ventures, profiles)
CREATE TABLE public.venture_streams (
    id                    uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id            uuid        NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    stream_name           text        NOT NULL,
    owner_id              uuid,
    owner_name            text,
    status                text        NOT NULL DEFAULT 'Not started'::text,
    end_date              date,
    end_output            text,
    sprint_deliverable    text,
    completion_percentage integer     DEFAULT 0,
    CONSTRAINT venture_streams_pkey PRIMARY KEY (id),
    CONSTRAINT unique_venture_stream UNIQUE (venture_id, stream_name),
    CONSTRAINT venture_streams_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_streams_owner_id_fkey FOREIGN KEY (owner_id)
        REFERENCES public.profiles (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.8 venture_milestones (FK to ventures, venture_streams, profiles)
CREATE TABLE public.venture_milestones (
    id                  uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id          uuid        NOT NULL,
    stream_id           uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    category            text        NOT NULL,
    title               text        NOT NULL,
    description         text,
    status              text        NOT NULL DEFAULT 'Pending'::text,
    due_date            date,
    completed_at        timestamptz,
    assigned_to_id      uuid,
    progress_percentage integer     DEFAULT 0,
    CONSTRAINT venture_milestones_pkey PRIMARY KEY (id),
    CONSTRAINT venture_milestones_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_milestones_stream_id_fkey FOREIGN KEY (stream_id)
        REFERENCES public.venture_streams (id) ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT venture_milestones_assigned_to_id_fkey FOREIGN KEY (assigned_to_id)
        REFERENCES public.profiles (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.9 venture_deliverables (FK to ventures, venture_streams, venture_milestones, profiles)
CREATE TABLE public.venture_deliverables (
    id             uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id     uuid        NOT NULL,
    stream_id      uuid,
    milestone_id   uuid,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    title          text        NOT NULL,
    description    text,
    status         text        NOT NULL DEFAULT 'pending'::text,
    priority       text        DEFAULT 'medium'::text,
    assigned_to_id uuid,
    due_date       date,
    completed_at   timestamptz,
    display_order  integer     DEFAULT 0,
    roadmap_key    text,
    notes          text,
    attachments    jsonb       DEFAULT '[]'::jsonb,
    CONSTRAINT venture_deliverables_pkey PRIMARY KEY (id),
    CONSTRAINT venture_deliverables_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_deliverables_stream_id_fkey FOREIGN KEY (stream_id)
        REFERENCES public.venture_streams (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_deliverables_milestone_id_fkey FOREIGN KEY (milestone_id)
        REFERENCES public.venture_milestones (id) ON UPDATE NO ACTION ON DELETE SET NULL,
    CONSTRAINT venture_deliverables_assigned_to_id_fkey FOREIGN KEY (assigned_to_id)
        REFERENCES public.profiles (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.10 venture_roadmaps (FK to ventures, auth.users, venture_assessments, self-referential)
CREATE TABLE public.venture_roadmaps (
    id                          uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id                  uuid        NOT NULL,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    roadmap_version             integer     NOT NULL DEFAULT 1,
    supersedes_id               uuid,
    is_current                  boolean     NOT NULL DEFAULT true,
    generated_by                uuid        NOT NULL,
    generation_source           text        NOT NULL,
    based_on_assessment_id      uuid,
    roadmap_data                jsonb       NOT NULL,
    generation_duration_seconds integer,
    generation_model            text,
    CONSTRAINT venture_roadmaps_pkey PRIMARY KEY (id),
    CONSTRAINT venture_roadmaps_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_roadmaps_generated_by_fkey FOREIGN KEY (generated_by)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT venture_roadmaps_based_on_assessment_id_fkey FOREIGN KEY (based_on_assessment_id)
        REFERENCES public.venture_assessments (id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT venture_roadmaps_supersedes_id_fkey FOREIGN KEY (supersedes_id)
        REFERENCES public.venture_roadmaps (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.11 venture_agreements (FK to ventures, auth.users)
CREATE TABLE public.venture_agreements (
    id                uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id        uuid        NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    agreement_type    text        NOT NULL,
    version           integer     NOT NULL DEFAULT 1,
    content_url       text,
    generated_content jsonb,
    status            text        NOT NULL DEFAULT 'Draft'::text,
    sent_at           timestamptz,
    viewed_at         timestamptz,
    signed_at         timestamptz,
    expires_at        timestamptz,
    generated_by      uuid,
    signed_by         uuid,
    signature_data    jsonb,
    CONSTRAINT venture_agreements_pkey PRIMARY KEY (id),
    CONSTRAINT venture_agreements_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_agreements_generated_by_fkey FOREIGN KEY (generated_by)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE NO ACTION,
    CONSTRAINT venture_agreements_signed_by_fkey FOREIGN KEY (signed_by)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.12 venture_interactions (FK to ventures, auth.users)
CREATE TABLE public.venture_interactions (
    id               uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id       uuid        NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    interaction_type text        NOT NULL DEFAULT 'call'::text,
    title            text,
    transcript       text        NOT NULL,
    created_by       uuid        NOT NULL,
    interaction_date timestamptz NOT NULL DEFAULT now(),
    duration_minutes integer,
    participants     text[],
    deleted_at       timestamptz,
    CONSTRAINT venture_interactions_pkey PRIMARY KEY (id),
    CONSTRAINT venture_interactions_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_interactions_created_by_fkey FOREIGN KEY (created_by)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.13 venture_status_history (FK to ventures, auth.users)
CREATE TABLE public.venture_status_history (
    id             uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id     uuid        NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    status_type    text        NOT NULL,
    previous_value text,
    new_value      text        NOT NULL,
    changed_by     uuid        NOT NULL,
    changed_by_role text,
    change_reason  text,
    notes          text,
    metadata       jsonb       DEFAULT '{}'::jsonb,
    CONSTRAINT venture_status_history_pkey PRIMARY KEY (id),
    CONSTRAINT venture_status_history_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT venture_status_history_changed_by_fkey FOREIGN KEY (changed_by)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.14 support_hours (FK to ventures) — has a generated column
CREATE TABLE public.support_hours (
    id               uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id       uuid        NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    allocated        numeric     NOT NULL DEFAULT 0,
    used             numeric     NOT NULL DEFAULT 0,
    balance          numeric     GENERATED ALWAYS AS (allocated - used) STORED,
    last_activity_at timestamptz,
    CONSTRAINT support_hours_pkey PRIMARY KEY (id),
    CONSTRAINT support_hours_venture_id_key UNIQUE (venture_id),
    CONSTRAINT support_hours_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE
);

-- 3.15 panelist_availability (FK to panelists)
CREATE TABLE public.panelist_availability (
    id          uuid      NOT NULL DEFAULT gen_random_uuid(),
    panelist_id uuid      NOT NULL,
    day_of_week smallint  NOT NULL,
    start_time  time      NOT NULL,
    end_time    time      NOT NULL,
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT panelist_availability_pkey PRIMARY KEY (id),
    CONSTRAINT panelist_availability_panelist_id_day_of_week_start_time_key
        UNIQUE (panelist_id, day_of_week, start_time),
    CONSTRAINT panelist_availability_panelist_id_fkey FOREIGN KEY (panelist_id)
        REFERENCES public.panelists (id) ON UPDATE NO ACTION ON DELETE CASCADE
);

-- 3.16 panelist_blocked_dates (FK to panelists)
CREATE TABLE public.panelist_blocked_dates (
    id           uuid  NOT NULL DEFAULT gen_random_uuid(),
    panelist_id  uuid  NOT NULL,
    blocked_date date  NOT NULL,
    created_at   timestamptz DEFAULT now(),
    CONSTRAINT panelist_blocked_dates_pkey PRIMARY KEY (id),
    CONSTRAINT panelist_blocked_dates_panelist_id_blocked_date_key
        UNIQUE (panelist_id, blocked_date),
    CONSTRAINT panelist_blocked_dates_panelist_id_fkey FOREIGN KEY (panelist_id)
        REFERENCES public.panelists (id) ON UPDATE NO ACTION ON DELETE CASCADE
);

-- 3.17 scheduled_calls (FK to ventures, panelists, profiles)
CREATE TABLE public.scheduled_calls (
    id                  uuid        NOT NULL DEFAULT uuid_generate_v4(),
    venture_id          uuid        NOT NULL,
    panelist_id         uuid        NOT NULL,
    scheduled_by        uuid        NOT NULL,
    call_date           date        NOT NULL,
    start_time          time        NOT NULL,
    end_time            time        NOT NULL,
    status              text        NOT NULL DEFAULT 'scheduled'::text,
    meet_link           text,
    notes               text,
    cancellation_reason text,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now(),
    cancelled_at        timestamptz,
    completed_at        timestamptz,
    CONSTRAINT scheduled_calls_pkey PRIMARY KEY (id),
    CONSTRAINT scheduled_calls_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scheduled_calls_panelist_id_fkey FOREIGN KEY (panelist_id)
        REFERENCES public.panelists (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT scheduled_calls_scheduled_by_fkey FOREIGN KEY (scheduled_by)
        REFERENCES public.profiles (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

-- 3.18 panel_feedback (FK to ventures, auth.users)
CREATE TABLE public.panel_feedback (
    id                             uuid                    NOT NULL DEFAULT gen_random_uuid(),
    venture_id                     uuid                    NOT NULL,
    panel_expert_name              text                    NOT NULL,
    panel_date                     date                    NOT NULL DEFAULT CURRENT_DATE,
    sme_name                       text,
    business_overview              text,
    annual_revenue_actuals         text,
    projected_annual_revenue       text,
    rating_financial_health        smallint,
    rating_leadership              smallint,
    insights_financial_health      text,
    insights_leadership            text,
    proposed_expansion_idea        text,
    selected_expansion_type        public.expansion_type,
    market_entry_routes            text[],
    expansion_idea_description     text,
    current_progress               text,
    incremental_revenue_3y         text,
    incremental_jobs_3y            text,
    rating_clarity_expansion       smallint,
    comments_clarity_expansion     text,
    stream_gtm                     public.stream_status,
    stream_product_quality         public.stream_status,
    stream_operations              public.stream_status,
    stream_supply_chain            public.stream_status,
    stream_org_design              public.stream_status,
    stream_finance                 public.stream_status,
    support_type_proposal          text,
    risks_red_flags                text,
    final_recommendation           public.final_recommendation,
    program_category               public.program_category,
    additional_notes               text,
    submitted_by                   uuid,
    created_at                     timestamptz             NOT NULL DEFAULT now(),
    updated_at                     timestamptz             NOT NULL DEFAULT now(),
    stream_gtm_comments            text,
    stream_product_quality_comments text,
    stream_operations_comments     text,
    stream_supply_chain_comments   text,
    stream_org_design_comments     text,
    stream_finance_comments        text,
    growth_venture_type            text,
    growth_initiative_description  text,
    rating_business_model_clarity  smallint,
    rating_historical_growth       smallint,
    rating_financial_readiness     smallint,
    rating_team_leadership         smallint,
    rating_execution_seriousness   smallint,
    program_fit_job_creation       text,
    annual_revenue_fy26_27         text,
    revenue_target_3y_assumptions  text,
    growth_idea_types              text[],
    describe_new_product           text,
    describe_new_customer          text,
    describe_new_geography         text,
    CONSTRAINT panel_feedback_pkey PRIMARY KEY (id),
    CONSTRAINT panel_feedback_venture_id_fkey FOREIGN KEY (venture_id)
        REFERENCES public.ventures (id) ON UPDATE NO ACTION ON DELETE CASCADE,
    CONSTRAINT panel_feedback_submitted_by_fkey FOREIGN KEY (submitted_by)
        REFERENCES auth.users (id) ON UPDATE NO ACTION ON DELETE NO ACTION
);


-- -----------------------------------------------------------------------------
-- STEP 4: Functions (must exist before triggers)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_panel_feedback_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_support_hours_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
    -- Get allocated hours from program
    INSERT INTO support_hours (venture_id, allocated, used)
    SELECT NEW.id, COALESCE(p.support_hours_allocated, 0), 0
    FROM programs p
    WHERE p.id = NEW.program_id
    ON CONFLICT (venture_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_venture_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO venture_status_history (
      venture_id, status_type, previous_value, new_value, changed_by, changed_by_role
    ) VALUES (
      NEW.id,
      'application',
      OLD.status,
      NEW.status,
      auth.uid(),
      (SELECT role FROM profiles WHERE id = auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$function$;


-- -----------------------------------------------------------------------------
-- STEP 5: Triggers
-- -----------------------------------------------------------------------------

-- panel_feedback
CREATE TRIGGER panel_feedback_updated_at
    BEFORE UPDATE ON public.panel_feedback
    FOR EACH ROW EXECUTE FUNCTION public.update_panel_feedback_updated_at();

-- profiles
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- programs
CREATE TRIGGER update_programs_updated_at
    BEFORE UPDATE ON public.programs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- support_hours
CREATE TRIGGER update_support_hours_updated_at
    BEFORE UPDATE ON public.support_hours
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- venture_agreements
CREATE TRIGGER update_venture_agreements_updated_at
    BEFORE UPDATE ON public.venture_agreements
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- venture_applications
CREATE TRIGGER update_venture_applications_updated_at
    BEFORE UPDATE ON public.venture_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- venture_assessments
CREATE TRIGGER update_venture_assessments_updated_at
    BEFORE UPDATE ON public.venture_assessments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- venture_deliverables
CREATE TRIGGER update_venture_deliverables_updated_at
    BEFORE UPDATE ON public.venture_deliverables
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- venture_interactions
CREATE TRIGGER update_venture_interactions_updated_at
    BEFORE UPDATE ON public.venture_interactions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- venture_milestones
CREATE TRIGGER update_venture_milestones_updated_at
    BEFORE UPDATE ON public.venture_milestones
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- venture_streams
CREATE TRIGGER update_venture_streams_updated_at
    BEFORE UPDATE ON public.venture_streams
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ventures (3 triggers)
CREATE TRIGGER update_ventures_updated_at
    BEFORE UPDATE ON public.ventures
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER auto_create_support_hours
    AFTER UPDATE ON public.ventures
    FOR EACH ROW EXECUTE FUNCTION public.create_support_hours_on_approval();

CREATE TRIGGER track_venture_status_changes
    AFTER UPDATE ON public.ventures
    FOR EACH ROW EXECUTE FUNCTION public.log_venture_status_change();


-- -----------------------------------------------------------------------------
-- STEP 6: Additional non-PK/non-unique indexes
-- -----------------------------------------------------------------------------

-- panel_feedback
CREATE INDEX idx_panel_feedback_venture_id
    ON public.panel_feedback USING btree (venture_id);
CREATE INDEX idx_panel_feedback_submitted_by
    ON public.panel_feedback USING btree (submitted_by);

-- panelists
CREATE INDEX idx_panelists_email
    ON public.panelists USING btree (email);
CREATE INDEX idx_panelists_program
    ON public.panelists USING btree (program);

-- profiles
CREATE INDEX idx_profiles_email
    ON public.profiles USING btree (email);
CREATE INDEX idx_profiles_role
    ON public.profiles USING btree (role) WHERE (is_active = true);
CREATE INDEX idx_profiles_updated_at
    ON public.profiles USING btree (updated_at DESC);

-- scheduled_calls
CREATE INDEX idx_scheduled_calls_venture_id
    ON public.scheduled_calls USING btree (venture_id);
CREATE INDEX idx_scheduled_calls_panelist_id
    ON public.scheduled_calls USING btree (panelist_id);
CREATE INDEX idx_scheduled_calls_call_date
    ON public.scheduled_calls USING btree (call_date);
CREATE INDEX idx_scheduled_calls_status
    ON public.scheduled_calls USING btree (status);

-- support_hours
CREATE INDEX idx_support_hours_venture_id
    ON public.support_hours USING btree (venture_id);
CREATE INDEX idx_support_hours_balance
    ON public.support_hours USING btree ((allocated - used)) WHERE ((allocated - used) > 0);

-- venture_agreements
CREATE INDEX idx_agreements_venture_id
    ON public.venture_agreements USING btree (venture_id);
CREATE INDEX idx_agreements_status
    ON public.venture_agreements USING btree (status);
CREATE INDEX idx_agreements_sent_at
    ON public.venture_agreements USING btree (sent_at DESC) WHERE (sent_at IS NOT NULL);

-- venture_applications
CREATE INDEX idx_applications_venture_id
    ON public.venture_applications USING btree (venture_id);
CREATE INDEX idx_applications_created_at
    ON public.venture_applications USING btree (created_at DESC);
CREATE INDEX idx_applications_revenue_12m
    ON public.venture_applications USING btree (revenue_12m) WHERE (revenue_12m IS NOT NULL);
CREATE INDEX idx_applications_revenue_potential_12m
    ON public.venture_applications USING btree (revenue_potential_12m) WHERE (revenue_potential_12m IS NOT NULL);
CREATE INDEX idx_applications_employees
    ON public.venture_applications USING btree (full_time_employees) WHERE (full_time_employees IS NOT NULL);

-- venture_assessments
CREATE INDEX idx_assessments_venture_id
    ON public.venture_assessments USING btree (venture_id);
CREATE INDEX idx_assessments_current
    ON public.venture_assessments USING btree (venture_id, is_current) WHERE (is_current = true);
CREATE UNIQUE INDEX idx_one_current_per_type
    ON public.venture_assessments USING btree (venture_id, assessment_type) WHERE (is_current = true);
CREATE INDEX idx_assessments_type
    ON public.venture_assessments USING btree (assessment_type, created_at DESC);
CREATE INDEX idx_assessments_assessor
    ON public.venture_assessments USING btree (assessed_by, created_at DESC);
CREATE INDEX idx_assessments_version
    ON public.venture_assessments USING btree (venture_id, assessment_version);
CREATE INDEX idx_assessments_ai_analysis
    ON public.venture_assessments USING gin (ai_analysis);

-- venture_deliverables
CREATE INDEX idx_deliverables_venture_id
    ON public.venture_deliverables USING btree (venture_id);
CREATE INDEX idx_deliverables_stream_id
    ON public.venture_deliverables USING btree (stream_id) WHERE (stream_id IS NOT NULL);
CREATE INDEX idx_deliverables_milestone_id
    ON public.venture_deliverables USING btree (milestone_id) WHERE (milestone_id IS NOT NULL);
CREATE INDEX idx_deliverables_status
    ON public.venture_deliverables USING btree (status);
CREATE INDEX idx_deliverables_due_date
    ON public.venture_deliverables USING btree (due_date) WHERE ((due_date IS NOT NULL) AND (status <> 'completed'));
CREATE INDEX idx_deliverables_assigned
    ON public.venture_deliverables USING btree (assigned_to_id) WHERE (assigned_to_id IS NOT NULL);
CREATE INDEX idx_deliverables_display_order
    ON public.venture_deliverables USING btree (venture_id, stream_id, display_order);

-- venture_interactions
CREATE INDEX idx_interactions_venture_id
    ON public.venture_interactions USING btree (venture_id);
CREATE INDEX idx_interactions_date
    ON public.venture_interactions USING btree (interaction_date DESC);
CREATE INDEX idx_interactions_type
    ON public.venture_interactions USING btree (interaction_type);
CREATE INDEX idx_interactions_created_by
    ON public.venture_interactions USING btree (created_by);
CREATE INDEX idx_interactions_not_deleted
    ON public.venture_interactions USING btree (venture_id, interaction_date DESC) WHERE (deleted_at IS NULL);

-- venture_milestones
CREATE INDEX idx_milestones_venture_id
    ON public.venture_milestones USING btree (venture_id);
CREATE INDEX idx_milestones_stream_id
    ON public.venture_milestones USING btree (stream_id) WHERE (stream_id IS NOT NULL);
CREATE INDEX idx_milestones_status
    ON public.venture_milestones USING btree (status);
CREATE INDEX idx_milestones_due_date
    ON public.venture_milestones USING btree (due_date) WHERE ((due_date IS NOT NULL) AND (status <> 'Completed'));
CREATE INDEX idx_milestones_assigned
    ON public.venture_milestones USING btree (assigned_to_id) WHERE (assigned_to_id IS NOT NULL);

-- venture_roadmaps
CREATE INDEX idx_roadmaps_venture_id
    ON public.venture_roadmaps USING btree (venture_id);
CREATE INDEX idx_roadmaps_current
    ON public.venture_roadmaps USING btree (venture_id, is_current) WHERE (is_current = true);
CREATE UNIQUE INDEX idx_one_current_roadmap
    ON public.venture_roadmaps USING btree (venture_id) WHERE (is_current = true);
CREATE INDEX idx_roadmaps_version
    ON public.venture_roadmaps USING btree (venture_id, roadmap_version);
CREATE INDEX idx_roadmaps_generated_by
    ON public.venture_roadmaps USING btree (generated_by, created_at DESC);
CREATE INDEX idx_roadmaps_data
    ON public.venture_roadmaps USING gin (roadmap_data);

-- venture_status_history
CREATE INDEX idx_status_history_venture
    ON public.venture_status_history USING btree (venture_id, created_at DESC);
CREATE INDEX idx_status_history_type
    ON public.venture_status_history USING btree (status_type, created_at DESC);
CREATE INDEX idx_status_history_changed_by
    ON public.venture_status_history USING btree (changed_by, created_at DESC);

-- venture_streams
CREATE INDEX idx_streams_venture_id
    ON public.venture_streams USING btree (venture_id);
CREATE INDEX idx_streams_status
    ON public.venture_streams USING btree (status);
CREATE INDEX idx_streams_owner
    ON public.venture_streams USING btree (owner_id) WHERE (owner_id IS NOT NULL);

-- ventures
CREATE INDEX idx_ventures_user_id
    ON public.ventures USING btree (user_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_ventures_status
    ON public.ventures USING btree (status) WHERE (deleted_at IS NULL);
CREATE INDEX idx_ventures_program
    ON public.ventures USING btree (program_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_ventures_assigned_vsm
    ON public.ventures USING btree (assigned_vsm_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_ventures_assigned_vm
    ON public.ventures USING btree (assigned_vm_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_ventures_created_at
    ON public.ventures USING btree (created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX idx_ventures_name_search
    ON public.ventures USING gin (name gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- STEP 7: Enable Row Level Security
-- -----------------------------------------------------------------------------
-- (programs has RLS disabled in dev; all others enabled)

ALTER TABLE public.panel_feedback          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panelist_availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panelist_blocked_dates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panelists               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                ENABLE ROW LEVEL SECURITY;
-- programs: RLS is NOT enabled in dev (left disabled)
ALTER TABLE public.scheduled_calls         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_hours           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_agreements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_applications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_assessments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_deliverables    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_interactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_milestones      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_roadmaps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venture_streams         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventures                ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- STEP 8: RLS Policies
-- -----------------------------------------------------------------------------

-- ---- panel_feedback ----
CREATE POLICY "Authenticated users can insert panel feedback"
    ON public.panel_feedback
    AS PERMISSIVE FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can read panel feedback"
    ON public.panel_feedback
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own panel feedback"
    ON public.panel_feedback
    AS PERMISSIVE FOR UPDATE
    TO authenticated
    USING (submitted_by = auth.uid());


-- ---- panelist_availability ----
CREATE POLICY "Authenticated users can read panelist_availability"
    ON public.panelist_availability
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert panelist_availability"
    ON public.panelist_availability
    AS PERMISSIVE FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update panelist_availability"
    ON public.panelist_availability
    AS PERMISSIVE FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete panelist_availability"
    ON public.panelist_availability
    AS PERMISSIVE FOR DELETE
    TO authenticated
    USING (true);


-- ---- panelist_blocked_dates ----
CREATE POLICY "Authenticated users can read panelist_blocked_dates"
    ON public.panelist_blocked_dates
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert panelist_blocked_dates"
    ON public.panelist_blocked_dates
    AS PERMISSIVE FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update panelist_blocked_dates"
    ON public.panelist_blocked_dates
    AS PERMISSIVE FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete panelist_blocked_dates"
    ON public.panelist_blocked_dates
    AS PERMISSIVE FOR DELETE
    TO authenticated
    USING (true);


-- ---- panelists ----
CREATE POLICY "Allow authenticated users to read panelists"
    ON public.panelists
    AS PERMISSIVE FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow admins to manage panelists"
    ON public.panelists
    AS PERMISSIVE FOR ALL
    TO authenticated
    USING ((auth.jwt() ->> 'role'::text) = ANY (ARRAY['vsm'::text, 'venture_mgr'::text, 'committee'::text, 'admin'::text]));


-- ---- profiles ----
CREATE POLICY "Public profiles viewable by everyone"
    ON public.profiles
    AS PERMISSIVE FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles
    AS PERMISSIVE FOR INSERT
    TO public
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (auth.uid() = id);


-- ---- scheduled_calls ----
CREATE POLICY "Staff can view scheduled calls"
    ON public.scheduled_calls
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['ops_manager'::text, 'admin'::text, 'success_mgr'::text, 'venture_mgr'::text, 'committee_member'::text])
        )
    );

CREATE POLICY "Ops manager can insert scheduled calls"
    ON public.scheduled_calls
    AS PERMISSIVE FOR INSERT
    TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['ops_manager'::text, 'admin'::text])
        )
    );

CREATE POLICY "Ops manager can update scheduled calls"
    ON public.scheduled_calls
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['ops_manager'::text, 'admin'::text])
        )
    );


-- ---- support_hours ----
CREATE POLICY "staff_manage_support_hours"
    ON public.support_hours
    AS PERMISSIVE FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "users_view_own_support_hours"
    ON public.support_hours
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = support_hours.venture_id
              AND (
                  v.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM profiles
                      WHERE profiles.id = auth.uid()
                        AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
                        AND profiles.is_active = true
                  )
              )
              AND v.deleted_at IS NULL
        )
    );


-- ---- venture_agreements ----
CREATE POLICY "staff_manage_agreements"
    ON public.venture_agreements
    AS PERMISSIVE FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['committee_member'::text, 'admin'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "view_agreements_via_venture"
    ON public.venture_agreements
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_agreements.venture_id
              AND (
                  v.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM profiles
                      WHERE profiles.id = auth.uid()
                        AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
                        AND profiles.is_active = true
                  )
              )
              AND v.deleted_at IS NULL
        )
    );

CREATE POLICY "entrepreneurs_sign_agreements"
    ON public.venture_agreements
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_agreements.venture_id
              AND v.user_id = auth.uid()
        )
    )
    WITH CHECK (status = ANY (ARRAY['Viewed'::text, 'Signed'::text, 'Rejected'::text]));


-- ---- venture_applications ----
CREATE POLICY "view_applications_via_venture"
    ON public.venture_applications
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_applications.venture_id
              AND (
                  v.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM profiles
                      WHERE profiles.id = auth.uid()
                        AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
                        AND profiles.is_active = true
                  )
              )
              AND v.deleted_at IS NULL
        )
    );

CREATE POLICY "insert_own_applications"
    ON public.venture_applications
    AS PERMISSIVE FOR INSERT
    TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_applications.venture_id
              AND v.user_id = auth.uid()
        )
    );

CREATE POLICY "update_own_applications"
    ON public.venture_applications
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_applications.venture_id
              AND v.user_id = auth.uid()
              AND v.workbench_locked = false
        )
    );

CREATE POLICY "staff_update_applications"
    ON public.venture_applications
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );


-- ---- venture_assessments ----
CREATE POLICY "staff_view_assessments"
    ON public.venture_assessments
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "staff_create_assessments"
    ON public.venture_assessments
    AS PERMISSIVE FOR INSERT
    TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "staff_update_assessments"
    ON public.venture_assessments
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );


-- ---- venture_deliverables ----
CREATE POLICY "view_deliverables_via_venture"
    ON public.venture_deliverables
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_deliverables.venture_id
              AND (
                  v.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM profiles
                      WHERE profiles.id = auth.uid()
                        AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
                        AND profiles.is_active = true
                  )
              )
              AND v.deleted_at IS NULL
        )
    );

CREATE POLICY "staff_manage_deliverables"
    ON public.venture_deliverables
    AS PERMISSIVE FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "entrepreneurs_update_own_deliverables"
    ON public.venture_deliverables
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_deliverables.venture_id
              AND v.user_id = auth.uid()
              AND v.workbench_locked = false
        )
    );


-- ---- venture_interactions ----
CREATE POLICY "staff_view_interactions"
    ON public.venture_interactions
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "staff_create_interactions"
    ON public.venture_interactions
    AS PERMISSIVE FOR INSERT
    TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "staff_update_interactions"
    ON public.venture_interactions
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );


-- ---- venture_milestones ----
CREATE POLICY "users_view_own_milestones"
    ON public.venture_milestones
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_milestones.venture_id
              AND (
                  v.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM profiles
                      WHERE profiles.id = auth.uid()
                        AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
                        AND profiles.is_active = true
                  )
              )
              AND v.deleted_at IS NULL
        )
    );

CREATE POLICY "staff_manage_milestones"
    ON public.venture_milestones
    AS PERMISSIVE FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
              AND profiles.is_active = true
        )
    );


-- ---- venture_roadmaps ----
CREATE POLICY "staff_view_roadmaps"
    ON public.venture_roadmaps
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "entrepreneurs_view_own_roadmaps"
    ON public.venture_roadmaps
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_roadmaps.venture_id
              AND v.user_id = auth.uid()
              AND v.deleted_at IS NULL
        )
    );

CREATE POLICY "staff_create_roadmaps"
    ON public.venture_roadmaps
    AS PERMISSIVE FOR INSERT
    TO public
    WITH CHECK (
        (auth.uid() = generated_by)
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'committee_member'::text, 'venture_mgr'::text, 'admin'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "staff_update_roadmaps"
    ON public.venture_roadmaps
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
              AND profiles.is_active = true
        )
    );


-- ---- venture_status_history ----
CREATE POLICY "staff_view_history"
    ON public.venture_status_history
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "entrepreneurs_view_own_history"
    ON public.venture_status_history
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_status_history.venture_id
              AND v.user_id = auth.uid()
        )
    );


-- ---- venture_streams ----
CREATE POLICY "users_view_own_streams"
    ON public.venture_streams
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_streams.venture_id
              AND (
                  v.user_id = auth.uid()
                  OR EXISTS (
                      SELECT 1 FROM profiles
                      WHERE profiles.id = auth.uid()
                        AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
                        AND profiles.is_active = true
                  )
              )
              AND v.deleted_at IS NULL
        )
    );

CREATE POLICY "users_insert_own_streams"
    ON public.venture_streams
    AS PERMISSIVE FOR INSERT
    TO public
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_streams.venture_id
              AND v.user_id = auth.uid()
        )
    );

CREATE POLICY "users_update_own_streams"
    ON public.venture_streams
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM ventures v
            WHERE v.id = venture_streams.venture_id
              AND v.user_id = auth.uid()
              AND v.workbench_locked = false
        )
    );

CREATE POLICY "staff_manage_all_streams"
    ON public.venture_streams
    AS PERMISSIVE FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );


-- ---- ventures ----
CREATE POLICY "Entrepreneurs view own ventures"
    ON public.ventures
    AS PERMISSIVE FOR SELECT
    TO public
    USING ((auth.uid() = user_id) AND (deleted_at IS NULL));

CREATE POLICY "Entrepreneurs create own ventures"
    ON public.ventures
    AS PERMISSIVE FOR INSERT
    TO public
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Entrepreneurs update own draft ventures"
    ON public.ventures
    AS PERMISSIVE FOR UPDATE
    TO public
    USING ((auth.uid() = user_id) AND (status = 'Draft'::text) AND (deleted_at IS NULL));

CREATE POLICY "Entrepreneurs sign agreement on own ventures"
    ON public.ventures
    AS PERMISSIVE FOR UPDATE
    TO public
    USING ((auth.uid() = user_id) AND (deleted_at IS NULL))
    WITH CHECK ((auth.uid() = user_id) AND (deleted_at IS NULL));

CREATE POLICY "Staff view all ventures"
    ON public.ventures
    AS PERMISSIVE FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );

CREATE POLICY "Staff update ventures"
    ON public.ventures
    AS PERMISSIVE FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = ANY (ARRAY['success_mgr'::text, 'venture_mgr'::text, 'admin'::text, 'committee_member'::text, 'ops_manager'::text])
              AND profiles.is_active = true
        )
    );


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
