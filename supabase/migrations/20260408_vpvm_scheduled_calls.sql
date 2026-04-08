-- Add VP/VM call support to scheduled_calls table
ALTER TABLE scheduled_calls ADD COLUMN IF NOT EXISTS participant_type text DEFAULT 'panelist';
ALTER TABLE scheduled_calls ADD COLUMN IF NOT EXISTS participant_profile_id uuid REFERENCES profiles(id);

-- Make panelist_id nullable (VP/VM calls don't have a panelist)
ALTER TABLE scheduled_calls ALTER COLUMN panelist_id DROP NOT NULL;
