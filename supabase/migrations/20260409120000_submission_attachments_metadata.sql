-- submission_attachments: bucket name + optional original filename + page count (PDF optional later)

ALTER TABLE writing.submission_attachments
  ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'writing-submissions';

ALTER TABLE writing.submission_attachments
  ADD COLUMN IF NOT EXISTS original_filename text;

ALTER TABLE writing.submission_attachments
  ADD COLUMN IF NOT EXISTS page_count integer;

COMMENT ON COLUMN writing.submission_attachments.storage_bucket IS 'Private Supabase Storage bucket; not a public web path.';
COMMENT ON COLUMN writing.submission_attachments.original_filename IS 'Client-provided label for display only; never used as storage key.';
