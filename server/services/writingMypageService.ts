/**
 * My Page aggregates — abuse mitigations:
 * 1) IDOR: userId comes only from verified session; every query filters writing.submissions.user_id = session user or course ownership via join.
 * 2) Draft leakage: repositories only join corrections with status = 'published' and submissions with status = 'published' for aggregates; session list never attaches draft correction rows.
 * 3) Cross-tenant global stat: global average submission rate is a single anonymous aggregate (no per-user breakdown returned).
 * 4) Enumeration: UUIDs in responses are the caller’s own rows only; rate-limit at edge in production.
 */

import * as mypageRepo from "../repositories/writingMypageRepository";
import * as studentRepo from "../repositories/writingStudentRepository";
import type { Db } from "../db/client";

const TOP_PAIRS_PER_CATEGORY = 8;

function parseNum(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mean3(g: number | null, v: number | null, c: number | null): number | null {
  if (g == null || v == null || c == null) return null;
  return (g + v + c) / 3;
}

export type WorkflowStage = "none" | "draft" | "submitted" | "in_review" | "published";

function workflowStage(submissionStatus: string | undefined): WorkflowStage {
  if (!submissionStatus) return "none";
  switch (submissionStatus) {
    case "draft":
      return "draft";
    case "submitted":
      return "submitted";
    case "in_review":
    case "corrected":
      return "in_review";
    case "published":
      return "published";
    default:
      return "none";
  }
}

async function requireActiveCourse(db: Db, userId: string) {
  const course = await studentRepo.findActiveWritingCourseForUser(db, userId);
  return course;
}

export type MypageSummaryResponse = {
  courseId: string;
  sessionCount: number;
  publishedSubmissionCount: number;
  /** publishedSubmissionCount / sessionCount (0–1). */
  submissionRate: number;
  /** Mean of per-course ratios across active+completed courses; null if none. */
  globalAverageSubmissionRate: number | null;
  /**
   * Mean of (grammar+vocabulary+context)/3 over published sessions with scores; null if none.
   * Labeled correction rate as product shorthand for “overall score from evaluations.”
   */
  correctionRate: number | null;
  evaluation: {
    grammar: { average: number | null };
    vocabulary: { average: number | null };
    context: { average: number | null };
  };
};

export async function getMypageSummary(
  db: Db,
  userId: string
): Promise<MypageSummaryResponse | null> {
  const course = await requireActiveCourse(db, userId);
  if (!course) return null;

  const [publishedCount, globalAvg, evalAgg] = await Promise.all([
    mypageRepo.countPublishedSubmissionsForCourse(db, course.id, userId),
    mypageRepo.getGlobalAverageSubmissionRate(db),
    mypageRepo.getPublishedEvaluationAggregatesForCourse(db, course.id, userId),
  ]);

  const sessionCount = course.sessionCount;
  const submissionRate = sessionCount > 0 ? publishedCount / sessionCount : 0;

  const g = parseNum(evalAgg?.avgGrammar ?? null);
  const v = parseNum(evalAgg?.avgVocabulary ?? null);
  const c = parseNum(evalAgg?.avgContext ?? null);
  const correctionRate = mean3(g, v, c);

  return {
    courseId: course.id,
    sessionCount,
    publishedSubmissionCount: publishedCount,
    submissionRate: round1(submissionRate),
    globalAverageSubmissionRate: globalAvg != null ? round1(globalAvg) : null,
    correctionRate: correctionRate != null ? round1(correctionRate) : null,
    evaluation: {
      grammar: { average: g != null ? round1(g) : null },
      vocabulary: { average: v != null ? round1(v) : null },
      context: { average: c != null ? round1(c) : null },
    },
  };
}

export type MypageCommentItem = {
  submissionId: string;
  sessionIndex: number;
  teacherComment: string;
  publishedAt: string | null;
};

export async function getMypageComments(
  db: Db,
  userId: string
): Promise<{ courseId: string; items: MypageCommentItem[] } | null> {
  const course = await requireActiveCourse(db, userId);
  if (!course) return null;

  const rows = await mypageRepo.listPublishedTeacherCommentsForCourse(db, course.id, userId);
  const items = rows.map((r) => ({
    submissionId: r.submissionId,
    sessionIndex: r.sessionIndex,
    teacherComment: r.teacherComment,
    publishedAt: r.publishedAt?.toISOString() ?? null,
  }));
  return { courseId: course.id, items };
}

export type MypageSessionItem = {
  sessionId: string;
  index: number;
  unlockAt: string;
  sessionStatus: string;
  submission: null | {
    id: string;
    status: string;
    workflowStage: WorkflowStage;
  };
  /** True when the student has a published result for this session. */
  correctionAvailable: boolean;
  publishedAt: string | null;
  /** Average of grammar/vocabulary/context when published with scores. */
  correctionRate: number | null;
  evaluation: null | {
    grammar: number;
    vocabulary: number;
    context: number;
  };
};

export async function getMypageSessions(
  db: Db,
  userId: string
): Promise<{ courseId: string; sessions: MypageSessionItem[] } | null> {
  const course = await requireActiveCourse(db, userId);
  if (!course) return null;

  await studentRepo.lazyUnlockDueSessions(db, course.id);
  const rows = await mypageRepo.listSessionsWithSubmissionStateForMypage(db, course.id, userId);

  const sessions = rows.map((r) => {
    const sub = r.submission;
    const wf = workflowStage(sub?.status);
    const published = sub?.status === "published";
    const g = r.grammar;
    const voc = r.vocabulary;
    const ctx = r.context;
    const evalTriple =
      g != null && voc != null && ctx != null
        ? { grammar: g, vocabulary: voc, context: ctx }
        : null;
    const correctionRate = evalTriple ? round1(mean3(g, voc, ctx)!) : null;

    return {
      sessionId: r.session.id,
      index: r.session.index,
      unlockAt: r.session.unlockAt.toISOString(),
      sessionStatus: r.session.status,
      submission: sub
        ? {
            id: sub.id,
            status: sub.status,
            workflowStage: wf,
          }
        : null,
      correctionAvailable: published,
      publishedAt: r.correctionPublishedAt?.toISOString() ?? null,
      correctionRate,
      evaluation: evalTriple,
    };
  });

  return { courseId: course.id, sessions };
}

export type FrequentMistakesCategory = {
  category: string;
  fragmentCount: number;
  topPairs: Array<{
    originalText: string;
    correctedText: string;
    count: number;
  }>;
};

export type MypageFrequentMistakesResponse = {
  courseId: string;
  categories: FrequentMistakesCategory[];
  totalFragments: number;
};

export async function getMypageFrequentMistakes(
  db: Db,
  userId: string
): Promise<MypageFrequentMistakesResponse | null> {
  const course = await requireActiveCourse(db, userId);
  if (!course) return null;

  const pairs = await mypageRepo.aggregatePublishedFragmentPairsForCourse(db, course.id, userId);

  const categoryTotals = new Map<string, number>();
  for (const p of pairs) {
    categoryTotals.set(p.category, (categoryTotals.get(p.category) ?? 0) + p.count);
  }

  const totalFragments = [...categoryTotals.values()].reduce((a, b) => a + b, 0);

  const categoriesOrdered = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);

  const categories: FrequentMistakesCategory[] = categoriesOrdered.map(([category, fragmentCount]) => {
    const topPairs = pairs
      .filter((p) => p.category === category)
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_PAIRS_PER_CATEGORY)
      .map((p) => ({
        originalText: p.originalText,
        correctedText: p.correctedText,
        count: p.count,
      }));
    return { category, fragmentCount, topPairs };
  });

  return { courseId: course.id, categories, totalFragments };
}
