import { and, eq, sql } from "drizzle-orm";

import { writingCourses, writingSessions } from "../../db/schema";
import { intervalToMs } from "../lib/schedule";
import { trialBootstrapVerbose } from "../lib/trialSessionBootstrapLog";
import * as masterRepo from "../repositories/writingMasterRepository";
import type { CourseInterval } from "../types/writing";
import type { Db } from "../db/client";

const DEFAULT_DUE_MS = 7 * 24 * 60 * 60 * 1000;

const FALLBACK_THEME_SNAPSHOT = JSON.stringify({
  theme: "체험 과제",
  title: "체험 과제",
  prompt: "今回の作文を下記入力欄に作成して提出してください。",
  requirements: [],
});

/**
 * Trial mail-link users have no server-side "finalize schedule" step; the trial course may be active
 * with zero session rows. Idempotently insert session index 1 so GET /sessions/current can return
 * a writable assignment (same shape as writing.sessions elsewhere).
 */
export async function ensureTrialCourseFirstSessionIfMissing(
  db: Db,
  course: typeof writingCourses.$inferSelect
): Promise<void> {
  const courseIdPrefix = `${course.id.slice(0, 8)}…`;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM writing.courses WHERE id = ${course.id}::uuid FOR UPDATE`);
    const existing = await tx
      .select({ id: writingSessions.id })
      .from(writingSessions)
      .where(and(eq(writingSessions.courseId, course.id), eq(writingSessions.index, 1)))
      .limit(1);
    const hadIndex1Before = existing.length > 0;
    trialBootstrapVerbose("precheck_session_index_1", {
      courseIdPrefix,
      courseStatus: course.status,
      courseTermIdPrefix: course.termId ? `${course.termId.slice(0, 8)}…` : null,
      sessionIndex1Exists: hadIndex1Before,
    });
    if (hadIndex1Before) {
      return;
    }

    let master: Awaited<ReturnType<typeof masterRepo.listAssignmentMastersForTerm>>[number] | null =
      null;
    if (course.termId) {
      const masters = await masterRepo.listAssignmentMastersForTerm(tx, course.termId);
      master = masters.find((m) => m.slotIndex === 1) ?? masters[0] ?? null;
    }

    const now = new Date();
    const stepMs =
      course.interval != null ? intervalToMs(course.interval as CourseInterval) : DEFAULT_DUE_MS;
    const dueAt = new Date(now.getTime() + stepMs);

    const themeSnapshot =
      master != null && String(master.theme ?? "").trim().length > 0
        ? master.theme
        : FALLBACK_THEME_SNAPSHOT;
    const requiredExpressionsSnapshot = master?.requiredExpressions ?? [];
    const modelAnswerSnapshot = master?.modelAnswer ?? "";

    trialBootstrapVerbose("insert_attempt", {
      courseIdPrefix,
      index: 1,
      hasAssignmentMaster: master != null,
    });

    const inserted = await tx
      .insert(writingSessions)
      .values({
        courseId: course.id,
        index: 1,
        unlockAt: now,
        status: "unlocked",
        runtimeStatus: "available",
        availableFrom: now,
        dueAt,
        themeSnapshot,
        requiredExpressionsSnapshot,
        modelAnswerSnapshot,
        difficultySnapshot: master?.difficulty ?? null,
        termId: course.termId,
        assignmentMasterId: master?.id ?? null,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [writingSessions.courseId, writingSessions.index] })
      .returning({ id: writingSessions.id });

    trialBootstrapVerbose("insert_result", {
      courseIdPrefix,
      insertedRowCount: inserted.length,
      insertedIdPrefix: inserted[0]?.id ? `${inserted[0].id.slice(0, 8)}…` : null,
    });
  });
}
