-- public.profiles — app display + LINE onboarding (auth.users.id is source of truth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text,
  name text,
  korean_level text,
  email_verified boolean NOT NULL DEFAULT false,
  onboarding_completed_at timestamptz,
  terms_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (lower(email));

-- One-time email verification (LINE onboarding, email linking) — 15 min TTL enforced in app
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_verification_purpose') THEN
    CREATE TYPE public.email_verification_purpose AS ENUM ('line_onboarding', 'email_link');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  purpose public.email_verification_purpose NOT NULL,
  pending_email text NOT NULL,
  password_encrypted text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_verification_tokens_token_hash_uq ON public.email_verification_tokens (token_hash);

CREATE INDEX IF NOT EXISTS email_verification_tokens_user_id_idx ON public.email_verification_tokens (user_id);
