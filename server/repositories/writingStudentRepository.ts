import { and, asc, eq, inArray, lte } from "drizzle-orm";

import {
  regularAccessGrants,
  writingCorrections,
  writingCourses,
  writingEvaluations,
  writingFragments,
  writingSessions,
  writingSubmissions,
} from "../../db/schema";
import type { Db } from "../db/client";

export async function findActiveWritingCourseForUser(db: Db, userId: string) {
  const rows = await db
    .select()
    .from(writingCourses)
    .where(and(eq(writingCourses.userId, userId), eq(writingCourses.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

/** Unlock sessions whose time has passed (lazy unlock; no cron required). */
export async function lazyUnlockDueSessions(db: Db, courseId: string) {
  const now = new Date();
  await db
    .update(writingSessions)
    .set({ status: "unlocked", updatedAt: now })
    .where(
      and(
        eq(writingSessions.courseId, courseId),
        eq(writingSessions.status, "locked"),
        lte(writingSessions.unlockAt, now)
      )
    );
}

export async function listSessionsForCourseOrdered(db: Db, courseId: string) {
  return db
    .select()
    .from(writingSessions)
    .where(eq(writingSessions.courseId, courseId))
    .orderBy(asc(writingSessions.index));
}

export async function getSessionByIdWithCourse(db: Db, sessionId: string) {
  const rows = await db
    .select({
      session: writingSessions,
      course: writingCourses,
    })
    .from(writingSessions)
    .innerJoin(writingCourses, eq(writingSessions.courseId, writingCourses.id))
    .where(eq(writingSessions.id, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

/** One row if user has an in-flight submission (draft..corrected) platform-wide. */
export async function findActivePipelineSubmissionForUser(db: Db, userId: string) {
  const rows = await db
    .select({
      submission: writingSubmissions,
      session: writingSessions,
    })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .where(
      and(
        eq(writingSubmissions.userId, userId),
        inArray(writingSubmissions.status, ["draft", "submitted", "in_review", "corrected"])
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubmissionByIdForUser(db: Db, submissionId: string, userId: string) {
  const rows = await db
    .select()
    .from(writingSubmissions)
    .where(and(eq(writingSubmissions.id, submissionId), eq(writingSubmissions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubmissionBySessionId(db: Db, sessionId: string) {
  const rows = await db
    .select()
    .from(writingSubmissions)
    .where(eq(writingSubmissions.sessionId, sessionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubmissionBySessionIdForGrant(db: Db, sessionId: string, grantId: string) {
  const rows = await db
    .select()
    .from(writingSubmissions)
    .where(
      and(
        eq(writingSubmissions.sessionId, sessionId),
        eq(writingSubmissions.regularAccessGrantId, grantId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function insertSubmission(
  db: Db,
  row: typeof writingSubmissions.$inferInsert
) {
  const [created] = await db.insert(writingSubmissions).values(row).returning();
  return created;
}

export async function updateSubmissionDraft(
  db: Db,
  submissionId: string,
  patch: {
    bodyText: string | null;
    imageStorageKey: string | null;
    imageMimeType: string | null;
  }
) {
  const [updated] = await db
    .update(writingSubmissions)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(and(eq(writingSubmissions.id, submissionId), eq(writingSubmissions.status, "draft")))
    .returning();
  return updated ?? null;
}

export async function submitSubmissionFinal(db: Db, submissionId: string, userId: string) {
  const now = new Date();
  const [updated] = await db
    .update(writingSubmissions)
    .set({
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(writingSubmissions.id, submissionId),
        eq(writingSubmissions.userId, userId),
        eq(writingSubmissions.status, "draft")
      )
    )
    .returning();
  return updated ?? null;
}

export async function getRegularGrantWithCourse(db: Db, grantId: string) {
  const rows = await db
    .select({ grant: regularAccessGrants, course: writingCourses })
    .from(regularAccessGrants)
    .innerJoin(writingCourses, eq(regularAccessGrants.courseId, writingCourses.id))
    .where(eq(regularAccessGrants.id, grantId))
    .limit(1);
  return rows[0] ?? null;
}

/** In-flight submission for mail-link regular access (same pipeline statuses as student). */
export async function findActivePipelineSubmissionForGrant(db: Db, grantId: string) {
  const rows = await db
    .select({
      submission: writingSubmissions,
      session: writingSessions,
    })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .where(
      and(
        eq(writingSubmissions.regularAccessGrantId, grantId),
        inArray(writingSubmissions.status, ["draft", "submitted", "in_review", "corrected"])
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getSubmissionByIdForGrant(db: Db, submissionId: string, grantId: string) {
  const rows = await db
    .select()
    .from(writingSubmissions)
    .where(
      and(eq(writingSubmissions.id, submissionId), eq(writingSubmissions.regularAccessGrantId, grantId))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function updateSubmissionDraftForGrant(
  db: Db,
  submissionId: string,
  grantId: string,
  patch: {
    bodyText: string | null;
    imageStorageKey: string | null;
    imageMimeType: string | null;
  }
) {
  const [updated] = await db
    .update(writingSubmissions)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(writingSubmissions.id, submissionId),
        eq(writingSubmissions.regularAccessGrantId, grantId),
        eq(writingSubmissions.status, "draft")
      )
    )
    .returning();
  return updated ?? null;
}

export async function submitSubmissionFinalForGrant(db: Db, submissionId: string, grantId: string) {
  const now = new Date();
  const [updated] = await db
    .update(writingSubmissions)
    .set({
      status: "submitted",
      submittedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(writingSubmissions.id, submissionId),
        eq(writingSubmissions.regularAccessGrantId, grantId),
        eq(writingSubmissions.status, "draft")
      )
    )
    .returning();
  return updated ?? null;
}

export type PublishedResultRow = {
  submission: typeof writingSubmissions.$inferSelect;
  correction: typeof writingCorrections.$inferSelect;
};

export async function getPublishedResultForSubmission(
  db: Db,
  submissionId: string,
  userId: string
): Promise<PublishedResultRow | null> {
  const rows = await db
    .select({
      submission: writingSubmissions,
      correction: writingCorrections,
    })
    .from(writingSubmissions)
    .innerJoin(writingCorrections, eq(writingCorrections.submissionId, writingSubmissions.id))
    .where(
      and(
        eq(writingSubmissions.id, submissionId),
        eq(writingSubmissions.userId, userId),
        eq(writingSubmissions.status, "published"),
        eq(writingCorrections.status, "published")
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function getPublishedResultForSubmissionGrant(
  db: Db,
  submissionId: string,
  grantId: string
): Promise<PublishedResultRow | null> {
  const rows = await db
    .select({
      submission: writingSubmissions,
      correction: writingCorrections,
    })
    .from(writingSubmissions)
    .innerJoin(writingCorrections, eq(writingCorrections.submissionId, writingSubmissions.id))
    .where(
      and(
        eq(writingSubmissions.id, submissionId),
        eq(writingSubmissions.regularAccessGrantId, grantId),
        eq(writingSubmissions.status, "published"),
        eq(writingCorrections.status, "published")
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function listFragmentsForCorrection(db: Db, correctionId: string) {
  return db
    .select()
    .from(writingFragments)
    .where(eq(writingFragments.correctionId, correctionId))
    .orderBy(asc(writingFragments.orderIndex));
}

export async function getEvaluationForSubmission(db: Db, submissionId: string) {
  const rows = await db
    .select()
    .from(writingEvaluations)
    .where(eq(writingEvaluations.submissionId, submissionId))
    .limit(1);
  return rows[0] ?? null;
}
