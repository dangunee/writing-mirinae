-- Mirinae writing: canonical term labels for 体験 + 1기–8기 (ops link writing.courses.term_id to these rows).
-- Idempotent via stable UUIDs.

INSERT INTO writing.terms (id, sort_order, title, is_active, created_at, updated_at)
VALUES
  ('a1000000-0000-4000-8000-0000000000e1'::uuid, 0, '体験', true, now(), now()),
  ('a1000000-0000-4000-8000-000000000101'::uuid, 1, '1기', true, now(), now()),
  ('a1000000-0000-4000-8000-000000000102'::uuid, 2, '2기', true, now(), now()),
  ('a1000000-0000-4000-8000-000000000103'::uuid, 3, '3기', true, now(), now()),
  ('a1000000-0000-4000-8000-000000000104'::uuid, 4, '4기', true, now(), now()),
  ('a1000000-0000-4000-8000-000000000105'::uuid, 5, '5기', true, now(), now()),
  ('a1000000-0000-4000-8000-000000000106'::uuid, 6, '6기', true, now(), now()),
  ('a1000000-0000-4000-8000-000000000107'::uuid, 7, '7기', true, now(), now()),
  ('a1000000-0000-4000-8000-000000000108'::uuid, 8, '8기', true, now(), now())
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE writing.terms IS 'Writing curriculum terms; seeded buckets 体験/1기–8기 for course linking.';
