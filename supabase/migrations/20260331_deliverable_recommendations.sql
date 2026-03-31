-- ============================================================================
-- DELIVERABLE_RECOMMENDATIONS TABLE
-- Stores AI-generated resource recommendations per deliverable
-- ============================================================================

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

CREATE INDEX idx_recommendations_deliverable ON deliverable_recommendations(deliverable_id);

-- RLS
ALTER TABLE deliverable_recommendations ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "staff_manage_recommendations"
  ON deliverable_recommendations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('success_mgr', 'admin', 'committee_member', 'venture_mgr')
    )
  );
