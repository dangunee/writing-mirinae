-- Trial 体験作文: writing.submissions と trial_applications を紐付け（提出の source of truth は submissions 行）。
-- trial_applications 側に提出状態を二重保存しない。

ALTER TABLE writing.submissions
  ADD COLUMN IF NOT EXISTS trial_application_id uuid REFERENCES writing.trial_applications(id) ON DELETE CASCADE;

ALTER TABLE writing.submissions DROP CONSTRAINT IF EXISTS writing_submissions_user_or_grant_xor;
ALTER TABLE writing.submissions ADD CONSTRAINT writing_submissions_access_xor CHECK (
  (user_id IS NOT NULL AND regular_access_grant_id IS NULL AND trial_application_id IS NULL) OR
  (user_id IS NULL AND regular_access_grant_id IS NOT NULL AND trial_application_id IS NULL) OR
  (user_id IS NULL AND regular_access_grant_id IS NULL AND trial_application_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS writing_submissions_one_active_pipeline_per_trial
  ON writing.submissions (trial_application_id)
  WHERE trial_application_id IS NOT NULL AND status IN ('draft', 'submitted', 'in_review', 'corrected');

CREATE INDEX IF NOT EXISTS idx_writing_submissions_trial_application_id
  ON writing.submissions (trial_application_id)
  WHERE trial_application_id IS NOT NULL;
