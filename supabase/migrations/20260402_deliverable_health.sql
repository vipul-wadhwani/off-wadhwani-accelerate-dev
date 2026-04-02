-- Add health field to venture_deliverables for RAG status on in-progress items
-- on_track (green), needs_attention (amber), at_risk (red)
ALTER TABLE venture_deliverables ADD COLUMN IF NOT EXISTS health text DEFAULT 'on_track'
  CHECK (health IN ('on_track', 'needs_attention', 'at_risk'));
