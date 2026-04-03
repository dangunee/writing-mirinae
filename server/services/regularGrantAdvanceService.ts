import { asc, eq } from "drizzle-orm";

import { regularAccessGrants, writingCourses } from "../../db/schema";
import type { Db } from "../db/client";
import * as repo from "../repositories/writingStudentRepository";

/**
 * Mirrors "all sessions done + no pipeline" — same invariants as getCurrentSessionForRegularGrant → mode "all_done".
 */
export async function isRegularGrantCourseFullyComplete(
  db: Db,
  grantId: string,
  courseId: string
): Promise<boolean> {
  await repo.lazyUnlockDueSessions(db, courseId);
  const sessions = await repo.listSessionsForCourseOrdered(db, courseId);
  if (sessions.length === 0) return false;
  if (!sessions.every((s) => s.status === "completed")) {
    return false;
  }
  const pipeline = await repo.findActivePipelineSubmissionForGrant(db, grantId);
  if (pipeline) return false;
  return true;
}

/**
 * Next purchasable course for the same owner (same `writing.courses.user_id`), after this course in creation order.
 * Skips non-active rows; only `active` is eligible for continuing writing.
 */
export async function findNextActiveCourseForCourseOwner(
  db: Db,
  ownerUserId: string,
  currentCourseId: string
): Promise<typeof writingCourses.$inferSelect | null> {
  const all = await db
    .select()
    .from(writingCourses)
    .where(eq(writingCourses.userId, ownerUserId))
    .orderBy(asc(writingCourses.createdAt), asc(writingCourses.id));

  const idx = all.findIndex((c) => c.id === currentCourseId);
  if (idx < 0) return null;

  for (let i = idx + 1; i < all.length; i++) {
    const c = all[i];
    if (c.status === "active") {
      return c;
    }
  }
  return null;
}

export type AdvanceRegularGrantResult = {
  advanced: boolean;
  previousCourseId: string | null;
};

/**
 * If current course is fully finished for this grant, advance grant.course_id to the next active course owned by the same user.
 * Row-locks the grant row for the transaction.
 */
export async function advanceRegularGrantToNextCourseIfNeeded(
  db: Db,
  grantId: string
): Promise<AdvanceRegularGrantResult> {
  return await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(regularAccessGrants)
      .where(eq(regularAccessGrants.id, grantId))
      .for("update")
      .limit(1);

    if (!locked?.courseId) {
      return { advanced: false, previousCourseId: null };
    }

    const currentCourseId = locked.courseId;

    const complete = await isRegularGrantCourseFullyComplete(tx, grantId, currentCourseId);
    if (!complete) {
      return { advanced: false, previousCourseId: null };
    }

    const [curCourse] = await tx
      .select()
      .from(writingCourses)
      .where(eq(writingCourses.id, currentCourseId))
      .limit(1);
    if (!curCourse) {
      return { advanced: false, previousCourseId: null };
    }

    const next = await findNextActiveCourseForCourseOwner(tx, curCourse.userId, currentCourseId);
    if (!next) {
      return { advanced: false, previousCourseId: null };
    }

    await tx
      .update(regularAccessGrants)
      .set({ courseId: next.id, updatedAt: new Date() })
      .where(eq(regularAccessGrants.id, grantId));

    return { advanced: true, previousCourseId: currentCourseId };
  });
}
