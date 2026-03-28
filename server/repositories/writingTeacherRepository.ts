import { and, asc, eq, inArray } from "drizzle-orm";

import {
  writingCorrections,
  writingCourses,
  writingEvaluations,
  writingFragments,
  writingSessions,
  writingSubmissions,
} from "../../db/schema";
import type { Db } from "../db/client";

const QUEUE_STATUSES = ["submitted", "in_review"] as const;

export async function listSubmissionQueue(db: Db) {
  const rows = await db
    .select({
      submission: writingSubmissions,
      session: writingSessions,
      course: writingCourses,
      correction: writingCorrections,
    })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .innerJoin(writingCourses, eq(writingSubmissions.courseId, writingCourses.id))
    .leftJoin(writingCorrections, eq(writingCorrections.submissionId, writingSubmissions.id))
    .where(inArray(writingSubmissions.status, [...QUEUE_STATUSES]))
    .orderBy(asc(writingSubmissions.submittedAt), asc(writingSubmissions.createdAt), asc(writingSubmissions.id));
  return rows;
}

export async function getSubmissionFullForTeacher(db: Db, submissionId: string) {
  const rows = await db
    .select({
      submission: writingSubmissions,
      session: writingSessions,
      course: writingCourses,
    })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .innerJoin(writingCourses, eq(writingSubmissions.courseId, writingCourses.id))
    .where(eq(writingSubmissions.id, submissionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCorrectionBySubmissionId(db: Db, submissionId: string) {
  const rows = await db
    .select()
    .from(writingCorrections)
    .where(eq(writingCorrections.submissionId, submissionId))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertCorrection(
  db: Db,
  row: typeof writingCorrections.$inferInsert
) {
  const [created] = await db.insert(writingCorrections).values(row).returning();
  return created;
}

export async function updateCorrectionDraft(
  db: Db,
  correctionId: string,
  teacherId: string,
  patch: Partial<
    Pick<
      typeof writingCorrections.$inferInsert,
      "polishedSentence" | "modelAnswer" | "teacherComment"
    >
  >
) {
  const [updated] = await db
    .update(writingCorrections)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(
        eq(writingCorrections.id, correctionId),
        eq(writingCorrections.teacherId, teacherId),
        eq(writingCorrections.status, "draft")
      )
    )
    .returning();
  return updated ?? null;
}

export async function publishCorrectionRow(
  db: Db,
  correctionId: string,
  teacherId: string
) {
  const now = new Date();
  const [updated] = await db
    .update(writingCorrections)
    .set({
      status: "published",
      publishedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(writingCorrections.id, correctionId),
        eq(writingCorrections.teacherId, teacherId),
        eq(writingCorrections.status, "draft")
      )
    )
    .returning();
  return updated ?? null;
}

export async function deleteFragmentsForCorrection(db: Db, correctionId: string) {
  await db.delete(writingFragments).where(eq(writingFragments.correctionId, correctionId));
}

export async function insertFragmentsBatch(
  db: Db,
  rows: (typeof writingFragments.$inferInsert)[]
) {
  if (rows.length === 0) return;
  await db.insert(writingFragments).values(rows);
}

/** Merge partial scores with existing row so draft saves do not null out omitted fields. */
export async function mergeEvaluationScores(
  db: Db,
  submissionId: string,
  patch: {
    grammarAccuracy?: number | null;
    vocabularyUsage?: number | null;
    contextualFluency?: number | null;
  }
) {
  const existing = await getEvaluationBySubmission(db, submissionId);
  const grammarAccuracy =
    patch.grammarAccuracy !== undefined ? patch.grammarAccuracy : existing?.grammarAccuracy ?? null;
  const vocabularyUsage =
    patch.vocabularyUsage !== undefined ? patch.vocabularyUsage : existing?.vocabularyUsage ?? null;
  const contextualFluency =
    patch.contextualFluency !== undefined ? patch.contextualFluency : existing?.contextualFluency ?? null;

  if (existing) {
    await db
      .update(writingEvaluations)
      .set({
        grammarAccuracy,
        vocabularyUsage,
        contextualFluency,
        updatedAt: new Date(),
      })
      .where(eq(writingEvaluations.submissionId, submissionId));
  } else {
    await db.insert(writingEvaluations).values({
      submissionId,
      grammarAccuracy,
      vocabularyUsage,
      contextualFluency,
    });
  }
}

export async function getEvaluationBySubmission(db: Db, submissionId: string) {
  const rows = await db
    .select()
    .from(writingEvaluations)
    .where(eq(writingEvaluations.submissionId, submissionId))
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

export async function updateSubmissionStatus(
  db: Db,
  submissionId: string,
  status: (typeof writingSubmissions.$inferInsert)["status"]
) {
  await db
    .update(writingSubmissions)
    .set({ status, updatedAt: new Date() })
    .where(eq(writingSubmissions.id, submissionId));
}
