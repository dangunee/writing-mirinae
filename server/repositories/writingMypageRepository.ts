import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import {
  writingCorrectionEvaluations,
  writingCorrectionFeedbackItems,
  writingCorrections,
  writingEvaluations,
  writingFragments,
  writingSessions,
  writingSubmissions,
} from "../../db/schema";
import type { Db } from "../db/client";

/** Published submissions only — for aggregates and My Page (no draft data). */
const publishedSubmission = eq(writingSubmissions.status, "published");
const publishedCorrection = eq(writingCorrections.status, "published");

/** Missed slots are not “corrected work” for aggregates (defensive even if published rows are impossible). */
const sessionNotMissed = sql`(${writingSessions.runtimeStatus} IS NULL OR ${writingSessions.runtimeStatus} <> 'missed'::writing.session_runtime)`;

export async function getGlobalAverageSubmissionRate(db: Db): Promise<number | null> {
  const rows = await db.execute<{ avg: string | null }>(sql`
    SELECT AVG(sub.published_ratio)::text AS avg
    FROM (
      SELECT
        c.id,
        (SELECT COUNT(*)::float
         FROM writing.submissions s
         WHERE s.course_id = c.id AND s.status = 'published')
          / NULLIF(c.session_count, 0)::float AS published_ratio
      FROM writing.courses c
      WHERE c.status IN ('active', 'completed')
    ) AS sub
  `);
  const raw = rows[0]?.avg;
  if (raw == null || raw === "") return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

export type EvaluationAveragesRow = {
  avgGrammar: string | null;
  avgVocabulary: string | null;
  avgContext: string | null;
  publishedCount: string;
};

/** Averages from writing.correction_evaluations (published corrections only; excludes missed sessions). */
export async function getPublishedEvaluationAggregatesFromCorrectionEvaluations(
  db: Db,
  courseId: string,
  userId: string
): Promise<EvaluationAveragesRow | null> {
  const rows = await db
    .select({
      avgGrammar: sql<string>`avg(${writingCorrectionEvaluations.grammar})::text`.as("avg_grammar"),
      avgVocabulary: sql<string>`avg(${writingCorrectionEvaluations.vocabulary})::text`.as("avg_vocab"),
      avgContext: sql<string>`avg(${writingCorrectionEvaluations.flow})::text`.as("avg_ctx"),
      publishedCount: sql<string>`count(*)::text`.as("published_count"),
    })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .innerJoin(writingCorrections, eq(writingCorrections.submissionId, writingSubmissions.id))
    .innerJoin(
      writingCorrectionEvaluations,
      eq(writingCorrectionEvaluations.correctionId, writingCorrections.id)
    )
    .where(
      and(
        eq(writingSubmissions.courseId, courseId),
        eq(writingSubmissions.userId, userId),
        publishedSubmission,
        publishedCorrection,
        sessionNotMissed
      )
    );
  const row = rows[0];
  if (!row || row.publishedCount === "0") {
    return {
      avgGrammar: null,
      avgVocabulary: null,
      avgContext: null,
      publishedCount: "0",
    };
  }
  return {
    avgGrammar: row.avgGrammar,
    avgVocabulary: row.avgVocabulary,
    avgContext: row.avgContext,
    publishedCount: row.publishedCount,
  };
}

/** Fallback for older rows before correction_evaluations backfill. */
export async function getPublishedEvaluationAggregatesFromWritingEvaluationsLegacy(
  db: Db,
  courseId: string,
  userId: string
): Promise<EvaluationAveragesRow | null> {
  const rows = await db
    .select({
      avgGrammar: sql<string>`avg(${writingEvaluations.grammarAccuracy})::text`.as("avg_grammar"),
      avgVocabulary: sql<string>`avg(${writingEvaluations.vocabularyUsage})::text`.as("avg_vocab"),
      avgContext: sql<string>`avg(${writingEvaluations.contextualFluency})::text`.as("avg_ctx"),
      publishedCount: sql<string>`count(*)::text`.as("published_count"),
    })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .innerJoin(writingEvaluations, eq(writingEvaluations.submissionId, writingSubmissions.id))
    .where(
      and(
        eq(writingSubmissions.courseId, courseId),
        eq(writingSubmissions.userId, userId),
        publishedSubmission,
        sessionNotMissed
      )
    );
  const row = rows[0];
  if (!row || row.publishedCount === "0") {
    return {
      avgGrammar: null,
      avgVocabulary: null,
      avgContext: null,
      publishedCount: "0",
    };
  }
  return {
    avgGrammar: row.avgGrammar,
    avgVocabulary: row.avgVocabulary,
    avgContext: row.avgContext,
    publishedCount: row.publishedCount,
  };
}

export async function countPublishedSubmissionsForCourse(
  db: Db,
  courseId: string,
  userId: string
): Promise<number> {
  const rows = await db
    .select({ n: sql<string>`count(*)::text`.as("n") })
    .from(writingSubmissions)
    .innerJoin(writingSessions, eq(writingSubmissions.sessionId, writingSessions.id))
    .where(
      and(
        eq(writingSubmissions.courseId, courseId),
        eq(writingSubmissions.userId, userId),
        publishedSubmission,
        sessionNotMissed
      )
    );
  return parseInt(rows[0]?.n ?? "0", 10) || 0;
}

export type SessionMypageRow = {
  session: typeof writingSessions.$inferSelect;
  submission: typeof writingSubmissions.$inferSelect | null;
  correctionPublishedAt: Date | null;
  grammar: number | null;
  vocabulary: number | null;
  context: number | null;
};

export async function listSessionsWithSubmissionStateForMypage(
  db: Db,
  courseId: string,
  userId: string
): Promise<SessionMypageRow[]> {
  const rows = await db
    .select({
      session: writingSessions,
      submission: writingSubmissions,
      correctionPublishedAt: writingCorrections.publishedAt,
      grammar: sql<number | null>`coalesce(${writingCorrectionEvaluations.grammar}, ${writingEvaluations.grammarAccuracy})`.as(
        "grammar"
      ),
      vocabulary: sql<number | null>`coalesce(${writingCorrectionEvaluations.vocabulary}, ${writingEvaluations.vocabularyUsage})`.as(
        "vocabulary"
      ),
      context: sql<number | null>`coalesce(${writingCorrectionEvaluations.flow}, ${writingEvaluations.contextualFluency})`.as(
        "context"
      ),
    })
    .from(writingSessions)
    .leftJoin(
      writingSubmissions,
      and(
        eq(writingSubmissions.sessionId, writingSessions.id),
        eq(writingSubmissions.userId, userId)
      )
    )
    .leftJoin(
      writingCorrections,
      and(
        eq(writingCorrections.submissionId, writingSubmissions.id),
        publishedCorrection
      )
    )
    .leftJoin(
      writingCorrectionEvaluations,
      eq(writingCorrectionEvaluations.correctionId, writingCorrections.id)
    )
    .leftJoin(
      writingEvaluations,
      and(eq(writingEvaluations.submissionId, writingSubmissions.id), publishedSubmission)
    )
    .where(and(eq(writingSessions.courseId, courseId), isNull(writingSessions.trialApplicationId)))
    .orderBy(asc(writingSessions.index));

  return rows.map((r) => ({
    session: r.session,
    submission: r.submission,
    correctionPublishedAt: r.correctionPublishedAt,
    grammar: r.grammar,
    vocabulary: r.vocabulary,
    context: r.context,
  }));
}

export type PublishedCommentRow = {
  submissionId: string;
  sessionIndex: number;
  teacherComment: string;
  publishedAt: Date | null;
};

export async function listPublishedTeacherCommentsForCourse(
  db: Db,
  courseId: string,
  userId: string
): Promise<PublishedCommentRow[]> {
  const rows = await db
    .select({
      submissionId: writingSubmissions.id,
      sessionIndex: writingSessions.index,
      teacherComment: writingCorrections.teacherComment,
      publishedAt: writingCorrections.publishedAt,
    })
    .from(writingCorrections)
    .innerJoin(writingSubmissions, eq(writingSubmissions.id, writingCorrections.submissionId))
    .innerJoin(writingSessions, eq(writingSessions.id, writingSubmissions.sessionId))
    .where(
      and(
        eq(writingSubmissions.courseId, courseId),
        eq(writingSubmissions.userId, userId),
        publishedSubmission,
        publishedCorrection,
        sql`trim(coalesce(${writingCorrections.teacherComment}, '')) <> ''`,
        sessionNotMissed
      )
    )
    .orderBy(desc(writingCorrections.publishedAt), desc(writingCorrections.id));

  return rows.map((r) => ({
    submissionId: r.submissionId,
    sessionIndex: r.sessionIndex,
    teacherComment: r.teacherComment!,
    publishedAt: r.publishedAt,
  }));
}

export type FragmentPairAgg = {
  category: string;
  originalText: string;
  correctedText: string;
  count: number;
};

/** Primary: structured feedback rows (teacher flow dual-writes from fragments). */
export async function aggregatePublishedFeedbackItemPairsForCourse(
  db: Db,
  courseId: string,
  userId: string
): Promise<FragmentPairAgg[]> {
  const rows = await db
    .select({
      category: writingCorrectionFeedbackItems.category,
      originalText: writingCorrectionFeedbackItems.originalText,
      correctedText: writingCorrectionFeedbackItems.correctedText,
      count: sql<number>`count(*)::int`.as("cnt"),
    })
    .from(writingCorrectionFeedbackItems)
    .innerJoin(writingCorrections, eq(writingCorrections.id, writingCorrectionFeedbackItems.correctionId))
    .innerJoin(writingSubmissions, eq(writingSubmissions.id, writingCorrections.submissionId))
    .innerJoin(writingSessions, eq(writingSessions.id, writingSubmissions.sessionId))
    .where(
      and(
        eq(writingSubmissions.courseId, courseId),
        eq(writingSubmissions.userId, userId),
        publishedSubmission,
        publishedCorrection,
        sessionNotMissed
      )
    )
    .groupBy(
      writingCorrectionFeedbackItems.category,
      writingCorrectionFeedbackItems.originalText,
      writingCorrectionFeedbackItems.correctedText
    );

  return rows
    .map((r) => ({
      category: r.category,
      originalText: r.originalText,
      correctedText: r.correctedText,
      count: Number(r.count),
    }))
    .sort((a, b) => b.count - a.count);
}

/** Legacy fallback when correction_feedback_items is empty (older publishes). */
export async function aggregatePublishedFragmentPairsForCourse(
  db: Db,
  courseId: string,
  userId: string
): Promise<FragmentPairAgg[]> {
  const rows = await db
    .select({
      category: writingFragments.category,
      originalText: writingFragments.originalText,
      correctedText: writingFragments.correctedText,
      count: sql<number>`count(*)::int`.as("cnt"),
    })
    .from(writingFragments)
    .innerJoin(writingCorrections, eq(writingCorrections.id, writingFragments.correctionId))
    .innerJoin(writingSubmissions, eq(writingSubmissions.id, writingCorrections.submissionId))
    .innerJoin(writingSessions, eq(writingSessions.id, writingSubmissions.sessionId))
    .where(
      and(
        eq(writingSubmissions.courseId, courseId),
        eq(writingSubmissions.userId, userId),
        publishedSubmission,
        publishedCorrection,
        sessionNotMissed
      )
    )
    .groupBy(
      writingFragments.category,
      writingFragments.originalText,
      writingFragments.correctedText
    );

  return rows
    .map((r) => ({
      category: r.category,
      originalText: r.originalText,
      correctedText: r.correctedText,
      count: Number(r.count),
    }))
    .sort((a, b) => b.count - a.count);
}
