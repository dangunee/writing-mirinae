import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import {
  profiles,
  regularAccessGrants,
  trialApplications,
  writingAssignmentMasters,
  writingCorrectionAnnotations,
  writingCorrectionEvaluations,
  writingCorrectionFeedbackItems,
  writingCorrections,
  writingCourses,
  writingEvaluations,
  writingFragments,
  writingSessions,
  writingSubmissions,
  writingTerms,
} from "../../db/schema";
import type { Db } from "../db/client";

/**
 * Some production DBs lack `grammar_check_result`; teacher routes must not select it (avoids PostgresError).
 * Keep columns in sync with `writing.submissions` minus that field.
 */
const submissionColumnsForTeacher = {
  id: writingSubmissions.id,
  sessionId: writingSubmissions.sessionId,
  courseId: writingSubmissions.courseId,
  userId: writingSubmissions.userId,
  regularAccessGrantId: writingSubmissions.regularAccessGrantId,
  trialApplicationId: writingSubmissions.trialApplicationId,
  status: writingSubmissions.status,
  submissionMode: writingSubmissions.submissionMode,
  bodyText: writingSubmissions.bodyText,
  imageStorageKey: writingSubmissions.imageStorageKey,
  imageMimeType: writingSubmissions.imageMimeType,
  submittedAt: writingSubmissions.submittedAt,
  createdAt: writingSubmissions.createdAt,
  updatedAt: writingSubmissions.updatedAt,
} as const;

const QUEUE_STATUSES_PENDING = ["submitted", "in_review"] as const;
const QUEUE_STATUSES_COMPLETED = ["corrected", "published"] as const;

/** Display identity for teachers: logged-in student profile, mail-link grant, or trial application (one XOR path per submission). */
const queueStudentIdentitySelect = {
  studentName: sql<string | null>`
    COALESCE(${profiles.name}, ${regularAccessGrants.studentName}, ${trialApplications.applicantName})
  `.as("queue_student_name"),
  studentEmail: sql<string | null>`
    COALESCE(${profiles.email}, ${regularAccessGrants.studentEmail}, ${trialApplications.applicantEmail})
  `.as("queue_student_email"),
} as const;

/**
 * Pending work (oldest first). Trial + regular + sandbox mirrors — same as legacy queue.
 */
export async function listSubmissionQueuePending(db: Db) {
  const rows = await db
    .select({
      submission: submissionColumnsForTeacher,
      session: writingSessions,
      course: writingCourses,
      correction: writingCorrections,
      ...queueStudentIdentitySelect,
    })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .innerJoin(writingCourses, eq(writingSubmissions.courseId, writingCourses.id))
    .leftJoin(writingCorrections, eq(writingCorrections.submissionId, writingSubmissions.id))
    .leftJoin(profiles, eq(writingSubmissions.userId, profiles.id))
    .leftJoin(regularAccessGrants, eq(writingSubmissions.regularAccessGrantId, regularAccessGrants.id))
    .leftJoin(trialApplications, eq(writingSubmissions.trialApplicationId, trialApplications.id))
    .where(inArray(writingSubmissions.status, [...QUEUE_STATUSES_PENDING]))
    .orderBy(asc(writingSubmissions.submittedAt), asc(writingSubmissions.createdAt), asc(writingSubmissions.id));
  return rows;
}

/**
 * Finished pipeline rows (newest activity first). `corrected` = 첨삭 저장됨·미공개 가능, `published` = 학생 공개.
 */
export async function listSubmissionQueueCompleted(db: Db) {
  const rows = await db
    .select({
      submission: submissionColumnsForTeacher,
      session: writingSessions,
      course: writingCourses,
      correction: writingCorrections,
      ...queueStudentIdentitySelect,
    })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .innerJoin(writingCourses, eq(writingSubmissions.courseId, writingCourses.id))
    .leftJoin(writingCorrections, eq(writingCorrections.submissionId, writingSubmissions.id))
    .leftJoin(profiles, eq(writingSubmissions.userId, profiles.id))
    .leftJoin(regularAccessGrants, eq(writingSubmissions.regularAccessGrantId, regularAccessGrants.id))
    .leftJoin(trialApplications, eq(writingSubmissions.trialApplicationId, trialApplications.id))
    .where(inArray(writingSubmissions.status, [...QUEUE_STATUSES_COMPLETED]))
    .orderBy(
      desc(sql`COALESCE(${writingCorrections.publishedAt}, ${writingCorrections.updatedAt}, ${writingSubmissions.updatedAt})`),
      desc(writingSubmissions.id)
    );
  return rows;
}

/** @deprecated Use listSubmissionQueuePending — alias for backwards compatibility within repo. */
export async function listSubmissionQueue(db: Db) {
  return listSubmissionQueuePending(db);
}

export async function getSubmissionFullForTeacher(db: Db, submissionId: string) {
  const rows = await db
    .select({
      submission: submissionColumnsForTeacher,
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

export async function getWritingTermById(db: Db, termId: string) {
  const rows = await db
    .select({ id: writingTerms.id, title: writingTerms.title })
    .from(writingTerms)
    .where(eq(writingTerms.id, termId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getAssignmentMasterById(db: Db, id: string) {
  const rows = await db.select().from(writingAssignmentMasters).where(eq(writingAssignmentMasters.id, id)).limit(1);
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
      | "polishedSentence"
      | "modelAnswer"
      | "teacherComment"
      | "richDocumentJson"
      | "improvedText"
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

export async function deleteFeedbackItemsForCorrection(db: Db, correctionId: string) {
  await db
    .delete(writingCorrectionFeedbackItems)
    .where(eq(writingCorrectionFeedbackItems.correctionId, correctionId));
}

export async function insertFeedbackItemsBatch(
  db: Db,
  rows: (typeof writingCorrectionFeedbackItems.$inferInsert)[]
) {
  if (rows.length === 0) return;
  await db.insert(writingCorrectionFeedbackItems).values(rows);
}

export async function listFeedbackItemsForCorrection(db: Db, correctionId: string) {
  return db
    .select()
    .from(writingCorrectionFeedbackItems)
    .where(eq(writingCorrectionFeedbackItems.correctionId, correctionId))
    .orderBy(asc(writingCorrectionFeedbackItems.sortOrder), asc(writingCorrectionFeedbackItems.id));
}

export async function deleteAnnotationsForCorrection(db: Db, correctionId: string) {
  await db
    .delete(writingCorrectionAnnotations)
    .where(eq(writingCorrectionAnnotations.correctionId, correctionId));
}

export async function insertAnnotationsBatch(
  db: Db,
  rows: (typeof writingCorrectionAnnotations.$inferInsert)[]
) {
  if (rows.length === 0) return;
  await db.insert(writingCorrectionAnnotations).values(rows);
}

export async function listAnnotationsForCorrection(db: Db, correctionId: string) {
  return db
    .select()
    .from(writingCorrectionAnnotations)
    .where(eq(writingCorrectionAnnotations.correctionId, correctionId))
    .orderBy(asc(writingCorrectionAnnotations.sortOrder), asc(writingCorrectionAnnotations.id));
}

export async function getCorrectionEvaluationByCorrectionId(db: Db, correctionId: string) {
  const rows = await db
    .select()
    .from(writingCorrectionEvaluations)
    .where(eq(writingCorrectionEvaluations.correctionId, correctionId))
    .limit(1);
  return rows[0] ?? null;
}

/** Sync writing.correction_evaluations from writing.evaluations (trigger still reads writing.evaluations). */
export async function upsertCorrectionEvaluationFromSubmissionScores(
  db: Db,
  correctionId: string,
  submissionId: string
) {
  const ev = await getEvaluationBySubmission(db, submissionId);
  if (!ev) return;
  await db
    .insert(writingCorrectionEvaluations)
    .values({
      correctionId,
      grammar: ev.grammarAccuracy,
      vocabulary: ev.vocabularyUsage,
      flow: ev.contextualFluency,
      coherence: null,
    })
    .onConflictDoUpdate({
      target: writingCorrectionEvaluations.correctionId,
      set: {
        grammar: ev.grammarAccuracy,
        vocabulary: ev.vocabularyUsage,
        flow: ev.contextualFluency,
        updatedAt: new Date(),
      },
    });
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
