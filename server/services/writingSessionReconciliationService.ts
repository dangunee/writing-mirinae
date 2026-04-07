import { and, asc, eq, lte, sql } from "drizzle-orm";

import { writingCourses, writingSessions, writingSubmissions } from "../../db/schema";
import type { Db } from "../db/client";

/**
 * Same as reconcileCourseSessions but participates in an existing transaction (no nested BEGIN).
 */
export async function reconcileCourseSessionsInTx(tx: Db, courseId: string): Promise<void> {
  await tx.execute(sql`SELECT id FROM writing.courses WHERE id = ${courseId}::uuid FOR UPDATE`);
  const courseRows = await tx.select().from(writingCourses).where(eq(writingCourses.id, courseId)).limit(1);
  const course = courseRows[0];
  if (!course) {
    return;
  }

  if (course.strictSessionProgression) {
    await reconcileStrictSequentialUnlock(tx, courseId);
  } else {
    await legacyLazyTimeUnlock(tx, courseId);
  }

  await markMissedWhereDue(tx, courseId);
}

/**
 * Server-side unlock + missed reconciliation (transaction-safe).
 * Call before returning progress-sensitive session APIs.
 */
export async function reconcileCourseSessions(db: Db, courseId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await reconcileCourseSessionsInTx(tx, courseId);
  });
}

async function legacyLazyTimeUnlock(tx: Db, courseId: string): Promise<void> {
  const now = new Date();
  await tx
    .update(writingSessions)
    .set({
      status: "unlocked",
      runtimeStatus: "available",
      updatedAt: now,
    })
    .where(
      and(
        eq(writingSessions.courseId, courseId),
        eq(writingSessions.status, "locked"),
        lte(writingSessions.unlockAt, now)
      )
    );
}

async function reconcileStrictSequentialUnlock(tx: Db, courseId: string): Promise<void> {
  const now = new Date();
  const sessions = await tx
    .select()
    .from(writingSessions)
    .where(eq(writingSessions.courseId, courseId))
    .orderBy(asc(writingSessions.index));

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (s.status === "completed" || s.runtimeStatus === "corrected") {
      continue;
    }
    if (s.runtimeStatus === "missed" || s.status === "missed") {
      continue;
    }
    if (s.status !== "locked") {
      continue;
    }
    if (s.unlockAt > now) {
      continue;
    }

    if (i === 0) {
      await tx
        .update(writingSessions)
        .set({
          status: "unlocked",
          runtimeStatus: "available",
          updatedAt: now,
        })
        .where(eq(writingSessions.id, s.id));
      continue;
    }

    const prev = sessions[i - 1];
    const prevTerminal =
      prev.status === "completed" ||
      prev.status === "missed" ||
      prev.runtimeStatus === "corrected" ||
      prev.runtimeStatus === "missed";

    if (!prevTerminal) {
      continue;
    }

    await tx
      .update(writingSessions)
      .set({
        status: "unlocked",
        runtimeStatus: "available",
        updatedAt: now,
      })
      .where(eq(writingSessions.id, s.id));
  }
}

async function markMissedWhereDue(tx: Db, courseId: string): Promise<void> {
  const now = new Date();
  const sessions = await tx
    .select()
    .from(writingSessions)
    .where(eq(writingSessions.courseId, courseId))
    .orderBy(asc(writingSessions.index));

  for (const s of sessions) {
    if (!s.dueAt || s.dueAt >= now) {
      continue;
    }
    if (s.runtimeStatus === "missed" || s.status === "missed") {
      continue;
    }
    if (s.runtimeStatus === "corrected" || s.status === "completed") {
      continue;
    }

    const wasReachable =
      s.status === "unlocked" ||
      s.runtimeStatus === "available" ||
      s.runtimeStatus === "submitted";

    if (!wasReachable) {
      continue;
    }

    const subRows = await tx
      .select({ status: writingSubmissions.status })
      .from(writingSubmissions)
      .where(eq(writingSubmissions.sessionId, s.id))
      .limit(1);
    const st = subRows[0]?.status;
    const hasFinalSubmission =
      st === "submitted" || st === "in_review" || st === "corrected" || st === "published";

    if (hasFinalSubmission) {
      continue;
    }

    await tx
      .update(writingSessions)
      .set({
        status: "missed",
        runtimeStatus: "missed",
        missedAt: s.missedAt ?? now,
        updatedAt: now,
      })
      .where(eq(writingSessions.id, s.id));
  }
}
