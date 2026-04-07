-- Writing: DB-backed roles, assignment master (terms + templates), session runtime lifecycle,
-- structured correction extensions, submission attachments. Backward-compatible with existing courses.

-- -----------------------------------------------------------------------------
-- Enums in writing schema
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE writing.app_role AS ENUM ('student', 'teacher', 'admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE writing.session_runtime AS ENUM (
    'locked',
    'available',
    'submitted',
    'corrected',
    'missed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE writing.annotation_target AS ENUM ('original', 'corrected', 'improved');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Legacy session_status: add missed (slot closed without correction)
DO $$ BEGIN
  ALTER TYPE session_status ADD VALUE 'missed';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- writing.user_roles — single role per auth user (extend later with junction if needed)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS writing.user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role writing.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_user_roles_role ON writing.user_roles (role);

COMMENT ON TABLE writing.user_roles IS 'App roles for writing BFF; env allowlists remain fallback when no row.';

-- -----------------------------------------------------------------------------
-- Terms + assignment master (admin source data; sessions snapshot at course generation)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS writing.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writing_terms_sort ON writing.terms (sort_order);

CREATE TABLE IF NOT EXISTS writing.assignment_masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL REFERENCES writing.terms (id) ON DELETE CASCADE,
  slot_index smallint NOT NULL,
  theme text NOT NULL,
  required_expressions jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_answer text NOT NULL,
  difficulty smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_assignment_masters_slot_range CHECK (slot_index >= 1 AND slot_index <= 10),
  CONSTRAINT writing_assignment_masters_term_slot_unique UNIQUE (term_id, slot_index),
  CONSTRAINT writing_assignment_masters_difficulty_range CHECK (difficulty >= 1 AND difficulty <= 5)
);

CREATE INDEX IF NOT EXISTS idx_writing_assignment_masters_term_id ON writing.assignment_masters (term_id);

-- -----------------------------------------------------------------------------
-- Course: optional term link + strict sequential unlock (new courses only)
-- -----------------------------------------------------------------------------
ALTER TABLE writing.courses
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES writing.terms (id) ON DELETE SET NULL;

ALTER TABLE writing.courses
  ADD COLUMN IF NOT EXISTS strict_session_progression boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_writing_courses_term_id ON writing.courses (term_id);

COMMENT ON COLUMN writing.courses.strict_session_progression IS 'When true, reconciliation enforces sequential unlock + missed; false preserves legacy time-only unlock.';

-- -----------------------------------------------------------------------------
-- Sessions: runtime lifecycle + snapshots + deadlines
-- -----------------------------------------------------------------------------
ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS runtime_status writing.session_runtime;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS available_from timestamptz;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS missed_at timestamptz;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS theme_snapshot text;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS required_expressions_snapshot jsonb;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS model_answer_snapshot text;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS difficulty_snapshot smallint;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS term_id uuid REFERENCES writing.terms (id) ON DELETE SET NULL;

ALTER TABLE writing.sessions
  ADD COLUMN IF NOT EXISTS assignment_master_id uuid REFERENCES writing.assignment_masters (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_writing_sessions_course_runtime ON writing.sessions (course_id, runtime_status);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_due_at ON writing.sessions (course_id, due_at);

COMMENT ON COLUMN writing.sessions.runtime_status IS 'Fine-grained lifecycle; legacy session_status remains for compatibility.';
COMMENT ON COLUMN writing.sessions.available_from IS 'When session becomes eligible (usually aligns with unlock_at).';
COMMENT ON COLUMN writing.sessions.due_at IS 'If now > due_at and no final submit, reconciliation may mark missed.';

-- Backfill: align snapshots timing with existing unlock_at where missing
UPDATE writing.sessions
SET available_from = unlock_at
WHERE available_from IS NULL;

-- Backfill runtime_status from legacy status + submissions (best-effort)
UPDATE writing.sessions s
SET runtime_status = 'corrected'::writing.session_runtime
WHERE s.runtime_status IS NULL AND s.status = 'completed';

UPDATE writing.sessions s
SET runtime_status = 'missed'::writing.session_runtime
WHERE s.runtime_status IS NULL AND s.status = 'missed';

UPDATE writing.sessions s
SET runtime_status = 'submitted'::writing.session_runtime
FROM writing.submissions sub
WHERE s.runtime_status IS NULL
  AND s.status = 'unlocked'
  AND sub.session_id = s.id
  AND sub.status IN ('submitted', 'in_review', 'corrected');

UPDATE writing.sessions s
SET runtime_status = 'available'::writing.session_runtime
FROM writing.submissions sub
WHERE s.runtime_status IS NULL
  AND s.status = 'unlocked'
  AND sub.session_id = s.id
  AND sub.status = 'draft';

UPDATE writing.sessions s
SET runtime_status = 'available'::writing.session_runtime
WHERE s.runtime_status IS NULL
  AND s.status = 'unlocked'
  AND NOT EXISTS (SELECT 1 FROM writing.submissions sub WHERE sub.session_id = s.id);

UPDATE writing.sessions s
SET runtime_status = 'locked'::writing.session_runtime
WHERE s.runtime_status IS NULL AND s.status = 'locked';

-- -----------------------------------------------------------------------------
-- Submissions: mode + attachments
-- -----------------------------------------------------------------------------
ALTER TABLE writing.submissions
  ADD COLUMN IF NOT EXISTS submission_mode text;

CREATE TABLE IF NOT EXISTS writing.submission_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES writing.submissions (id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_submission_attachments_size_nonneg CHECK (byte_size >= 0)
);

CREATE INDEX IF NOT EXISTS idx_writing_submission_attachments_submission_id ON writing.submission_attachments (submission_id);

-- -----------------------------------------------------------------------------
-- Corrections: rich JSON document + improved text
-- -----------------------------------------------------------------------------
ALTER TABLE writing.corrections
  ADD COLUMN IF NOT EXISTS rich_document_json jsonb;

ALTER TABLE writing.corrections
  ADD COLUMN IF NOT EXISTS improved_text text;

-- Normalized feedback (analytics); fragments table remains for legacy UI
CREATE TABLE IF NOT EXISTS writing.correction_feedback_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id uuid NOT NULL REFERENCES writing.corrections (id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  category text NOT NULL,
  subcategory text,
  original_text text NOT NULL,
  corrected_text text NOT NULL,
  explanation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_correction_feedback_items_order_unique UNIQUE (correction_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_writing_correction_feedback_items_correction_id ON writing.correction_feedback_items (correction_id);
CREATE INDEX IF NOT EXISTS idx_writing_correction_feedback_items_category ON writing.correction_feedback_items (category);

CREATE TABLE IF NOT EXISTS writing.correction_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correction_id uuid NOT NULL REFERENCES writing.corrections (id) ON DELETE CASCADE,
  target_type writing.annotation_target NOT NULL,
  anchor_text text,
  start_offset integer,
  end_offset integer,
  comment_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_correction_annotations_offset_sanity CHECK (
    end_offset IS NULL OR start_offset IS NULL OR end_offset >= start_offset
  )
);

CREATE INDEX IF NOT EXISTS idx_writing_correction_annotations_correction_id ON writing.correction_annotations (correction_id);

CREATE TABLE IF NOT EXISTS writing.correction_evaluations (
  correction_id uuid PRIMARY KEY REFERENCES writing.corrections (id) ON DELETE CASCADE,
  grammar smallint,
  vocabulary smallint,
  flow smallint,
  coherence smallint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT writing_correction_evaluations_grammar_range CHECK (grammar IS NULL OR (grammar >= 0 AND grammar <= 100)),
  CONSTRAINT writing_correction_evaluations_vocab_range CHECK (vocabulary IS NULL OR (vocabulary >= 0 AND vocabulary <= 100)),
  CONSTRAINT writing_correction_evaluations_flow_range CHECK (flow IS NULL OR (flow >= 0 AND flow <= 100)),
  CONSTRAINT writing_correction_evaluations_coh_range CHECK (coherence IS NULL OR (coherence >= 0 AND coherence <= 100))
);

-- -----------------------------------------------------------------------------
-- Publish trigger: sync runtime_status to corrected + legacy session completed
-- -----------------------------------------------------------------------------
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
    SET
      status = 'completed',
      runtime_status = 'corrected'::writing.session_runtime,
      updated_at = now()
    FROM writing.submissions sub
    WHERE sub.id = NEW.submission_id AND s.id = sub.session_id;
  END IF;
  RETURN NEW;
END;
$$;
