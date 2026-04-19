-- Admin-only QA sandbox: override context + test submissions (isolated from writing.submissions).

CREATE TABLE IF NOT EXISTS writing.admin_sandbox_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('trial', 'regular', 'academy')),
  course_id uuid NOT NULL REFERENCES writing.courses (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES writing.sessions (id) ON DELETE CASCADE,
  term_id uuid REFERENCES writing.terms (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT admin_sandbox_contexts_one_per_admin UNIQUE (admin_user_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_sandbox_ctx_expires ON writing.admin_sandbox_contexts (expires_at);

COMMENT ON TABLE writing.admin_sandbox_contexts IS 'Short-lived admin QA preview context; validated server-side only.';

CREATE TABLE IF NOT EXISTS writing.admin_sandbox_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  action text NOT NULL,
  mode text,
  course_id uuid,
  session_id uuid,
  success boolean NOT NULL DEFAULT true,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_sandbox_audit_admin_created ON writing.admin_sandbox_audit (admin_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS writing.admin_sandbox_test_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES writing.courses (id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES writing.sessions (id) ON DELETE CASCADE,
  sandbox_mode text NOT NULL CHECK (sandbox_mode IN ('trial', 'regular', 'academy')),
  body_text text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_sandbox_test_submissions_one_per_admin_session UNIQUE (admin_user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_sandbox_test_admin ON writing.admin_sandbox_test_submissions (admin_user_id);

COMMENT ON TABLE writing.admin_sandbox_test_submissions IS 'QA-only; not linked to teacher queue (writing.submissions).';
