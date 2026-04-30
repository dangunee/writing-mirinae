-- Trial runtime sessions: scope per trial_application_id (shared course/template row stays trial_application_id IS NULL).
ALTER TABLE writing.sessions
  ADD COLUMN trial_application_id uuid REFERENCES writing.trial_applications (id) ON DELETE RESTRICT;

ALTER TABLE writing.sessions
  DROP CONSTRAINT writing_sessions_course_index_unique;

CREATE UNIQUE INDEX writing_sessions_course_index_unique_non_trial
  ON writing.sessions (course_id, index)
  WHERE trial_application_id IS NULL;

CREATE UNIQUE INDEX writing_sessions_trial_app_index_unique
  ON writing.sessions (trial_application_id, index)
  WHERE trial_application_id IS NOT NULL;

CREATE INDEX idx_writing_sessions_trial_application_id ON writing.sessions (trial_application_id);
