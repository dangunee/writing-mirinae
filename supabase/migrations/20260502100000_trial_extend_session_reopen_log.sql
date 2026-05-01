-- Audit: admin extend-access reopened missed trial runtime sessions (writing.sessions scoped by trial_application_id).
CREATE TABLE IF NOT EXISTS writing.trial_extend_session_reopen_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL,
  previous_status text NOT NULL,
  previous_runtime_status text,
  new_due_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE writing.trial_extend_session_reopen_log IS 'Missed trial sessions reopened after admin extend-access (due_at aligned to new access window).';

CREATE INDEX IF NOT EXISTS trial_extend_session_reopen_log_app_idx
  ON writing.trial_extend_session_reopen_log (application_id);

CREATE INDEX IF NOT EXISTS trial_extend_session_reopen_log_created_idx
  ON writing.trial_extend_session_reopen_log (created_at DESC);
