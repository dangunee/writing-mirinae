-- 体験提出期限の24時間前リマインド（mirinae-api と同一 DDL）

CREATE TABLE IF NOT EXISTS writing.trial_reminder_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES writing.trial_applications(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  target_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trial_reminder_logs_status_check CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS trial_reminder_logs_application_id_reminder_type_unique
  ON writing.trial_reminder_logs (application_id, reminder_type);

CREATE INDEX IF NOT EXISTS trial_reminder_logs_application_id_idx
  ON writing.trial_reminder_logs (application_id);
