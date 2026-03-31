-- Multi-SKU writing catalog (trial + session packs), relax fixed-10-session constraint.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_writing_course_v1;

ALTER TABLE products ADD CONSTRAINT products_writing_totals_valid CHECK (
  app <> 'writing'
  OR (
    unit_price_jpy > 0
    AND quantity >= 1
    AND subtotal_jpy > 0
    AND total_jpy > 0
    AND tax_rate >= 0::numeric
  )
);

ALTER TABLE writing.courses DROP CONSTRAINT IF EXISTS writing_courses_session_count_fixed;

ALTER TABLE writing.courses ADD CONSTRAINT writing_courses_session_count_range CHECK (
  session_count >= 1
  AND session_count <= 24
);

-- Trial ¥1,800 (tax-incl. 10%)
INSERT INTO products (id, app, sku, name, currency, unit_price_jpy, quantity, subtotal_jpy, tax_rate, total_jpy, active)
VALUES (
  'b0000000-0000-4000-8000-000000000001'::uuid,
  'writing',
  'writing_trial_lesson',
  '体験レッスン (Trial Lesson)',
  'jpy',
  1636,
  1,
  1636,
  0.1000,
  1800,
  true
)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  unit_price_jpy = EXCLUDED.unit_price_jpy,
  quantity = EXCLUDED.quantity,
  subtotal_jpy = EXCLUDED.subtotal_jpy,
  tax_rate = EXCLUDED.tax_rate,
  total_jpy = EXCLUDED.total_jpy,
  active = EXCLUDED.active,
  updated_at = now();

-- 1 session ¥3,500
INSERT INTO products (id, app, sku, name, currency, unit_price_jpy, quantity, subtotal_jpy, tax_rate, total_jpy, active)
VALUES (
  'b0000000-0000-4000-8000-000000000002'::uuid,
  'writing',
  'writing_1_session',
  '1回プラン',
  'jpy',
  3182,
  1,
  3182,
  0.1000,
  3500,
  true
)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  unit_price_jpy = EXCLUDED.unit_price_jpy,
  quantity = EXCLUDED.quantity,
  subtotal_jpy = EXCLUDED.subtotal_jpy,
  tax_rate = EXCLUDED.tax_rate,
  total_jpy = EXCLUDED.total_jpy,
  active = EXCLUDED.active,
  updated_at = now();

-- 5 sessions ¥8,500 (subtotal 7727 + tax 773)
INSERT INTO products (id, app, sku, name, currency, unit_price_jpy, quantity, subtotal_jpy, tax_rate, total_jpy, active)
VALUES (
  'b0000000-0000-4000-8000-000000000003'::uuid,
  'writing',
  'writing_5_sessions',
  '5セッションプラン',
  'jpy',
  1545,
  5,
  7727,
  0.1000,
  8500,
  true
)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  unit_price_jpy = EXCLUDED.unit_price_jpy,
  quantity = EXCLUDED.quantity,
  subtotal_jpy = EXCLUDED.subtotal_jpy,
  tax_rate = EXCLUDED.tax_rate,
  total_jpy = EXCLUDED.total_jpy,
  active = EXCLUDED.active,
  updated_at = now();

-- 10 sessions promo ¥15,300 (Stitch: 小計 13909 + 税 1391)
INSERT INTO products (id, app, sku, name, currency, unit_price_jpy, quantity, subtotal_jpy, tax_rate, total_jpy, active)
VALUES (
  'b0000000-0000-4000-8000-000000000004'::uuid,
  'writing',
  'writing_10_sessions_promo',
  '10セッションプラン',
  'jpy',
  1391,
  10,
  13909,
  0.1000,
  15300,
  true
)
ON CONFLICT (sku) DO UPDATE SET
  name = EXCLUDED.name,
  unit_price_jpy = EXCLUDED.unit_price_jpy,
  quantity = EXCLUDED.quantity,
  subtotal_jpy = EXCLUDED.subtotal_jpy,
  tax_rate = EXCLUDED.tax_rate,
  total_jpy = EXCLUDED.total_jpy,
  active = EXCLUDED.active,
  updated_at = now();
