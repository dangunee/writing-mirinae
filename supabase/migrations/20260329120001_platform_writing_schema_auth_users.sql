-- Greenfield shared Supabase: platform + writing with auth.users FKs only (no public.users).
-- Apply when 20260327120000 was NOT applied. If baseline already created public.products, skip this file
-- (use 20260329120000 migrate only) or drop conflicting objects in a branch DB first.

CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE platform_app AS ENUM ('writing', 'quiz', 'ondoku');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE entitlement_status AS ENUM ('active', 'revoked', 'expired', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE course_interval AS ENUM (
    'interval_1d', 'interval_2d', 'interval_3d', 'interval_1w', 'interval_10d', 'interval_2w'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE course_status AS ENUM ('pending_setup', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('locked', 'unlocked', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM (
    'draft', 'submitted', 'in_review', 'corrected', 'published'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE correction_status AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE error_category AS ENUM (
    'grammar', 'expression', 'vocabulary', 'particle', 'spelling', 'honorifics'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app platform_app NOT NULL,
  sku text NOT NULL,
  name text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'jpy',
  unit_price_jpy integer NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  subtotal_jpy integer NOT NULL,
  tax_rate numeric(5, 4) NOT NULL,
  total_jpy integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_sku_unique UNIQUE (sku),
  CONSTRAINT products_writing_course_v1 CHECK (
    app <> 'writing'
    OR (
      sku = 'writing_course_10_sessions'
      AND unit_price_jpy = 2180
      AND quantity = 10
      AND subtotal_jpy = 21800
      AND tax_rate = 0.1000
      AND total_jpy = 23980
    )
  )
);

COMMENT ON TABLE products IS 'Platform catalog; prices defined here, not trusted from client. New apps add SKUs without altering writing tables.';
CREATE INDEX IF NOT EXISTS idx_products_app ON products (app);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (app) WHERE active;

INSERT INTO products (id, app, sku, name, currency, unit_price_jpy, quantity, subtotal_jpy, tax_rate, total_jpy, active)
VALUES (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'writing',
  'writing_course_10_sessions',
  'Writing course (10 sessions)',
  'jpy',
  2180,
  10,
  21800,
  0.1000,
  23980,
  true
)
ON CONFLICT (sku) DO NOTHING;

CREATE TABLE IF NOT EXISTS payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  status payment_status NOT NULL DEFAULT 'pending',
  currency char(3) NOT NULL DEFAULT 'jpy',
  unit_price_jpy integer NOT NULL,
  quantity integer NOT NULL,
  subtotal_jpy integer NOT NULL,
  tax_rate numeric(5, 4) NOT NULL,
  total_jpy integer NOT NULL,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  CONSTRAINT payment_orders_stripe_checkout_session_id_unique UNIQUE (stripe_checkout_session_id),
  CONSTRAINT payment_orders_stripe_payment_intent_id_unique UNIQUE (stripe_payment_intent_id),
  CONSTRAINT payment_orders_stripe_event_id_unique UNIQUE (stripe_event_id)
);

COMMENT ON TABLE payment_orders IS 'Monetary snapshot must match product at purchase time; webhook idempotency via unique Stripe ids.';
CREATE INDEX IF NOT EXISTS idx_payment_orders_user_created ON payment_orders (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION payment_orders_validate_catalog_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  p record;
BEGIN
  SELECT unit_price_jpy, quantity, subtotal_jpy, tax_rate, total_jpy, currency
  INTO p
  FROM products
  WHERE id = NEW.product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown product';
  END IF;
  IF NEW.unit_price_jpy <> p.unit_price_jpy
     OR NEW.quantity <> p.quantity
     OR NEW.subtotal_jpy <> p.subtotal_jpy
     OR NEW.tax_rate <> p.tax_rate
     OR NEW.total_jpy <> p.total_jpy
     OR NEW.currency <> p.currency
  THEN
    RAISE EXCEPTION 'Order amounts must match catalog product';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_orders_match_product ON payment_orders;
CREATE TRIGGER payment_orders_match_product
  BEFORE INSERT OR UPDATE OF product_id, unit_price_jpy, quantity, subtotal_jpy, tax_rate, total_jpy, currency
  ON payment_orders
  FOR EACH ROW
  EXECUTE PROCEDURE payment_orders_validate_catalog_match();

COMMENT ON FUNCTION payment_orders_validate_catalog_match() IS 'Security: prevents arbitrary prices even if API is abused; catalog is source of truth.';

CREATE TABLE IF NOT EXISTS entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  payment_order_id uuid NOT NULL UNIQUE REFERENCES payment_orders (id) ON DELETE RESTRICT,
  app platform_app NOT NULL,
  status entitlement_status NOT NULL DEFAULT 'pending',
  valid_from timestamptz,
  valid_until timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE entitlements IS 'Cross-app grants; quiz/ondoku get their own provisioned rows without FK to writing.*';
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON entitlements (user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_app_status ON entitlements (app, status);

CREATE OR REPLACE FUNCTION entitlements_validate_app_matches_product()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  p_app platform_app;
BEGIN
  SELECT p.app INTO p_app FROM products p WHERE p.id = NEW.product_id;
  IF p_app IS NULL THEN
    RAISE EXCEPTION 'Unknown product';
  END IF;
  IF NEW.app IS DISTINCT FROM p_app THEN
    RAISE EXCEPTION 'Entitlement app must match product app';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS entitlements_match_product_app ON entitlements;
CREATE TRIGGER entitlements_match_product_app
  BEFORE INSERT OR UPDATE OF product_id, app ON entitlements
  FOR EACH ROW
  EXECUTE PROCEDURE entitlements_validate_app_matches_product();

COMMENT ON FUNCTION entitlements_validate_app_matches_product() IS 'Keeps entitlement.app aligned with products.app (multi-app catalog).';

CREATE SCHEMA IF NOT EXISTS writing;

CREATE TABLE IF NOT EXISTS writing.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL UNIQUE REFERENCES entitlements (id) ON DELETE CASCADE,
  status course_status NOT NULL DEFAULT 'pending_setup',
  start_date date,
  interval course_interval,
  session_count smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_courses_session_count_fixed CHECK (session_count = 10),
  CONSTRAINT writing_courses_schedule_when_active CHECK (
    status IN ('pending_setup', 'cancelled')
    OR (start_date IS NOT NULL AND interval IS NOT NULL)
  )
);

COMMENT ON TABLE writing.courses IS 'Writing domain; purchase via entitlements. status drives lifecycle.';
COMMENT ON COLUMN writing.courses.status IS 'pending_setup until student sets schedule; active when in progress; completed when all sessions completed.';
CREATE INDEX IF NOT EXISTS idx_writing_courses_user_id ON writing.courses (user_id);
CREATE INDEX IF NOT EXISTS idx_writing_courses_status ON writing.courses (status);

CREATE OR REPLACE FUNCTION writing_courses_user_matches_entitlement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  e_user uuid;
BEGIN
  SELECT e.user_id INTO e_user FROM entitlements e WHERE e.id = NEW.entitlement_id;
  IF e_user IS NULL OR NEW.user_id <> e_user THEN
    RAISE EXCEPTION 'Course user must match entitlement user';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS writing_courses_entitlement_user ON writing.courses;
CREATE TRIGGER writing_courses_entitlement_user
  BEFORE INSERT OR UPDATE OF user_id, entitlement_id ON writing.courses
  FOR EACH ROW
  EXECUTE PROCEDURE writing_courses_user_matches_entitlement();

CREATE TABLE IF NOT EXISTS writing.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES writing.courses (id) ON DELETE CASCADE,
  index smallint NOT NULL,
  unlock_at timestamptz NOT NULL,
  status session_status NOT NULL DEFAULT 'locked',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_sessions_index_range CHECK (index >= 1 AND index <= 10),
  CONSTRAINT writing_sessions_course_index_unique UNIQUE (course_id, index)
);

COMMENT ON COLUMN writing.sessions.status IS 'locked until unlock_at; unlocked when student may submit; completed when result published.';
CREATE INDEX IF NOT EXISTS idx_writing_sessions_course_id ON writing.sessions (course_id);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_course_unlock ON writing.sessions (course_id, unlock_at);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_status ON writing.sessions (course_id, status);

CREATE TABLE IF NOT EXISTS writing.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES writing.sessions (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES writing.courses (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status submission_status NOT NULL DEFAULT 'draft',
  body_text text,
  image_storage_key text,
  image_mime_type text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_submissions_one_per_session UNIQUE (session_id)
);

COMMENT ON TABLE writing.submissions IS 'At most one in-flight submission per user across all writing (stricter than per-course). Student-visible result only when correction status = published.';
COMMENT ON COLUMN writing.submissions.status IS 'published = student may see correction result; aligns with writing.corrections when published.';
CREATE INDEX IF NOT EXISTS idx_writing_submissions_user_status ON writing.submissions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_writing_submissions_course_status ON writing.submissions (course_id, status);
CREATE INDEX IF NOT EXISTS idx_writing_submissions_submitted_at ON writing.submissions (submitted_at)
  WHERE submitted_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS writing_submissions_one_active_pipeline_per_user
  ON writing.submissions (user_id)
  WHERE status IN ('draft', 'submitted', 'in_review', 'corrected');

COMMENT ON INDEX writing_submissions_one_active_pipeline_per_user IS 'At most one submission in draft..corrected per user platform-wide; excludes published.';

CREATE TABLE IF NOT EXISTS writing.corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES writing.submissions (id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  status correction_status NOT NULL DEFAULT 'draft',
  polished_sentence text,
  model_answer text,
  teacher_comment text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_corrections_status_published_at CHECK (
    (status = 'draft' AND published_at IS NULL)
    OR (status = 'published' AND published_at IS NOT NULL)
  )
);

COMMENT ON TABLE writing.corrections IS 'Students must only read rows with status = published (API + RLS if used). draft = teacher work in progress.';
COMMENT ON COLUMN writing.corrections.status IS 'draft = invisible to student APIs; published = visible with published_at.';
CREATE INDEX IF NOT EXISTS idx_writing_corrections_teacher_id ON writing.corrections (teacher_id);
CREATE INDEX IF NOT EXISTS idx_writing_corrections_status ON writing.corrections (status);
CREATE INDEX IF NOT EXISTS idx_writing_corrections_published_at ON writing.corrections (published_at)
  WHERE published_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS writing.fragments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id uuid NOT NULL REFERENCES writing.corrections (id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  original_text text NOT NULL,
  corrected_text text NOT NULL,
  category error_category NOT NULL,
  start_offset integer,
  end_offset integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_fragments_order_unique UNIQUE (correction_id, order_index),
  CONSTRAINT writing_fragments_offset_sanity CHECK (
    end_offset IS NULL
    OR start_offset IS NULL
    OR end_offset >= start_offset
  )
);

CREATE INDEX IF NOT EXISTS idx_writing_fragments_correction_id ON writing.fragments (correction_id);
CREATE INDEX IF NOT EXISTS idx_writing_fragments_category ON writing.fragments (category);

CREATE TABLE IF NOT EXISTS writing.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES writing.submissions (id) ON DELETE CASCADE,
  grammar_accuracy smallint,
  vocabulary_usage smallint,
  contextual_fluency smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_evaluations_grammar_range CHECK (grammar_accuracy IS NULL OR (grammar_accuracy >= 0 AND grammar_accuracy <= 100)),
  CONSTRAINT writing_evaluations_vocab_range CHECK (vocabulary_usage IS NULL OR (vocabulary_usage >= 0 AND vocabulary_usage <= 100)),
  CONSTRAINT writing_evaluations_fluency_range CHECK (contextual_fluency IS NULL OR (contextual_fluency >= 0 AND contextual_fluency <= 100))
);

COMMENT ON TABLE writing.evaluations IS 'Nullable during teacher draft; all three scores required before correction can publish (trigger).';

CREATE OR REPLACE FUNCTION writing.fn_corrections_before_publish_validate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  ga smallint;
  vu smallint;
  cf smallint;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    SELECT e.grammar_accuracy, e.vocabulary_usage, e.contextual_fluency
    INTO ga, vu, cf
    FROM writing.evaluations e
    WHERE e.submission_id = NEW.submission_id;
    IF ga IS NULL OR vu IS NULL OR cf IS NULL THEN
      RAISE EXCEPTION 'Cannot publish correction without all evaluation scores';
    END IF;
    IF NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  END IF;
  IF NEW.status = 'draft' THEN
    NEW.published_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS writing_corrections_publish_validate ON writing.corrections;
CREATE TRIGGER writing_corrections_publish_validate
  BEFORE INSERT OR UPDATE OF status, published_at ON writing.corrections
  FOR EACH ROW
  EXECUTE PROCEDURE writing.fn_corrections_before_publish_validate();

COMMENT ON FUNCTION writing.fn_corrections_before_publish_validate() IS 'Draft corrections invisible to students; publish requires full evaluation scores.';

CREATE OR REPLACE FUNCTION writing.fn_corrections_after_publish_sync()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    UPDATE writing.submissions
    SET status = 'published', updated_at = now()
    WHERE id = NEW.submission_id;
    UPDATE writing.sessions s
    SET status = 'completed', updated_at = now()
    FROM writing.submissions sub
    WHERE sub.id = NEW.submission_id AND s.id = sub.session_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS writing_corrections_after_publish ON writing.corrections;
CREATE TRIGGER writing_corrections_after_publish
  AFTER INSERT OR UPDATE OF status ON writing.corrections
  FOR EACH ROW
  EXECUTE PROCEDURE writing.fn_corrections_after_publish_sync();

COMMENT ON FUNCTION writing.fn_corrections_after_publish_sync() IS 'Student submission marked published; session completed when correction publishes.';

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  processed_at timestamptz NOT NULL DEFAULT now(),
  payload_hash text
);

COMMENT ON TABLE stripe_webhook_events IS 'Replay protection; pair with payment_orders.stripe_event_id.';

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
  IF v_owner IS NULL OR NEW.user_id <> v_owner THEN
    RAISE EXCEPTION 'Submission user must own the course';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS writing_submissions_sync_course_and_owner ON writing.submissions;
CREATE TRIGGER writing_submissions_sync_course_and_owner
  BEFORE INSERT OR UPDATE ON writing.submissions
  FOR EACH ROW
  EXECUTE PROCEDURE writing.fn_submissions_sync_course_and_owner();

COMMENT ON FUNCTION writing.fn_submissions_sync_course_and_owner() IS 'Security: course_id derived from writing.sessions; user must own course.';

CREATE OR REPLACE FUNCTION writing.fn_submissions_prevent_content_after_submit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'draft' THEN
    IF NEW.body_text IS DISTINCT FROM OLD.body_text
      OR NEW.image_storage_key IS DISTINCT FROM OLD.image_storage_key
      OR NEW.image_mime_type IS DISTINCT FROM OLD.image_mime_type
    THEN
      RAISE EXCEPTION 'Submission content is immutable after submit';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS writing_submissions_immutable_content ON writing.submissions;
CREATE TRIGGER writing_submissions_immutable_content
  BEFORE UPDATE ON writing.submissions
  FOR EACH ROW
  EXECUTE PROCEDURE writing.fn_submissions_prevent_content_after_submit();

COMMENT ON FUNCTION writing.fn_submissions_prevent_content_after_submit() IS 'Immutable submission content after submit; APIs must still authorize.';
