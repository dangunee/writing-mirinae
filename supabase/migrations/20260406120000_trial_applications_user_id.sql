-- Link anonymous trial applications to Supabase auth users by email (Step 1 account history).
ALTER TABLE writing.trial_applications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trial_applications_user_id_idx
  ON writing.trial_applications (user_id);
