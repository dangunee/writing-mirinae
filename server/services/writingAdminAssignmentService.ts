import { eq } from "drizzle-orm";

import { writingSessions } from "../../db/schema";
import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  type ThemeSnapshotV1,
} from "../lib/writingAssignmentSnapshot";
import { isKoreanGrammarLevelJa } from "../../src/lib/koreanGrammarLevel";
import type { Db } from "../db/client";
import * as repo from "../repositories/writingStudentRepository";

const MAX_TITLE = 500;
const MAX_PROMPT = 50_000;
const MAX_THEME = 500;
const MAX_MODEL_ANSWER = 100_000;
const MAX_REQ_FIELD = 2_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type UpsertAdminAssignmentResult =
  | { ok: true; sessionId: string }
  | { ok: false; code: string };

function validateSnapshot(s: ThemeSnapshotV1): { ok: true } | { ok: false; code: string } {
  const theme = s.theme.trim();
  const title = s.title.trim();
  const prompt = s.prompt.trim();
  if (!title || !prompt) {
    return { ok: false, code: "invalid_body" };
  }
  if (theme.length > MAX_THEME || title.length > MAX_TITLE || prompt.length > MAX_PROMPT) {
    return { ok: false, code: "text_too_long" };
  }
  if (s.modelAnswer != null && s.modelAnswer.length > MAX_MODEL_ANSWER) {
    return { ok: false, code: "text_too_long" };
  }
  if (!Array.isArray(s.requirements) || s.requirements.length !== ASSIGNMENT_REQUIREMENT_SLOT_COUNT) {
    return { ok: false, code: "requirements_slot_count" };
  }
  for (const r of s.requirements) {
    const ek = r.expressionKey?.trim() ?? "";
    const el = r.expressionLabel?.trim() ?? "";
    const pat = r.pattern?.trim() ?? "";
    const tj = r.translationJa?.trim() ?? "";
    const ex = r.exampleKo?.trim() ?? "";
    const gl = r.grammarLevel?.trim() ?? "";
    if (!ek || !el || !pat || !tj || !ex || !isKoreanGrammarLevelJa(gl)) {
      return { ok: false, code: "invalid_requirement_field" };
    }
    if (
      ek.length > MAX_REQ_FIELD ||
      el.length > MAX_REQ_FIELD ||
      pat.length > MAX_REQ_FIELD ||
      tj.length > MAX_REQ_FIELD ||
      ex.length > MAX_REQ_FIELD
    ) {
      return { ok: false, code: "text_too_long" };
    }
  }
  return { ok: true };
}

/**
 * Internal: set structured assignment JSON on writing.sessions.theme_snapshot and ensure the row is
 * unlocked so GET /api/writing/sessions/current + WritingPage can submit.
 */
export async function upsertAssignmentContentForCourse(
  db: Db,
  input: {
    courseId: string;
    sessionIndex: number;
    snapshot: ThemeSnapshotV1;
  }
): Promise<UpsertAdminAssignmentResult> {
  const courseId = input.courseId.trim();
  if (!UUID_RE.test(courseId)) {
    return { ok: false, code: "invalid_course_id" };
  }

  const v = validateSnapshot(input.snapshot);
  if (!v.ok) return v;

  const idx = input.sessionIndex;
  if (!Number.isInteger(idx) || idx < 1 || idx > 10) {
    return { ok: false, code: "invalid_session_index" };
  }

  const course = await repo.getWritingCourseById(db, courseId);
  if (!course) {
    return { ok: false, code: "course_not_found" };
  }
  if (course.status !== "active" && course.status !== "pending_setup") {
    return { ok: false, code: "course_not_active" };
  }

  const themeSnapshot = JSON.stringify({
    theme: input.snapshot.theme.trim(),
    title: input.snapshot.title.trim(),
    prompt: input.snapshot.prompt.trim(),
    requirements: input.snapshot.requirements.map((r) => ({
      grammarLevel: r.grammarLevel.trim(),
      expressionKey: r.expressionKey.trim(),
      expressionLabel: r.expressionLabel.trim(),
      pattern: r.pattern.trim(),
      translationJa: r.translationJa.trim(),
      exampleKo: r.exampleKo.trim(),
    })),
    ...(input.snapshot.modelAnswer != null && String(input.snapshot.modelAnswer).trim() !== ""
      ? { modelAnswer: String(input.snapshot.modelAnswer).trim() }
      : {}),
  });

  const sessions = await repo.listSessionsForCourseOrdered(db, courseId);
  const existing = sessions.find((s) => s.index === idx);

  const now = new Date();

  if (existing) {
    await db
      .update(writingSessions)
      .set({
        themeSnapshot,
        unlockAt: now,
        status: "unlocked",
        runtimeStatus: "available",
        updatedAt: now,
      })
      .where(eq(writingSessions.id, existing.id));
    await repo.lazyUnlockDueSessions(db, courseId);
    return { ok: true, sessionId: existing.id };
  }

  const [created] = await db
    .insert(writingSessions)
    .values({
      courseId,
      index: idx,
      unlockAt: now,
      status: "unlocked",
      runtimeStatus: "available",
      themeSnapshot,
      updatedAt: now,
    })
    .returning({ id: writingSessions.id });

  if (!created) {
    return { ok: false, code: "insert_failed" };
  }

  await repo.lazyUnlockDueSessions(db, courseId);
  return { ok: true, sessionId: created.id };
}
