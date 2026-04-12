import { eq } from "drizzle-orm";

import { writingSessions } from "../../db/schema";
import type { Db } from "../db/client";
import * as repo from "../repositories/writingStudentRepository";

const MAX_TITLE = 500;
const MAX_PROMPT = 50_000;
const MAX_REQUIREMENTS = 10_000;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type UpsertAdminAssignmentResult =
  | { ok: true; sessionId: string }
  | { ok: false; code: string };

/**
 * Internal: set assignment copy on writing.sessions.theme_snapshot and ensure the row is
 * unlocked so GET /api/writing/sessions/current + WritingPage can submit.
 */
export async function upsertAssignmentContentForCourse(
  db: Db,
  input: {
    courseId: string;
    sessionIndex: number;
    title: string;
    prompt: string;
    requirements: string | null;
  }
): Promise<UpsertAdminAssignmentResult> {
  const courseId = input.courseId.trim();
  if (!UUID_RE.test(courseId)) {
    return { ok: false, code: "invalid_course_id" };
  }

  const title = input.title.trim();
  const prompt = input.prompt.trim();
  if (!title || !prompt) {
    return { ok: false, code: "invalid_body" };
  }
  if (title.length > MAX_TITLE || prompt.length > MAX_PROMPT) {
    return { ok: false, code: "text_too_long" };
  }

  const req = input.requirements?.trim() ?? "";
  if (req.length > MAX_REQUIREMENTS) {
    return { ok: false, code: "text_too_long" };
  }

  const idx = input.sessionIndex;
  if (!Number.isInteger(idx) || idx < 1 || idx > 10) {
    return { ok: false, code: "invalid_session_index" };
  }

  const course = await repo.getWritingCourseById(db, courseId);
  if (!course) {
    return { ok: false, code: "course_not_found" };
  }
  if (course.status !== "active") {
    return { ok: false, code: "course_not_active" };
  }

  const themeSnapshot = [title, prompt].join("\n\n") + (req ? `\n\n要件:\n${req}` : "");

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
