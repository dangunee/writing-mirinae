/**
 * Teacher correction flow — abuse mitigations:
 * 1) IDOR / cross-tenant access: every mutation loads submission by id and enforces correction.teacher_id = session teacher (never trust body alone).
 * 2) Student routes vs teacher routes: teacher APIs require TEACHER_USER_IDS (or TEACHER_ALLOW_ALL in dev); students never receive teacher URLs in v1 UI.
 * 3) Fragment / text flooding: caps on fragment count and per-field length; reject oversized payloads before DB.
 * 4) Double-publish / race: single UPDATE ... WHERE status = 'draft' + DB triggers; concurrent publishes surface as failed update.
 * 5) Audit / future assignment: log teacherUserId + submissionId on mutations (structured console in v1); course-level teacher_id can restrict queue later.
 */

import { PostgresError } from "postgres";

import type { Db } from "../db/client";
import * as repo from "../repositories/writingTeacherRepository";
import { getSignedImageUrl } from "./writingStudentService";

const EDITABLE_SUBMISSION_STATUSES = ["submitted", "in_review"] as const;

const MAX_FRAGMENTS = 500;
const MAX_FRAGMENT_FIELD_CHARS = 12_000;
const MAX_CORRECTION_FIELD_CHARS = 100_000;

const ERROR_CATEGORIES = [
  "grammar",
  "expression",
  "vocabulary",
  "particle",
  "spelling",
  "honorifics",
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

function isErrorCategory(s: string): s is ErrorCategory {
  return (ERROR_CATEGORIES as readonly string[]).includes(s);
}

function nonEmptyTrimmed(s: string | null | undefined): boolean {
  return typeof s === "string" && s.trim().length > 0;
}

function isValidScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100;
}

function queueSortKeyFromItem(it: QueueItem): number {
  return new Date(it.submittedAt ?? it.createdAt).getTime();
}

export type QueueItem = {
  submissionId: string;
  studentUserId: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  sessionId: string;
  sessionIndex: number;
  courseId: string;
  courseStatus: string;
  bodyPreview: string | null;
  hasImage: boolean;
  correction: null | {
    id: string;
    teacherId: string;
    status: string;
    updatedAt: string;
  };
};

export type QueueGroupedResponse = {
  /** ISO date (YYYY-MM-DD) in UTC for grouping; items within each group are oldest first. */
  groups: Array<{ date: string; items: QueueItem[] }>;
};

export async function getTeacherQueueGrouped(db: Db): Promise<QueueGroupedResponse> {
  const rows = await repo.listSubmissionQueue(db);
  const items: QueueItem[] = rows.map((r) => ({
    submissionId: r.submission.id,
    studentUserId: r.submission.userId,
    status: r.submission.status,
    submittedAt: r.submission.submittedAt?.toISOString() ?? null,
    createdAt: r.submission.createdAt.toISOString(),
    sessionId: r.session.id,
    sessionIndex: r.session.index,
    courseId: r.course.id,
    courseStatus: r.course.status,
    bodyPreview:
      r.submission.bodyText && r.submission.bodyText.length > 0
        ? r.submission.bodyText.slice(0, 280) + (r.submission.bodyText.length > 280 ? "…" : "")
        : null,
    hasImage: Boolean(r.submission.imageStorageKey),
    correction: r.correction?.id
      ? {
          id: r.correction.id,
          teacherId: r.correction.teacherId,
          status: r.correction.status,
          updatedAt: r.correction.updatedAt.toISOString(),
        }
      : null,
  }));

  const byDate = new Map<string, QueueItem[]>();
  for (const it of items) {
    const d = new Date(queueSortKeyFromItem(it));
    const key = d.toISOString().slice(0, 10);
    const list = byDate.get(key) ?? [];
    list.push(it);
    byDate.set(key, list);
  }

  const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
  const groups = dates.map((date) => {
    const list = byDate.get(date)!;
    list.sort((a, b) => queueSortKeyFromItem(a) - queueSortKeyFromItem(b));
    return { date, items: list };
  });

  return { groups };
}

export type TeacherSubmissionDetail = {
      submission: {
        id: string;
        userId: string;
        status: string;
        bodyText: string | null;
        imageMimeType: string | null;
        imageUrl: string | null;
        submittedAt: string | null;
        createdAt: string;
        updatedAt: string;
      };
      session: { id: string; index: number; status: string; unlockAt: string };
      course: { id: string; status: string; sessionCount: number };
      correction: null | {
        id: string;
        teacherId: string;
        status: string;
        polishedSentence: string | null;
        modelAnswer: string | null;
        teacherComment: string | null;
        publishedAt: string | null;
        createdAt: string;
        updatedAt: string;
      };
      fragments: Array<{
        id: string;
        orderIndex: number;
        originalText: string;
        correctedText: string;
        category: string;
        startOffset: number | null;
        endOffset: number | null;
      }>;
      evaluation: null | {
        grammarAccuracy: number | null;
        vocabularyUsage: number | null;
        contextualFluency: number | null;
      };
    };

export async function getTeacherSubmissionDetail(
  db: Db,
  submissionId: string
): Promise<TeacherSubmissionDetail | null> {
  const row = await repo.getSubmissionFullForTeacher(db, submissionId);
  if (!row) return null;

  let imageUrl: string | null = null;
  if (row.submission.imageStorageKey) {
    imageUrl = await getSignedImageUrl(row.submission.imageStorageKey);
  }

  const correction = await repo.getCorrectionBySubmissionId(db, submissionId);
  const fragments = correction
    ? await repo.listFragmentsForCorrection(db, correction.id)
    : [];
  const evaluation = await repo.getEvaluationBySubmission(db, submissionId);

  return {
    submission: {
      id: row.submission.id,
      userId: row.submission.userId,
      status: row.submission.status,
      bodyText: row.submission.bodyText,
      imageMimeType: row.submission.imageMimeType,
      imageUrl,
      submittedAt: row.submission.submittedAt?.toISOString() ?? null,
      createdAt: row.submission.createdAt.toISOString(),
      updatedAt: row.submission.updatedAt.toISOString(),
    },
    session: {
      id: row.session.id,
      index: row.session.index,
      status: row.session.status,
      unlockAt: row.session.unlockAt.toISOString(),
    },
    course: {
      id: row.course.id,
      status: row.course.status,
      sessionCount: row.course.sessionCount,
    },
    correction: correction
      ? {
          id: correction.id,
          teacherId: correction.teacherId,
          status: correction.status,
          polishedSentence: correction.polishedSentence,
          modelAnswer: correction.modelAnswer,
          teacherComment: correction.teacherComment,
          publishedAt: correction.publishedAt?.toISOString() ?? null,
          createdAt: correction.createdAt.toISOString(),
          updatedAt: correction.updatedAt.toISOString(),
        }
      : null,
    fragments: fragments.map((f) => ({
      id: f.id,
      orderIndex: f.orderIndex,
      originalText: f.originalText,
      correctedText: f.correctedText,
      category: f.category,
      startOffset: f.startOffset,
      endOffset: f.endOffset,
    })),
    evaluation: evaluation
      ? {
          grammarAccuracy: evaluation.grammarAccuracy,
          vocabularyUsage: evaluation.vocabularyUsage,
          contextualFluency: evaluation.contextualFluency,
        }
      : null,
  };
}

function assertEditableSubmission(
  status: string
): { ok: true } | { ok: false; code: "submission_not_correctable" } {
  if ((EDITABLE_SUBMISSION_STATUSES as readonly string[]).includes(status)) {
    return { ok: true };
  }
  return { ok: false, code: "submission_not_correctable" };
}

async function maybeSetInReview(
  db: Db,
  submissionId: string,
  currentStatus: string
): Promise<void> {
  if (currentStatus === "submitted") {
    await repo.updateSubmissionStatus(db, submissionId, "in_review");
  }
}

async function ensureCorrectionDraftForTeacher(
  db: Db,
  teacherId: string,
  submissionId: string,
  submissionStatus: string
): Promise<
  | { ok: true; correction: NonNullable<Awaited<ReturnType<typeof repo.getCorrectionBySubmissionId>>> }
  | { ok: false; code: string; status: number }
> {
  const el = assertEditableSubmission(submissionStatus);
  if (!el.ok) return { ok: false, code: el.code, status: 409 };

  const existing = await repo.getCorrectionBySubmissionId(db, submissionId);
  if (existing) {
    if (existing.teacherId !== teacherId) {
      return { ok: false, code: "correction_owned_by_other_teacher", status: 403 };
    }
    if (existing.status !== "draft") {
      return { ok: false, code: "correction_not_editable", status: 409 };
    }
    return { ok: true, correction: existing };
  }

  try {
    const created = await repo.insertCorrection(db, {
      submissionId,
      teacherId,
      status: "draft",
      polishedSentence: null,
      modelAnswer: null,
      teacherComment: null,
      publishedAt: null,
    });
    await maybeSetInReview(db, submissionId, submissionStatus);
    return { ok: true, correction: created };
  } catch (e) {
    if (e instanceof PostgresError && e.code === "23505") {
      return { ok: false, code: "correction_create_conflict", status: 409 };
    }
    throw e;
  }
}

export type SaveCorrectionBody = {
  polishedSentence?: string | null;
  modelAnswer?: string | null;
  teacherComment?: string | null;
};

export type ServiceError =
  | { ok: false; status: number; code: string };

export async function saveCorrectionDraft(
  db: Db,
  teacherId: string,
  submissionId: string,
  body: SaveCorrectionBody
): Promise<{ ok: true; correctionId: string } | ServiceError> {
  const row = await repo.getSubmissionFullForTeacher(db, submissionId);
  if (!row) return { ok: false, status: 404, code: "not_found" };

  const el = assertEditableSubmission(row.submission.status);
  if (!el.ok) return { ok: false, status: 409, code: el.code };

  for (const v of [body.polishedSentence, body.modelAnswer, body.teacherComment]) {
    if (typeof v === "string" && v.length > MAX_CORRECTION_FIELD_CHARS) {
      return { ok: false, status: 400, code: "field_too_long" };
    }
  }

  const ensured = await ensureCorrectionDraftForTeacher(db, teacherId, submissionId, row.submission.status);
  if (!ensured.ok) return { ok: false, status: ensured.status, code: ensured.code };

  const patch: {
    polishedSentence?: string | null;
    modelAnswer?: string | null;
    teacherComment?: string | null;
  } = {};
  if ("polishedSentence" in body) patch.polishedSentence = body.polishedSentence ?? null;
  if ("modelAnswer" in body) patch.modelAnswer = body.modelAnswer ?? null;
  if ("teacherComment" in body) patch.teacherComment = body.teacherComment ?? null;

  if (Object.keys(patch).length === 0) {
    return { ok: true, correctionId: ensured.correction.id };
  }

  const updated = await repo.updateCorrectionDraft(db, ensured.correction.id, teacherId, patch);
  if (!updated) {
    return { ok: false, status: 409, code: "correction_update_failed" };
  }
  await maybeSetInReview(db, submissionId, row.submission.status);

  console.info(
    JSON.stringify({
      audit: "writing_teacher_correction_saved",
      teacherUserId: teacherId,
      submissionId,
      correctionId: ensured.correction.id,
    })
  );

  return { ok: true, correctionId: updated.id };
}

export type FragmentInput = {
  originalText: string;
  correctedText: string;
  category: string;
  orderIndex: number;
  startOffset?: number | null;
  endOffset?: number | null;
};

export async function replaceSubmissionFragments(
  db: Db,
  teacherId: string,
  submissionId: string,
  fragments: FragmentInput[]
): Promise<{ ok: true; correctionId: string; fragmentCount: number } | ServiceError> {
  if (fragments.length > MAX_FRAGMENTS) {
    return { ok: false, status: 400, code: "too_many_fragments" };
  }

  const row = await repo.getSubmissionFullForTeacher(db, submissionId);
  if (!row) return { ok: false, status: 404, code: "not_found" };

  const ensured = await ensureCorrectionDraftForTeacher(db, teacherId, submissionId, row.submission.status);
  if (!ensured.ok) return { ok: false, status: ensured.status, code: ensured.code };

  const orderIndices = new Set<number>();
  for (const f of fragments) {
    if (typeof f.originalText !== "string" || typeof f.correctedText !== "string") {
      return { ok: false, status: 400, code: "invalid_fragment" };
    }
    if (f.originalText.length > MAX_FRAGMENT_FIELD_CHARS || f.correctedText.length > MAX_FRAGMENT_FIELD_CHARS) {
      return { ok: false, status: 400, code: "fragment_field_too_long" };
    }
    if (!isErrorCategory(f.category)) {
      return { ok: false, status: 400, code: "invalid_fragment_category" };
    }
    if (!Number.isInteger(f.orderIndex) || f.orderIndex < 0) {
      return { ok: false, status: 400, code: "invalid_fragment_order" };
    }
    if (orderIndices.has(f.orderIndex)) {
      return { ok: false, status: 400, code: "duplicate_fragment_order" };
    }
    orderIndices.add(f.orderIndex);
    const so = f.startOffset;
    const eo = f.endOffset;
    if (so !== undefined && so !== null && (!Number.isInteger(so) || so < 0)) {
      return { ok: false, status: 400, code: "invalid_offset" };
    }
    if (eo !== undefined && eo !== null && (!Number.isInteger(eo) || eo < 0)) {
      return { ok: false, status: 400, code: "invalid_offset" };
    }
    if (
      so != null &&
      eo != null &&
      eo < so
    ) {
      return { ok: false, status: 400, code: "invalid_offset_range" };
    }
  }

  await db.transaction(async (tx) => {
    await repo.deleteFragmentsForCorrection(tx, ensured.correction.id);
    if (fragments.length > 0) {
      await repo.insertFragmentsBatch(
        tx,
        fragments.map((f) => ({
          correctionId: ensured.correction.id,
          orderIndex: f.orderIndex,
          originalText: f.originalText,
          correctedText: f.correctedText,
          category: f.category as ErrorCategory,
          startOffset: f.startOffset ?? null,
          endOffset: f.endOffset ?? null,
        }))
      );
    }
    await maybeSetInReview(tx, submissionId, row.submission.status);
  });

  console.info(
    JSON.stringify({
      audit: "writing_teacher_fragments_replaced",
      teacherUserId: teacherId,
      submissionId,
      correctionId: ensured.correction.id,
      fragmentCount: fragments.length,
    })
  );

  return { ok: true, correctionId: ensured.correction.id, fragmentCount: fragments.length };
}

export type EvaluationInput = {
  grammarScore?: number | null;
  vocabularyScore?: number | null;
  contextScore?: number | null;
};

export async function saveEvaluationDraft(
  db: Db,
  teacherId: string,
  submissionId: string,
  input: EvaluationInput
): Promise<{ ok: true } | ServiceError> {
  const row = await repo.getSubmissionFullForTeacher(db, submissionId);
  if (!row) return { ok: false, status: 404, code: "not_found" };

  const el = assertEditableSubmission(row.submission.status);
  if (!el.ok) return { ok: false, status: 409, code: el.code };

  const ensured = await ensureCorrectionDraftForTeacher(db, teacherId, submissionId, row.submission.status);
  if (!ensured.ok) return { ok: false, status: ensured.status, code: ensured.code };

  const patch: {
    grammarAccuracy?: number | null;
    vocabularyUsage?: number | null;
    contextualFluency?: number | null;
  } = {};

  if ("grammarScore" in input) {
    const v = input.grammarScore;
    if (v !== null && v !== undefined && !isValidScore(v)) {
      return { ok: false, status: 400, code: "invalid_score" };
    }
    patch.grammarAccuracy = v ?? null;
  }
  if ("vocabularyScore" in input) {
    const v = input.vocabularyScore;
    if (v !== null && v !== undefined && !isValidScore(v)) {
      return { ok: false, status: 400, code: "invalid_score" };
    }
    patch.vocabularyUsage = v ?? null;
  }
  if ("contextScore" in input) {
    const v = input.contextScore;
    if (v !== null && v !== undefined && !isValidScore(v)) {
      return { ok: false, status: 400, code: "invalid_score" };
    }
    patch.contextualFluency = v ?? null;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  await repo.mergeEvaluationScores(db, submissionId, patch);
  await maybeSetInReview(db, submissionId, row.submission.status);

  console.info(
    JSON.stringify({
      audit: "writing_teacher_evaluation_saved",
      teacherUserId: teacherId,
      submissionId,
    })
  );

  return { ok: true };
}

export async function publishTeacherCorrection(
  db: Db,
  teacherId: string,
  submissionId: string
): Promise<{ ok: true; correctionId: string; publishedAt: string } | ServiceError> {
  const row = await repo.getSubmissionFullForTeacher(db, submissionId);
  if (!row) return { ok: false, status: 404, code: "not_found" };

  const el = assertEditableSubmission(row.submission.status);
  if (!el.ok) return { ok: false, status: 409, code: el.code };

  const correction = await repo.getCorrectionBySubmissionId(db, submissionId);
  if (!correction || correction.teacherId !== teacherId) {
    return { ok: false, status: 403, code: "forbidden_or_missing_correction" };
  }
  if (correction.status !== "draft") {
    return { ok: false, status: 409, code: "correction_already_published" };
  }

  if (
    !nonEmptyTrimmed(correction.polishedSentence) ||
    !nonEmptyTrimmed(correction.modelAnswer) ||
    !nonEmptyTrimmed(correction.teacherComment)
  ) {
    return { ok: false, status: 422, code: "publish_incomplete_correction_text" };
  }

  const evaluation = await repo.getEvaluationBySubmission(db, submissionId);
  if (
    !evaluation ||
    evaluation.grammarAccuracy == null ||
    evaluation.vocabularyUsage == null ||
    evaluation.contextualFluency == null
  ) {
    return { ok: false, status: 422, code: "publish_incomplete_evaluation" };
  }
  if (
    !isValidScore(evaluation.grammarAccuracy) ||
    !isValidScore(evaluation.vocabularyUsage) ||
    !isValidScore(evaluation.contextualFluency)
  ) {
    return { ok: false, status: 422, code: "publish_invalid_evaluation" };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const pub = await repo.publishCorrectionRow(tx, correction.id, teacherId);
      if (!pub) {
        throw Object.assign(new Error("publish_row_missing"), { code: "PUBLISH_FAILED" });
      }
      return pub;
    });
    console.info(
      JSON.stringify({
        audit: "writing_teacher_correction_published",
        teacherUserId: teacherId,
        submissionId,
        correctionId: correction.id,
      })
    );
    return {
      ok: true,
      correctionId: result.id,
      publishedAt: result.publishedAt!.toISOString(),
    };
  } catch (e) {
    if (e instanceof PostgresError) {
      const msg = e.message ?? "";
      if (msg.includes("Cannot publish correction without all evaluation scores")) {
        return { ok: false, status: 422, code: "publish_incomplete_evaluation" };
      }
    }
    throw e;
  }
}
