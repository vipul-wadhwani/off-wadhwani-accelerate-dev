-- ============================================================================
-- DELIVERABLES: Current Status Enhancement
-- Adds start_date, owner to venture_deliverables
-- Creates deliverable_checklist_items and deliverable_notes tables
-- ============================================================================

-- 1. Add new columns to venture_deliverables
ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS owner text;

-- 2. DELIVERABLE_CHECKLIST_ITEMS TABLE
CREATE TABLE IF NOT EXISTS deliverable_checklist_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deliverable_id uuid NOT NULL REFERENCES venture_deliverables(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_deliverable ON deliverable_checklist_items(deliverable_id);

-- RLS for deliverable_checklist_items
ALTER TABLE deliverable_checklist_items ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "staff_manage_checklist"
  ON deliverable_checklist_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
    )
  );

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

CREATE TRIGGER update_checklist_items_updated_at
  BEFORE UPDATE ON deliverable_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. DELIVERABLE_NOTES TABLE
CREATE TABLE IF NOT EXISTS deliverable_notes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deliverable_id uuid NOT NULL REFERENCES venture_deliverables(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  action_items text[] DEFAULT '{}',
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_deliverable ON deliverable_notes(deliverable_id);

-- RLS for deliverable_notes
ALTER TABLE deliverable_notes ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "staff_manage_notes"
  ON deliverable_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
    )
  );

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
