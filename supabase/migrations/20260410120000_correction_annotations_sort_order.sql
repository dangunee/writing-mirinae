-- Annotations: explicit ordering for teacher UI / API payloads
ALTER TABLE writing.correction_annotations
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_writing_correction_annotations_correction_sort
  ON writing.correction_annotations (correction_id, sort_order);
