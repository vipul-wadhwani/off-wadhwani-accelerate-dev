-- Add 'Assign VP/VM' and 'With VP/VM' statuses to ventures
ALTER TABLE ventures DROP CONSTRAINT IF EXISTS valid_status;
ALTER TABLE ventures ADD CONSTRAINT valid_status CHECK (status IN (
  'Draft', 'Submitted', 'Under Review', 'Panel Review',
  'Approved', 'Assign VP/VM', 'With VP/VM',
  'Agreement Sent', 'Agreement Signed', 'Joined Program',
  'Active', 'Completed', 'Rejected', 'Withdrawn'
));
