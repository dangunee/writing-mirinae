-- Soft-delete (trash) for trial application admin + audit trail.
-- Permanent delete is allowed only after trashed_at is set (API enforced).

ALTER TABLE writing.trial_applications
  ADD COLUMN IF NOT EXISTS trashed_at timestamptz,
  ADD COLUMN IF NOT EXISTS trashed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trash_reason text;

COMMENT ON COLUMN writing.trial_applications.trashed_at IS 'Set when admin moves application to trash; NULL = active.';
COMMENT ON COLUMN writing.trial_applications.trashed_by IS 'auth.users id of admin who trashed.';
COMMENT ON COLUMN writing.trial_applications.trash_reason IS 'Optional admin note for trash action.';

CREATE INDEX IF NOT EXISTS trial_applications_trashed_at_idx
  ON writing.trial_applications (trashed_at)
  WHERE trashed_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS writing.trial_application_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('trash', 'restore', 'permanent_delete')),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  trash_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE writing.trial_application_admin_audit IS 'Admin actions on trial applications (trash / restore / permanent_delete). application_id kept as uuid without FK so row survives hard delete.';

CREATE INDEX IF NOT EXISTS trial_application_admin_audit_app_idx
  ON writing.trial_application_admin_audit (application_id);

CREATE INDEX IF NOT EXISTS trial_application_admin_audit_created_idx
  ON writing.trial_application_admin_audit (created_at DESC);
