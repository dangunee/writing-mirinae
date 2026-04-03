-- Regular mail-link access: course binding + submissions by grant (no auth.users).
-- Replaces writing.fn_submissions_sync_course_and_owner to allow regular_access_grant_id XOR user_id.

-- ---------------------------------------------------------------------------
-- writing.regular_access_grants / tokens (if not yet applied from mirinae-api)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS writing.regular_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  student_email text NOT NULL,
  note text,
  access_enabled boolean NOT NULL DEFAULT true,
  access_ready_at timestamptz,
  access_expires_at timestamptz,
  last_access_at timestamptz,
  course_id uuid REFERENCES writing.courses (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS regular_access_grants_student_email_idx
  ON writing.regular_access_grants (student_email);

CREATE INDEX IF NOT EXISTS regular_access_grants_course_id_idx
  ON writing.regular_access_grants (course_id);

CREATE TABLE IF NOT EXISTS writing.regular_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regular_access_grant_id uuid NOT NULL REFERENCES writing.regular_access_grants (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regular_access_tokens_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS regular_access_tokens_grant_id_idx
  ON writing.regular_access_tokens (regular_access_grant_id);

-- Upgrade path: add course_id to pre-existing grants table
ALTER TABLE writing.regular_access_grants
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES writing.courses (id) ON DELETE RESTRICT;

-- Enforce NOT NULL when all rows have course_id (fresh installs: set before NOT NULL in ops runbook)
-- If you have legacy rows without course_id, backfill before applying NOT NULL:
-- ALTER TABLE writing.regular_access_grants ALTER COLUMN course_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Submissions: optional user_id, optional regular_access_grant_id (exactly one)
-- ---------------------------------------------------------------------------
ALTER TABLE writing.submissions
  ADD COLUMN IF NOT EXISTS regular_access_grant_id uuid REFERENCES writing.regular_access_grants (id) ON DELETE CASCADE;

ALTER TABLE writing.submissions
  ALTER COLUMN user_id DROP NOT NULL;

DROP INDEX IF EXISTS writing.writing_submissions_one_active_pipeline_per_user;

CREATE UNIQUE INDEX IF NOT EXISTS writing_submissions_one_active_pipeline_per_user
  ON writing.submissions (user_id)
  WHERE user_id IS NOT NULL
    AND status IN ('draft', 'submitted', 'in_review', 'corrected');

CREATE UNIQUE INDEX IF NOT EXISTS writing_submissions_one_active_pipeline_per_grant
  ON writing.submissions (regular_access_grant_id)
  WHERE regular_access_grant_id IS NOT NULL
    AND status IN ('draft', 'submitted', 'in_review', 'corrected');

CREATE INDEX IF NOT EXISTS idx_writing_submissions_regular_grant_status
  ON writing.submissions (regular_access_grant_id, status)
  WHERE regular_access_grant_id IS NOT NULL;

ALTER TABLE writing.submissions
  DROP CONSTRAINT IF EXISTS writing_submissions_user_or_grant_xor;

ALTER TABLE writing.submissions
  ADD CONSTRAINT writing_submissions_user_or_grant_xor CHECK (
    (user_id IS NOT NULL AND regular_access_grant_id IS NULL)
    OR (user_id IS NULL AND regular_access_grant_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION writing.fn_submissions_sync_course_and_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id uuid;
  v_owner uuid;
BEGIN
  SELECT s.course_id INTO v_course_id FROM writing.sessions s WHERE s.id = NEW.session_id;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Invalid session_id';
  END IF;
  NEW.course_id := v_course_id;

  SELECT c.user_id INTO v_owner FROM writing.courses c WHERE c.id = NEW.course_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Invalid course';
  END IF;

  IF NEW.regular_access_grant_id IS NOT NULL THEN
    IF NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'regular submission must not set user_id';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM writing.regular_access_grants g
      WHERE g.id = NEW.regular_access_grant_id AND g.course_id = NEW.course_id
    ) THEN
      RAISE EXCEPTION 'grant must match course';
    END IF;
  ELSE
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'user_id required';
    END IF;
    IF NEW.user_id <> v_owner THEN
      RAISE EXCEPTION 'Submission user must own the course';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION writing.fn_submissions_sync_course_and_owner() IS 'course_id from session; student: user_id=course owner; regular: regular_access_grant_id links to same course.';
