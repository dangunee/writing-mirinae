-- Academy onboarding invites (token hash only; grant stored separately for /api/auth/me).
CREATE TABLE IF NOT EXISTS writing.academy_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  invited_email text,
  invited_name text,
  academy_label text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  used_by_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT academy_invites_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_academy_invites_expires_at ON writing.academy_invites (expires_at);
CREATE INDEX IF NOT EXISTS idx_academy_invites_invited_email ON writing.academy_invites (invited_email);
CREATE INDEX IF NOT EXISTS idx_academy_invites_used_at ON writing.academy_invites (used_at);

COMMENT ON TABLE writing.academy_invites IS 'One-time academy onboarding links; raw token never stored.';

-- Server-side grant for isAcademyUnlimited (avoids synthetic payment_orders; ties to accepted invite).
CREATE TABLE IF NOT EXISTS writing.academy_unlimited_grants (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  invite_id uuid NOT NULL REFERENCES writing.academy_invites (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academy_unlimited_grants_invite_id ON writing.academy_unlimited_grants (invite_id);

COMMENT ON TABLE writing.academy_unlimited_grants IS 'Academy unlimited access from accepted invite; evaluated in computeEntitlementsForUser.';
