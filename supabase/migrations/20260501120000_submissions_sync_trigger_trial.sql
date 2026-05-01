-- Trial submissions use trial_application_id with user_id NULL.
-- fn_submissions_sync_course_and_owner previously only branched on regular_access_grant_id;
-- the ELSE branch required user_id and raised 'user_id required' (driver may surface as user_id_required).

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

  IF NEW.trial_application_id IS NOT NULL THEN
    IF NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'trial submission must not set user_id';
    END IF;
    IF NEW.regular_access_grant_id IS NOT NULL THEN
      RAISE EXCEPTION 'trial submission must not set regular_access_grant_id';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM writing.sessions s
      WHERE s.id = NEW.session_id
        AND s.trial_application_id = NEW.trial_application_id
    ) THEN
      RAISE EXCEPTION 'trial_application_session_mismatch';
    END IF;
  ELSIF NEW.regular_access_grant_id IS NOT NULL THEN
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

COMMENT ON FUNCTION writing.fn_submissions_sync_course_and_owner() IS
  'course_id from session; owner XOR: student user_id=course owner OR regular grant matches course OR trial_application_id matches session trial scope.';
