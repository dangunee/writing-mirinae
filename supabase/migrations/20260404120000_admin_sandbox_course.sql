-- Admin-only sandbox courses: isolated from normal student entitlements (see server/services/adminSandboxProvisionService.ts)

ALTER TABLE writing.courses
  ADD COLUMN IF NOT EXISTS is_admin_sandbox boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN writing.courses.is_admin_sandbox IS 'Internal admin UX test course; excluded from student entitlement checks.';

CREATE UNIQUE INDEX IF NOT EXISTS writing_courses_one_admin_sandbox_per_user
  ON writing.courses (user_id)
  WHERE is_admin_sandbox = true;

-- Internal product for provisioning admin sandbox (not sold; amounts satisfy catalog CHECK constraints)
INSERT INTO public.products (id, app, sku, name, currency, unit_price_jpy, quantity, subtotal_jpy, tax_rate, total_jpy, active)
VALUES (
  'a0000000-0000-4000-8000-000000000099'::uuid,
  'writing',
  'writing_admin_sandbox_v1',
  'Admin sandbox (internal)',
  'jpy',
  10,
  1,
  10,
  0.1000,
  11,
  true
)
ON CONFLICT (sku) DO NOTHING;
