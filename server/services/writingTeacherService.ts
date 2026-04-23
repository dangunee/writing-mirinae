/**
 * Teacher correction flow — abuse mitigations:
 * 1) IDOR / cross-tenant access: every mutation loads submission by id and enforces correction.teacher_id = session teacher (never trust body alone).
 * 2) Student routes vs teacher routes: teacher APIs require TEACHER_USER_IDS (or TEACHER_ALLOW_ALL in dev); students never receive teacher URLs in v1 UI.
 * 3) Fragment / text flooding: caps on fragment count and per-field length; reject oversized payloads before DB.
 * 4) Double-publish / race: single UPDATE ... WHERE status = 'draft' + DB triggers; concurrent publishes surface as failed update.
 * 5) Audit / future assignment: log teacherUserId + submissionId on mutations (structured console in v1); course-level teacher_id can restrict queue later.
 *
 * Structured correction data: writing.corrections (rich_document_json, improved_text) plus correction_feedback_items,
 * correction_annotations, correction_evaluations. Legacy writing.fragments + writing.evaluations remain for current UI;
 * fragments replace dual-writes feedback_items; evaluation save dual-writes correction_evaluations (publish trigger still reads writing.evaluations).
 */

import { PostgresError } from "postgres";

import type { Db } from "../db/client";
import * as repo from "../repositories/writingTeacherRepository";
import { ADMIN_SANDBOX_SUBMISSION_MODE, backfillSubmittedAdminSandboxMirrors } from "./adminSandboxService";
import { getSignedImageUrl } from "./writingStudentService";

const EDITABLE_SUBMISSION_STATUSES = ["submitted", "in_review"] as const;

const MAX_FRAGMENTS = 500;
const MAX_FEEDBACK_ITEMS = 500;
const MAX_ANNOTATIONS = 500;
const MAX_FRAGMENT_FIELD_CHARS = 12_000;
const MAX_CORRECTION_FIELD_CHARS = 100_000;
const MAX_RICH_JSON_CHARS = 500_000;
const MAX_FEEDBACK_CATEGORY_CHARS = 80;
const MAX_SUBCATEGORY_CHARS = 120;

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

/** Structured rich text (ProseMirror-like JSON): non-empty object/array; excludes `{}` and `[]`. */
export function isNonEmptyRichJson(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v !== "object") return false;
  try {
    const s = JSON.stringify(v);
    return s.length > 2;
  } catch {
    return false;
  }
}

function validateRichDocumentJson(
  v: unknown
): { ok: true; value: unknown } | { ok: false; code: string } {
  if (v === undefined) return { ok: true, value: undefined };
  if (v === null) return { ok: true, value: null };
  if (typeof v !== "object") return { ok: false, code: "invalid_rich_document_json" };
  try {
    const s = JSON.stringify(v);
    if (s.length > MAX_RICH_JSON_CHARS) return { ok: false, code: "rich_document_too_large" };
    return { ok: true, value: JSON.parse(s) as unknown };
  } catch {
    return { ok: false, code: "invalid_rich_document_json" };
  }
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
  /** Admin Sandbox QA mirror (writing.submissions.submission_mode = admin_sandbox). */
  isSandbox: boolean;
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
  try {
    await backfillSubmittedAdminSandboxMirrors(db);
  } catch (e) {
    console.warn("teacher_queue_sandbox_backfill_skipped", { err: e });
  }
  const rows = await repo.listSubmissionQueue(db);
  const items: QueueItem[] = rows.map((r) => ({
    submissionId: r.submission.id,
    studentUserId: r.submission.userId ?? r.submission.regularAccessGrantId ?? "",
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
    isSandbox: r.submission.submissionMode === ADMIN_SANDBOX_SUBMISSION_MODE,
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
    /** Logged-in student; null for mail-link regular access. */
    userId: string | null;
    regularAccessGrantId: string | null;
    status: string;
    bodyText: string | null;
    imageMimeType: string | null;
    imageUrl: string | null;
    /** Server-side grammar pattern check at student submit; null if not run (legacy). */
    grammarCheckResult: unknown | null;
    submittedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  session: {
    id: string;
    index: number;
    status: string;
    runtimeStatus: string | null;
    unlockAt: string;
  };
  course: { id: string; status: string; sessionCount: number };
  correction: null | {
    id: string;
    teacherId: string;
    status: string;
    polishedSentence: string | null;
    modelAnswer: string | null;
    teacherComment: string | null;
    richDocumentJson: unknown | null;
    improvedText: string | null;
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
  feedbackItems: Array<{
    id: string;
    sortOrder: number;
    category: string;
    subcategory: string | null;
    originalText: string;
    correctedText: string;
    explanation: string | null;
  }>;
  annotations: Array<{
    id: string;
    sortOrder: number;
    targetType: string;
    anchorText: string | null;
    startOffset: number | null;
    endOffset: number | null;
    commentText: string;
  }>;
  evaluation: null | {
    grammarAccuracy: number | null;
    vocabularyUsage: number | null;
    contextualFluency: number | null;
  };
  correctionEvaluation: null | {
    grammar: number | null;
    vocabulary: number | null;
    flow: number | null;
    coherence: number | null;
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
  const feedbackItems = correction
    ? await repo.listFeedbackItemsForCorrection(db, correction.id)
    : [];
  const annotations = correction
    ? await repo.listAnnotationsForCorrection(db, correction.id)
    : [];
  const evaluation = await repo.getEvaluationBySubmission(db, submissionId);
  const correctionEvaluation = correction
    ? await repo.getCorrectionEvaluationByCorrectionId(db, correction.id)
    : null;

  return {
    submission: {
      id: row.submission.id,
      userId: row.submission.userId,
      regularAccessGrantId: row.submission.regularAccessGrantId ?? null,
      status: row.submission.status,
      bodyText: row.submission.bodyText,
      imageMimeType: row.submission.imageMimeType,
      imageUrl,
      grammarCheckResult: row.submission.grammarCheckResult ?? null,
      submittedAt: row.submission.submittedAt?.toISOString() ?? null,
      createdAt: row.submission.createdAt.toISOString(),
      updatedAt: row.submission.updatedAt.toISOString(),
    },
    session: {
      id: row.session.id,
      index: row.session.index,
      status: row.session.status,
      runtimeStatus: row.session.runtimeStatus ?? null,
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
          richDocumentJson: correction.richDocumentJson ?? null,
          improvedText: correction.improvedText,
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
    feedbackItems: feedbackItems.map((f) => ({
      id: f.id,
      sortOrder: f.sortOrder,
      category: f.category,
      subcategory: f.subcategory,
      originalText: f.originalText,
      correctedText: f.correctedText,
      explanation: f.explanation,
    })),
    annotations: annotations.map((a) => ({
      id: a.id,
      sortOrder: a.sortOrder,
      targetType: a.targetType,
      anchorText: a.anchorText,
      startOffset: a.startOffset,
      endOffset: a.endOffset,
      commentText: a.commentText,
    })),
    evaluation: evaluation
      ? {
          grammarAccuracy: evaluation.grammarAccuracy,
          vocabularyUsage: evaluation.vocabularyUsage,
          contextualFluency: evaluation.contextualFluency,
        }
      : null,
    correctionEvaluation: correctionEvaluation
      ? {
          grammar: correctionEvaluation.grammar,
          vocabulary: correctionEvaluation.vocabulary,
          flow: correctionEvaluation.flow,
          coherence: correctionEvaluation.coherence,
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
      richDocumentJson: null,
      improvedText: null,
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
  richDocumentJson?: unknown;
  improvedText?: string | null;
};

export type ServiceError = { ok: false; status: number; code: string };

export async function saveCorrectionDraft(
  db: Db,
  teacherId: string,
  submissionId: string,
  body: SaveCorrectionBody
): Promise<{ ok: true; correctionId: string; status: string } | ServiceError> {
  const row = await repo.getSubmissionFullForTeacher(db, submissionId);
  if (!row) return { ok: false, status: 404, code: "not_found" };

  const el = assertEditableSubmission(row.submission.status);
  if (!el.ok) return { ok: false, status: 409, code: el.code };

  for (const v of [body.polishedSentence, body.modelAnswer, body.teacherComment, body.improvedText]) {
    if (typeof v === "string" && v.length > MAX_CORRECTION_FIELD_CHARS) {
      return { ok: false, status: 400, code: "field_too_long" };
    }
  }

  const ensured = await ensureCorrectionDraftForTeacher(db, teacherId, submissionId, row.submission.status);
  if (!ensured.ok) return { ok: false, status: ensured.status, code: ensured.code };

  const patch: Partial<{
    polishedSentence: string | null;
    modelAnswer: string | null;
    teacherComment: string | null;
    richDocumentJson: unknown;
    improvedText: string | null;
  }> = {};

  if ("polishedSentence" in body) patch.polishedSentence = body.polishedSentence ?? null;
  if ("modelAnswer" in body) patch.modelAnswer = body.modelAnswer ?? null;
  if ("teacherComment" in body) patch.teacherComment = body.teacherComment ?? null;
  if ("improvedText" in body) patch.improvedText = body.improvedText ?? null;
  if ("richDocumentJson" in body) {
    const vr = validateRichDocumentJson(body.richDocumentJson);
    if (!vr.ok) return { ok: false, status: 400, code: vr.code };
    patch.richDocumentJson = vr.value;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: true, correctionId: ensured.correction.id, status: ensured.correction.status };
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

  return { ok: true, correctionId: updated.id, status: updated.status };
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
    if (so != null && eo != null && eo < so) {
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
    await repo.deleteFeedbackItemsForCorrection(tx, ensured.correction.id);
    if (fragments.length > 0) {
      await repo.insertFeedbackItemsBatch(
        tx,
        fragments.map((f) => ({
          correctionId: ensured.correction.id,
          sortOrder: f.orderIndex,
          category: f.category,
          subcategory: null,
          originalText: f.originalText,
          correctedText: f.correctedText,
          explanation: null,
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

export type FeedbackItemInput = {
  category: string;
  subcategory?: string | null;
  originalText: string;
  correctedText: string;
  explanation?: string | null;
  sortOrder: number;
};

/** Replaces writing.correction_feedback_items only (does not touch writing.fragments). Use fragments endpoint to sync legacy fragments + feedback together. */
export async function replaceSubmissionFeedbackItems(
  db: Db,
  teacherId: string,
  submissionId: string,
  items: FeedbackItemInput[]
): Promise<{ ok: true; correctionId: string; count: number } | ServiceError> {
  if (items.length > MAX_FEEDBACK_ITEMS) {
    return { ok: false, status: 400, code: "too_many_feedback_items" };
  }

  const row = await repo.getSubmissionFullForTeacher(db, submissionId);
  if (!row) return { ok: false, status: 404, code: "not_found" };

  const ensured = await ensureCorrectionDraftForTeacher(db, teacherId, submissionId, row.submission.status);
  if (!ensured.ok) return { ok: false, status: ensured.status, code: ensured.code };

  const sortOrders = new Set<number>();
  for (const it of items) {
    if (typeof it.originalText !== "string" || typeof it.correctedText !== "string") {
      return { ok: false, status: 400, code: "invalid_feedback_item" };
    }
    if (
      it.originalText.length > MAX_FRAGMENT_FIELD_CHARS ||
      it.correctedText.length > MAX_FRAGMENT_FIELD_CHARS
    ) {
      return { ok: false, status: 400, code: "feedback_field_too_long" };
    }
    const cat = typeof it.category === "string" ? it.category.trim() : "";
    if (!cat || cat.length > MAX_FEEDBACK_CATEGORY_CHARS) {
      return { ok: false, status: 400, code: "invalid_feedback_category" };
    }
    if (!isErrorCategory(cat)) {
      return { ok: false, status: 400, code: "invalid_feedback_category" };
    }
    const sub = it.subcategory;
    if (sub != null && typeof sub === "string" && sub.length > MAX_SUBCATEGORY_CHARS) {
      return { ok: false, status: 400, code: "invalid_feedback_subcategory" };
    }
    const expl = it.explanation;
    if (expl != null && typeof expl === "string" && expl.length > MAX_CORRECTION_FIELD_CHARS) {
      return { ok: false, status: 400, code: "feedback_field_too_long" };
    }
    if (!Number.isInteger(it.sortOrder) || it.sortOrder < 0) {
      return { ok: false, status: 400, code: "invalid_feedback_sort_order" };
    }
    if (sortOrders.has(it.sortOrder)) {
      return { ok: false, status: 400, code: "duplicate_feedback_sort_order" };
    }
    sortOrders.add(it.sortOrder);
  }

  await db.transaction(async (tx) => {
    await repo.deleteFeedbackItemsForCorrection(tx, ensured.correction.id);
    if (items.length > 0) {
      await repo.insertFeedbackItemsBatch(
        tx,
        items.map((it) => ({
          correctionId: ensured.correction.id,
          sortOrder: it.sortOrder,
          category: it.category.trim(),
          subcategory: it.subcategory != null && String(it.subcategory).trim() !== "" ? it.subcategory : null,
          originalText: it.originalText,
          correctedText: it.correctedText,
          explanation: it.explanation != null && String(it.explanation).trim() !== "" ? it.explanation : null,
        }))
      );
    }
    await maybeSetInReview(tx, submissionId, row.submission.status);
  });

  console.info(
    JSON.stringify({
      audit: "writing_teacher_feedback_items_replaced",
      teacherUserId: teacherId,
      submissionId,
      correctionId: ensured.correction.id,
      count: items.length,
    })
  );

  return { ok: true, correctionId: ensured.correction.id, count: items.length };
}

const ANNOTATION_TARGETS = ["original", "corrected", "improved"] as const;

export type AnnotationInput = {
  targetType: (typeof ANNOTATION_TARGETS)[number];
  anchorText?: string | null;
  startOffset?: number | null;
  endOffset?: number | null;
  commentText: string;
  sortOrder: number;
};

function isAnnotationTarget(s: string): s is AnnotationInput["targetType"] {
  return (ANNOTATION_TARGETS as readonly string[]).includes(s);
}

export async function replaceSubmissionAnnotations(
  db: Db,
  teacherId: string,
  submissionId: string,
  annotations: AnnotationInput[]
): Promise<{ ok: true; correctionId: string; count: number } | ServiceError> {
  if (annotations.length > MAX_ANNOTATIONS) {
    return { ok: false, status: 400, code: "too_many_annotations" };
  }

  const row = await repo.getSubmissionFullForTeacher(db, submissionId);
  if (!row) return { ok: false, status: 404, code: "not_found" };

  const ensured = await ensureCorrectionDraftForTeacher(db, teacherId, submissionId, row.submission.status);
  if (!ensured.ok) return { ok: false, status: ensured.status, code: ensured.code };

  const sortOrders = new Set<number>();
  for (const a of annotations) {
    if (typeof a.commentText !== "string" || !a.commentText.trim()) {
      return { ok: false, status: 400, code: "invalid_annotation" };
    }
    if (a.commentText.length > MAX_FRAGMENT_FIELD_CHARS) {
      return { ok: false, status: 400, code: "annotation_comment_too_long" };
    }
    if (!isAnnotationTarget(a.targetType)) {
      return { ok: false, status: 400, code: "invalid_annotation_target" };
    }
    const at = a.anchorText;
    if (at != null && typeof at === "string" && at.length > MAX_CORRECTION_FIELD_CHARS) {
      return { ok: false, status: 400, code: "annotation_field_too_long" };
    }
    const so = a.startOffset;
    const eo = a.endOffset;
    if (so !== undefined && so !== null && (!Number.isInteger(so) || so < 0)) {
      return { ok: false, status: 400, code: "invalid_offset" };
    }
    if (eo !== undefined && eo !== null && (!Number.isInteger(eo) || eo < 0)) {
      return { ok: false, status: 400, code: "invalid_offset" };
    }
    if (so != null && eo != null && eo < so) {
      return { ok: false, status: 400, code: "invalid_offset_range" };
    }
    if (!Number.isInteger(a.sortOrder) || a.sortOrder < 0) {
      return { ok: false, status: 400, code: "invalid_annotation_sort_order" };
    }
    if (sortOrders.has(a.sortOrder)) {
      return { ok: false, status: 400, code: "duplicate_annotation_sort_order" };
    }
    sortOrders.add(a.sortOrder);
  }

  await db.transaction(async (tx) => {
    await repo.deleteAnnotationsForCorrection(tx, ensured.correction.id);
    if (annotations.length > 0) {
      await repo.insertAnnotationsBatch(
        tx,
        annotations.map((a) => ({
          correctionId: ensured.correction.id,
          sortOrder: a.sortOrder,
          targetType: a.targetType,
          anchorText: a.anchorText != null && String(a.anchorText).trim() !== "" ? a.anchorText : null,
          startOffset: a.startOffset ?? null,
          endOffset: a.endOffset ?? null,
          commentText: a.commentText,
        }))
      );
    }
    await maybeSetInReview(tx, submissionId, row.submission.status);
  });

  console.info(
    JSON.stringify({
      audit: "writing_teacher_annotations_replaced",
      teacherUserId: teacherId,
      submissionId,
      correctionId: ensured.correction.id,
      count: annotations.length,
    })
  );

  return { ok: true, correctionId: ensured.correction.id, count: annotations.length };
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
  await repo.upsertCorrectionEvaluationFromSubmissionScores(db, ensured.correction.id, submissionId);
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

export type PublishTeacherCorrectionResult =
  | {
      ok: true;
      correctionId: string;
      publishedAt: string;
      session: { id: string; status: string; runtimeStatus: string | null };
    }
  | ServiceError;

export async function publishTeacherCorrection(
  db: Db,
  teacherId: string,
  submissionId: string
): Promise<PublishTeacherCorrectionResult> {
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

  const hasRich = isNonEmptyRichJson(correction.richDocumentJson);
  const hasLegacyText = nonEmptyTrimmed(correction.polishedSentence);
  if (!hasRich && !hasLegacyText) {
    return { ok: false, status: 422, code: "publish_incomplete_correction_text" };
  }
  if (hasRich && !nonEmptyTrimmed(correction.improvedText)) {
    return { ok: false, status: 422, code: "publish_incomplete_improved_text" };
  }
  if (!nonEmptyTrimmed(correction.modelAnswer) || !nonEmptyTrimmed(correction.teacherComment)) {
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

  await repo.upsertCorrectionEvaluationFromSubmissionScores(db, correction.id, submissionId);

  try {
    const result = await db.transaction(async (tx) => {
      const pub = await repo.publishCorrectionRow(tx, correction.id, teacherId);
      if (!pub) {
        throw Object.assign(new Error("publish_row_missing"), { code: "PUBLISH_FAILED" });
      }
      return pub;
    });
    const after = await repo.getSubmissionFullForTeacher(db, submissionId);
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
      session: {
        id: after?.session.id ?? row.session.id,
        status: after?.session.status ?? row.session.status,
        runtimeStatus: after?.session.runtimeStatus ?? null,
      },
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
