import { and, eq, isNull, sql } from "drizzle-orm";

import { writingCourses, writingSessions } from "../../db/schema";
import { intervalToMs } from "../lib/schedule";
import { trialBootstrapInfo, trialBootstrapVerbose } from "../lib/trialSessionBootstrapLog";
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
 * Idempotently create writing.sessions index 1 for this trial_application_id on the trial course.
 * Snapshots prefer the course template row (trial_application_id IS NULL, index 1) so admin edits apply;
 * else assignment masters for the course term.
 * due_at follows access_expires_at when set and in the future; otherwise course interval / default.
 */
export async function ensureTrialFirstSessionForApplicationIfMissing(
  db: Db,
  course: typeof writingCourses.$inferSelect,
  trialApplicationId: string,
  accessExpiresAt: Date | null
): Promise<{ inserted: boolean }> {
  const courseIdPrefix = `${course.id.slice(0, 8)}…`;
  let insertedFlag = false;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM writing.courses WHERE id = ${course.id}::uuid FOR UPDATE`);
    const existing = await tx
      .select({ id: writingSessions.id })
      .from(writingSessions)
      .where(
        and(
          eq(writingSessions.courseId, course.id),
          eq(writingSessions.index, 1),
          eq(writingSessions.trialApplicationId, trialApplicationId)
        )
      )
      .limit(1);
    const hadAppSessionBefore = existing.length > 0;
    trialBootstrapVerbose("precheck_trial_app_session_index_1", {
      courseIdPrefix,
      courseStatus: course.status,
      courseTermIdPrefix: course.termId ? `${course.termId.slice(0, 8)}…` : null,
      trialApplicationIdPrefix: `${trialApplicationId.slice(0, 8)}…`,
      sessionIndex1Exists: hadAppSessionBefore,
    });
    if (hadAppSessionBefore) {
      insertedFlag = false;
      return;
    }

    const [template] = await tx
      .select()
      .from(writingSessions)
      .where(
        and(
          eq(writingSessions.courseId, course.id),
          eq(writingSessions.index, 1),
          isNull(writingSessions.trialApplicationId)
        )
      )
      .limit(1);

    let master: Awaited<ReturnType<typeof masterRepo.listAssignmentMastersForTerm>>[number] | null =
      null;
    if (course.termId && !template) {
      const masters = await masterRepo.listAssignmentMastersForTerm(tx, course.termId);
      master = masters.find((m) => m.slotIndex === 1) ?? masters[0] ?? null;
    }

    const now = new Date();
    const stepMs =
      course.interval != null ? intervalToMs(course.interval as CourseInterval) : DEFAULT_DUE_MS;
    const defaultDueAt = new Date(now.getTime() + stepMs);
    const dueFromAccess =
      accessExpiresAt != null && accessExpiresAt.getTime() > now.getTime() ? accessExpiresAt : null;
    const dueAt = dueFromAccess ?? defaultDueAt;

    const themeSnapshot =
      template != null && String(template.themeSnapshot ?? "").trim().length > 0
        ? template.themeSnapshot
        : master != null && String(master.theme ?? "").trim().length > 0
          ? master.theme
          : FALLBACK_THEME_SNAPSHOT;
    const requiredExpressionsSnapshot =
      template?.requiredExpressionsSnapshot ?? master?.requiredExpressions ?? [];
    const modelAnswerSnapshot = template?.modelAnswerSnapshot ?? master?.modelAnswer ?? "";
    const difficultySnapshot = template?.difficultySnapshot ?? master?.difficulty ?? null;
    const termId = template?.termId ?? course.termId;
    const assignmentMasterId = template?.assignmentMasterId ?? master?.id ?? null;

    trialBootstrapVerbose("trial_app_insert_attempt", {
      courseIdPrefix,
      index: 1,
      hasTemplateSession: template != null,
      hasAssignmentMaster: master != null,
      dueAtFromAccess: Boolean(dueFromAccess),
    });

    const inserted = await tx
      .insert(writingSessions)
      .values({
        courseId: course.id,
        trialApplicationId,
        index: 1,
        unlockAt: now,
        status: "unlocked",
        runtimeStatus: "available",
        availableFrom: now,
        dueAt,
        themeSnapshot,
        requiredExpressionsSnapshot,
        modelAnswerSnapshot,
        difficultySnapshot,
        termId,
        assignmentMasterId,
        updatedAt: now,
      })
      .returning({ id: writingSessions.id });

    trialBootstrapVerbose("trial_app_insert_result", {
      courseIdPrefix,
      insertedRowCount: inserted.length,
      insertedIdPrefix: inserted[0]?.id ? `${inserted[0].id.slice(0, 8)}…` : null,
    });
    insertedFlag = inserted.length > 0;
    if (insertedFlag && inserted[0]?.id) {
      trialBootstrapInfo("session_inserted", {
        courseIdPrefix,
        trialApplicationIdPrefix: `${trialApplicationId.slice(0, 8)}…`,
        sessionIdPrefix: `${inserted[0].id.slice(0, 8)}…`,
        index: 1,
      });
    }
  });
  return { inserted: insertedFlag };
}
