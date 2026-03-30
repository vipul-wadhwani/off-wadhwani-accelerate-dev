-- Add kpi_status column to venture_applications for VP/VM KPI tracking
ALTER TABLE venture_applications ADD COLUMN IF NOT EXISTS kpi_status text DEFAULT 'Grey (Not Started Yet)';

-- Add composite index for VP/VM interaction filtering (created_by filter)
CREATE INDEX IF NOT EXISTS idx_interactions_venture_created ON venture_interactions(venture_id, created_by);
