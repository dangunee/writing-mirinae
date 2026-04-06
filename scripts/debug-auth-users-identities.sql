-- DEBUG ONLY — run in Supabase SQL Editor as postgres / dashboard (not exposed to clients).
-- Inspect auth.users with linked identities to verify duplicate accounts vs single user + multiple identities.
-- Remove or relocate after investigation.

SELECT
  u.id AS user_id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  u.email_confirmed_at,
  u.raw_user_meta_data->>'full_name' AS full_name_meta,
  COALESCE(
    json_agg(
      json_build_object(
        'provider', i.provider,
        'identity_id', i.id,
        'identity_data', i.identity_data,
        'created_at', i.created_at
      )
      ORDER BY i.created_at
    ) FILTER (WHERE i.id IS NOT NULL),
    '[]'::json
  ) AS identities
FROM auth.users u
LEFT JOIN auth.identities i ON i.user_id = u.id
GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at, u.raw_user_meta_data
ORDER BY u.created_at DESC
LIMIT 200;

-- Same email appearing on more than one user_id indicates duplicate accounts (investigate linking settings).
SELECT
  lower(trim(email)) AS email_norm,
  COUNT(*)::int AS user_count,
  array_agg(id::text ORDER BY created_at) AS user_ids
FROM auth.users
WHERE email IS NOT NULL AND trim(email) <> ''
GROUP BY lower(trim(email))
HAVING COUNT(*) > 1
ORDER BY user_count DESC;
