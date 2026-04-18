-- Internal product for admin "ensure course for term" (課題登録 bootstrap). Not sold.
INSERT INTO public.products (
  id,
  app,
  sku,
  name,
  currency,
  unit_price_jpy,
  quantity,
  subtotal_jpy,
  tax_rate,
  total_jpy,
  active
)
VALUES (
  'a2000000-0000-4000-8000-000000000001'::uuid,
  'writing',
  'writing_assignment_catalog_v1',
  'Assignment catalog (internal)',
  'jpy',
  10,
  1,
  10,
  0.1000,
  11,
  true
)
ON CONFLICT (sku) DO NOTHING;
