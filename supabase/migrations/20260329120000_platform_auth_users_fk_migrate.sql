-- Delta A: migrate existing baseline deployment (public.users) → auth.users FKs.
-- Safe no-op when public.users does not exist (greenfield applies 20260329120001 only).
-- Does not modify historical baseline files.

CREATE EXTENSION IF NOT EXISTS citext;

DO $$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'platform_auth_users_fk_migrate: no public.users — skip (use greenfield migration).';
  ELSE
  FOR r IN
    SELECT c.conname, n.nspname AS schemaname, t.relname AS tablename
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class ft ON c.confrelid = ft.oid
    JOIN pg_namespace fn ON fn.oid = ft.relnamespace
    WHERE c.contype = 'f'
      AND fn.nspname = 'public'
      AND ft.relname = 'users'
      -- Only legacy public.users, never auth.users
      AND (
        (n.nspname = 'public' AND t.relname IN ('payment_orders', 'entitlements'))
        OR (n.nspname = 'writing' AND t.relname IN ('courses', 'submissions', 'corrections'))
      )
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', r.schemaname, r.tablename, r.conname);
  END LOOP;

  IF to_regclass('public.payment_orders') IS NOT NULL THEN
    ALTER TABLE public.payment_orders
      ADD CONSTRAINT payment_orders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('public.entitlements') IS NOT NULL THEN
    ALTER TABLE public.entitlements
      ADD CONSTRAINT entitlements_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('writing.courses') IS NOT NULL THEN
    ALTER TABLE writing.courses
      ADD CONSTRAINT writing_courses_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('writing.submissions') IS NOT NULL THEN
    ALTER TABLE writing.submissions
      ADD CONSTRAINT writing_submissions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;

  IF to_regclass('writing.corrections') IS NOT NULL THEN
    ALTER TABLE writing.corrections
      ADD CONSTRAINT writing_corrections_teacher_id_fkey
      FOREIGN KEY (teacher_id) REFERENCES auth.users (id) ON DELETE RESTRICT;
  END IF;

  DROP TABLE IF EXISTS public.oauth_accounts CASCADE;
  DROP TABLE IF EXISTS public.password_reset_tokens CASCADE;
  DROP TABLE IF EXISTS public.users CASCADE;
  END IF;
END $$;
