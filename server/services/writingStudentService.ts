/**
 * Student submission — abuse mitigations implemented here:
 * 1) IDOR: every query joins/ filters by `auth.users` id from the verified session (never from body).
 * 2) Parallel active drafts: DB partial unique index `writing_submissions_one_active_pipeline_per_user` + 23505 handling.
 * 3) Upload abuse: allowlisted MIME + max bytes; objects stored under server-generated keys in Supabase Storage (not web root).
 * Rate limiting / WAF: configure at the edge; optional per-user caps can wrap these handlers later.
 */

import { PostgresError } from "postgres";

import type { Db } from "../db/client";
import { validateImageUpload, buildStorageObjectKey } from "../lib/writingUploads";
import { getServiceRoleClient } from "../lib/supabaseServiceRole";
import * as repo from "../repositories/writingStudentRepository";

const BUCKET = process.env.WRITING_UPLOADS_BUCKET ?? "writing-submissions";

/** Security: cap text length to mitigate abuse (configurable). */
const MAX_BODY_TEXT_CHARS = (() => {
  const raw = process.env.WRITING_MAX_BODY_TEXT_CHARS;
  if (!raw) return 50_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 50_000;
})();

export type CurrentSessionResponse =
  | {
      ok: true;
      accessKind: "student";
      courseId: string;
      mode: "pipeline" | "fresh" | "all_done";
      session: {
        id: string;
        courseId: string;
        index: number;
        unlockAt: string;
        status: string;
      } | null;
      submission: {
        id: string;
        status: string;
        bodyText: string | null;
        imageStorageKey: string | null;
        imageMimeType: string | null;
        submittedAt: string | null;
      } | null;
      /** Whether POST /submission may create/update draft or submit (business rules). */
      canSubmit: boolean;
      reasonIfNot?: string;
    }
  | {
      ok: true;
      accessKind: "regular";
      grantId: string;
      courseId: string;
      accessExpiresAt: string | null;
      /** Active pipeline submission id (draft..corrected), if any. */
      pendingSubmissionId: string | null;
      /** Set by GET /api/writing/sessions/current when grant auto-advanced to the next course. */
      advancedToNextCourse?: boolean;
      previousCourseId?: string | null;
      mode: "pipeline" | "fresh" | "all_done";
      session: {
        id: string;
        courseId: string;
        index: number;
        unlockAt: string;
        status: string;
      } | null;
      submission: {
        id: string;
        status: string;
        bodyText: string | null;
        imageStorageKey: string | null;
        imageMimeType: string | null;
        submittedAt: string | null;
      } | null;
      canSubmit: boolean;
      reasonIfNot?: string;
    }
  | {
      ok: true;
      accessKind: "trial";
      applicationId: string;
      courseId: string;
      accessExpiresAt: string | null;
      pendingSubmissionId: string | null;
      mode: "pipeline" | "fresh" | "all_done";
      session: {
        id: string;
        courseId: string;
        index: number;
        unlockAt: string;
        status: string;
      } | null;
      submission: {
        id: string;
        status: string;
        bodyText: string | null;
        imageStorageKey: string | null;
        imageMimeType: string | null;
        submittedAt: string | null;
      } | null;
      canSubmit: boolean;
      reasonIfNot?: string;
    }
  | { ok: false; error: "no_active_course" };

/**
 * Current session = active pipeline session, else first incomplete session (linear order).
 * Security: userId from verified session only.
 */
export async function getCurrentSessionForStudent(
  db: Db,
  userId: string
): Promise<CurrentSessionResponse> {
  const course = await repo.findActiveWritingCourseForUser(db, userId);
  if (!course) {
    return { ok: false, error: "no_active_course" };
  }

  await repo.lazyUnlockDueSessions(db, course.id);
  const sessions = await repo.listSessionsForCourseOrdered(db, course.id);

  const pipeline = await repo.findActivePipelineSubmissionForUser(db, userId);
  if (pipeline) {
    return {
      ok: true,
      accessKind: "student",
      courseId: course.id,
      mode: "pipeline",
      session: {
        id: pipeline.session.id,
        courseId: pipeline.session.courseId,
        index: pipeline.session.index,
        unlockAt: pipeline.session.unlockAt.toISOString(),
        status: pipeline.session.status,
      },
      submission: {
        id: pipeline.submission.id,
        status: pipeline.submission.status,
        bodyText: pipeline.submission.bodyText,
        imageStorageKey: pipeline.submission.imageStorageKey,
        imageMimeType: pipeline.submission.imageMimeType,
        submittedAt: pipeline.submission.submittedAt?.toISOString() ?? null,
      },
      canSubmit: pipeline.submission.status === "draft",
      reasonIfNot:
        pipeline.submission.status === "draft"
          ? undefined
          : "pipeline_in_review_wait_for_result",
    };
  }

  const now = new Date();
  for (const s of sessions) {
    if (s.status === "completed") continue;

    const lower = sessions.filter((x) => x.index < s.index);
    const prevAllCompleted = lower.every((x) => x.status === "completed");
    if (!prevAllCompleted) {
      const blocker = lower.find((x) => x.status !== "completed");
      if (blocker) {
        return {
          ok: true,
          accessKind: "student",
          courseId: course.id,
          mode: "fresh",
          session: {
            id: blocker.id,
            courseId: blocker.courseId,
            index: blocker.index,
            unlockAt: blocker.unlockAt.toISOString(),
            status: blocker.status,
          },
          submission: null,
          canSubmit: false,
          reasonIfNot: "complete_previous_sessions_first",
        };
      }
    }

    const timeOk = s.unlockAt <= now;
    if (!timeOk) {
      return {
        ok: true,
        accessKind: "student",
        courseId: course.id,
        mode: "fresh",
        session: {
          id: s.id,
          courseId: s.courseId,
          index: s.index,
          unlockAt: s.unlockAt.toISOString(),
          status: s.status,
        },
        submission: null,
        canSubmit: false,
        reasonIfNot: "session_not_unlocked_yet",
      };
    }

    return {
      ok: true,
      accessKind: "student",
      courseId: course.id,
      mode: "fresh",
      session: {
        id: s.id,
        courseId: s.courseId,
        index: s.index,
        unlockAt: s.unlockAt.toISOString(),
        status: s.status,
      },
      submission: null,
      canSubmit: true,
    };
  }

  return {
    ok: true,
    accessKind: "student",
    courseId: course.id,
    mode: "all_done",
    session: null,
    submission: null,
    canSubmit: false,
    reasonIfNot: "all_sessions_completed",
  };
}

/**
 * Mail-link regular access: same session progression as student, keyed by regular_access_grant_id.
 * Security: grantId must come from verified cookie; caller validates cookie before calling.
 */
export async function getCurrentSessionForRegularGrant(db: Db, grantId: string): Promise<CurrentSessionResponse> {
  const row = await repo.getRegularGrantWithCourse(db, grantId);
  if (!row) {
    return { ok: false, error: "no_active_course" };
  }
  const { grant, course } = row;
  if (!grant.accessEnabled) {
    return { ok: false, error: "no_active_course" };
  }
  const now = new Date();
  if (grant.accessExpiresAt != null && grant.accessExpiresAt <= now) {
    return { ok: false, error: "no_active_course" };
  }
  if (!grant.courseId) {
    return { ok: false, error: "no_active_course" };
  }
  if (course.status !== "active") {
    return { ok: false, error: "no_active_course" };
  }

  await repo.lazyUnlockDueSessions(db, course.id);
  const sessions = await repo.listSessionsForCourseOrdered(db, course.id);

  const pipeline = await repo.findActivePipelineSubmissionForGrant(db, grantId);
  if (pipeline) {
    return {
      ok: true,
      accessKind: "regular",
      grantId,
      courseId: course.id,
      accessExpiresAt: grant.accessExpiresAt?.toISOString() ?? null,
      pendingSubmissionId: pipeline.submission.id,
      mode: "pipeline",
      session: {
        id: pipeline.session.id,
        courseId: pipeline.session.courseId,
        index: pipeline.session.index,
        unlockAt: pipeline.session.unlockAt.toISOString(),
        status: pipeline.session.status,
      },
      submission: {
        id: pipeline.submission.id,
        status: pipeline.submission.status,
        bodyText: pipeline.submission.bodyText,
        imageStorageKey: pipeline.submission.imageStorageKey,
        imageMimeType: pipeline.submission.imageMimeType,
        submittedAt: pipeline.submission.submittedAt?.toISOString() ?? null,
      },
      canSubmit: pipeline.submission.status === "draft",
      reasonIfNot:
        pipeline.submission.status === "draft"
          ? undefined
          : "pipeline_in_review_wait_for_result",
    };
  }

  for (const s of sessions) {
    if (s.status === "completed") continue;

    const lower = sessions.filter((x) => x.index < s.index);
    const prevAllCompleted = lower.every((x) => x.status === "completed");
    if (!prevAllCompleted) {
      const blocker = lower.find((x) => x.status !== "completed");
      if (blocker) {
        return {
          ok: true,
          accessKind: "regular",
          grantId,
          courseId: course.id,
          accessExpiresAt: grant.accessExpiresAt?.toISOString() ?? null,
          pendingSubmissionId: null,
          mode: "fresh",
          session: {
            id: blocker.id,
            courseId: blocker.courseId,
            index: blocker.index,
            unlockAt: blocker.unlockAt.toISOString(),
            status: blocker.status,
          },
          submission: null,
          canSubmit: false,
          reasonIfNot: "complete_previous_sessions_first",
        };
      }
    }

    const timeOk = s.unlockAt <= now;
    if (!timeOk) {
      return {
        ok: true,
        accessKind: "regular",
        grantId,
        courseId: course.id,
        accessExpiresAt: grant.accessExpiresAt?.toISOString() ?? null,
        pendingSubmissionId: null,
        mode: "fresh",
        session: {
          id: s.id,
          courseId: s.courseId,
          index: s.index,
          unlockAt: s.unlockAt.toISOString(),
          status: s.status,
        },
        submission: null,
        canSubmit: false,
        reasonIfNot: "session_not_unlocked_yet",
      };
    }

    return {
      ok: true,
      accessKind: "regular",
      grantId,
      courseId: course.id,
      accessExpiresAt: grant.accessExpiresAt?.toISOString() ?? null,
      pendingSubmissionId: null,
      mode: "fresh",
      session: {
        id: s.id,
        courseId: s.courseId,
        index: s.index,
        unlockAt: s.unlockAt.toISOString(),
        status: s.status,
      },
      submission: null,
      canSubmit: true,
    };
  }

  return {
    ok: true,
    accessKind: "regular",
    grantId,
    courseId: course.id,
    accessExpiresAt: grant.accessExpiresAt?.toISOString() ?? null,
    pendingSubmissionId: null,
    mode: "all_done",
    session: null,
    submission: null,
    canSubmit: false,
    reasonIfNot: "all_sessions_completed",
  };
}

function getTrialWritingCourseId(): string | null {
  const raw = process.env.WRITING_TRIAL_COURSE_ID?.trim();
  return raw || null;
}

/**
 * 体験: trial_application_id は Cookie 経由の upstream 検証後にのみ渡す。
 * 提出データの source of truth は writing.submissions（trial_application_id）。
 */
export async function getCurrentSessionForTrialApplication(
  db: Db,
  applicationId: string
): Promise<CurrentSessionResponse> {
  const courseId = getTrialWritingCourseId();
  if (!courseId) {
    return { ok: false, error: "no_active_course" };
  }
  const course = await repo.getWritingCourseById(db, courseId);
  if (!course || course.status !== "active") {
    return { ok: false, error: "no_active_course" };
  }

  await repo.lazyUnlockDueSessions(db, course.id);
  const sessions = await repo.listSessionsForCourseOrdered(db, course.id);

  const pipeline = await repo.findActivePipelineSubmissionForTrial(db, applicationId);
  if (pipeline) {
    return {
      ok: true,
      accessKind: "trial",
      applicationId,
      courseId: course.id,
      accessExpiresAt: null,
      pendingSubmissionId: pipeline.submission.id,
      mode: "pipeline",
      session: {
        id: pipeline.session.id,
        courseId: pipeline.session.courseId,
        index: pipeline.session.index,
        unlockAt: pipeline.session.unlockAt.toISOString(),
        status: pipeline.session.status,
      },
      submission: {
        id: pipeline.submission.id,
        status: pipeline.submission.status,
        bodyText: pipeline.submission.bodyText,
        imageStorageKey: pipeline.submission.imageStorageKey,
        imageMimeType: pipeline.submission.imageMimeType,
        submittedAt: pipeline.submission.submittedAt?.toISOString() ?? null,
      },
      canSubmit: pipeline.submission.status === "draft",
      reasonIfNot:
        pipeline.submission.status === "draft"
          ? undefined
          : "pipeline_in_review_wait_for_result",
    };
  }

  const now = new Date();
  for (const s of sessions) {
    if (s.status === "completed") continue;

    const lower = sessions.filter((x) => x.index < s.index);
    const prevAllCompleted = lower.every((x) => x.status === "completed");
    if (!prevAllCompleted) {
      const blocker = lower.find((x) => x.status !== "completed");
      if (blocker) {
        return {
          ok: true,
          accessKind: "trial",
          applicationId,
          courseId: course.id,
          accessExpiresAt: null,
          pendingSubmissionId: null,
          mode: "fresh",
          session: {
            id: blocker.id,
            courseId: blocker.courseId,
            index: blocker.index,
            unlockAt: blocker.unlockAt.toISOString(),
            status: blocker.status,
          },
          submission: null,
          canSubmit: false,
          reasonIfNot: "complete_previous_sessions_first",
        };
      }
    }

    const timeOk = s.unlockAt <= now;
    if (!timeOk) {
      return {
        ok: true,
        accessKind: "trial",
        applicationId,
        courseId: course.id,
        accessExpiresAt: null,
        pendingSubmissionId: null,
        mode: "fresh",
        session: {
          id: s.id,
          courseId: s.courseId,
          index: s.index,
          unlockAt: s.unlockAt.toISOString(),
          status: s.status,
        },
        submission: null,
        canSubmit: false,
        reasonIfNot: "session_not_unlocked_yet",
      };
    }

    return {
      ok: true,
      accessKind: "trial",
      applicationId,
      courseId: course.id,
      accessExpiresAt: null,
      pendingSubmissionId: null,
      mode: "fresh",
      session: {
        id: s.id,
        courseId: s.courseId,
        index: s.index,
        unlockAt: s.unlockAt.toISOString(),
        status: s.status,
      },
      submission: null,
      canSubmit: true,
    };
  }

  return {
    ok: true,
    accessKind: "trial",
    applicationId,
    courseId: course.id,
    accessExpiresAt: null,
    pendingSubmissionId: null,
    mode: "all_done",
    session: null,
    submission: null,
    canSubmit: false,
    reasonIfNot: "all_sessions_completed",
  };
}

function hasSubstantiveContent(bodyText: string | null | undefined, imageKey: string | null | undefined) {
  const t = bodyText?.trim() ?? "";
  if (t.length > 0) return true;
  if (imageKey && imageKey.length > 0) return true;
  return false;
}

export type SaveSubmissionInput = {
  userId: string;
  sessionId: string;
  action: "save" | "submit";
  bodyText: string | null;
  imageBuffer: Buffer | null;
  imageMimeType: string | null;
};

export type SaveSubmissionRegularInput = {
  grantId: string;
  sessionId: string;
  action: "save" | "submit";
  bodyText: string | null;
  imageBuffer: Buffer | null;
  imageMimeType: string | null;
};

export type SaveSubmissionTrialInput = {
  trialApplicationId: string;
  sessionId: string;
  action: "save" | "submit";
  bodyText: string | null;
  imageBuffer: Buffer | null;
  imageMimeType: string | null;
};

export type SaveSubmissionResult =
  | { ok: true; submissionId: string; status: string }
  | {
      ok: false;
      status: number;
      code: string;
    };

/**
 * Security: userId from session; session ownership verified; no client-supplied status beyond action.
 * Abuse: IDOR blocked by join; upload size/MIME enforced; parallel active submission blocked by DB unique index.
 */
function assertBodyTextLength(text: string | null | undefined): SaveSubmissionResult | null {
  if (text == null || text === "") return null;
  if (text.length > MAX_BODY_TEXT_CHARS) {
    return { ok: false, status: 400, code: "body_text_too_long" };
  }
  return null;
}

export async function saveOrSubmitSubmission(
  db: Db,
  input: SaveSubmissionInput
): Promise<SaveSubmissionResult> {
  const lenErr = assertBodyTextLength(input.bodyText);
  if (lenErr) return lenErr;

  const row = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!row || row.course.userId !== input.userId) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  if (row.course.status !== "active") {
    return { ok: false, status: 409, code: "course_not_active" };
  }

  await repo.lazyUnlockDueSessions(db, row.course.id);
  const refreshed = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!refreshed) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  const session = refreshed.session;

  const now = new Date();
  if (session.status === "completed") {
    return { ok: false, status: 409, code: "session_completed" };
  }
  if (session.unlockAt > now) {
    return { ok: false, status: 409, code: "session_locked" };
  }

  const sessions = await repo.listSessionsForCourseOrdered(db, row.course.id);
  const lower = sessions.filter((x) => x.index < session.index);
  if (!lower.every((x) => x.status === "completed")) {
    return { ok: false, status: 409, code: "complete_previous_sessions_first" };
  }

  const pipeline = await repo.findActivePipelineSubmissionForUser(db, input.userId);
  if (pipeline && pipeline.session.id !== input.sessionId) {
    return { ok: false, status: 409, code: "active_submission_on_other_session" };
  }

  let existing = await repo.getSubmissionBySessionId(db, input.sessionId);
  if (!existing && pipeline && pipeline.session.id === input.sessionId) {
    existing = pipeline.submission;
  }

  if (existing && existing.userId !== input.userId) {
    return { ok: false, status: 403, code: "forbidden" };
  }

  if (existing && existing.status !== "draft") {
    return { ok: false, status: 409, code: "submission_not_editable" };
  }

  let imageKey = existing?.imageStorageKey ?? null;
  let imageMime = existing?.imageMimeType ?? null;

  if (input.imageBuffer && input.imageMimeType) {
    const v = validateImageUpload({
      mimeType: input.imageMimeType,
      byteLength: input.imageBuffer.length,
    });
    if (!v.ok) {
      return { ok: false, status: 400, code: v.reason };
    }
  }

  try {
    return await db.transaction(async (tx) => {
    let submissionId = existing?.id;

    if (input.imageBuffer && input.imageMimeType) {
      const v = validateImageUpload({
        mimeType: input.imageMimeType,
        byteLength: input.imageBuffer.length,
      });
      if (!v.ok) {
        return { ok: false, status: 400, code: v.reason };
      }

      if (!submissionId) {
        try {
          const ins = await repo.insertSubmission(tx, {
            sessionId: input.sessionId,
            courseId: row.course.id,
            userId: input.userId,
            status: "draft",
            bodyText: input.bodyText,
            imageStorageKey: null,
            imageMimeType: null,
            submittedAt: null,
          });
          submissionId = ins.id;
        } catch (e) {
          if (e instanceof PostgresError && e.code === "23505") {
            return { ok: false, status: 409, code: "active_submission_conflict" };
          }
          throw e;
        }
      }

      const { storageKey } = buildStorageObjectKey({
        userId: input.userId,
        submissionId: submissionId!,
        mimeType: input.imageMimeType,
      });

      const supabase = getServiceRoleClient();
      const up = await supabase.storage
        .from(BUCKET)
        .upload(storageKey, input.imageBuffer, {
          contentType: input.imageMimeType.split(";")[0]?.trim(),
          upsert: false,
        });
      if (up.error) {
        console.error("storage_upload_failed", up.error.message);
        return { ok: false, status: 500, code: "storage_upload_failed" };
      }

      imageKey = storageKey;
      imageMime = input.imageMimeType.split(";")[0]?.trim() ?? input.imageMimeType;

      const updated = await repo.updateSubmissionDraft(tx, submissionId!, {
        bodyText: input.bodyText,
        imageStorageKey: imageKey,
        imageMimeType: imageMime,
      });
      if (!updated) {
        return { ok: false, status: 409, code: "submission_not_editable" };
      }

      if (input.action === "submit") {
        if (!hasSubstantiveContent(updated.bodyText, updated.imageStorageKey)) {
          return { ok: false, status: 422, code: "empty_submission" };
        }
        const fin = await repo.submitSubmissionFinal(tx, submissionId!, input.userId);
        if (!fin) {
          return { ok: false, status: 409, code: "submit_failed" };
        }
        return { ok: true, submissionId: fin.id, status: fin.status };
      }
      return { ok: true, submissionId: updated.id, status: updated.status };
    }

    if (!submissionId) {
      try {
        const ins = await repo.insertSubmission(tx, {
          sessionId: input.sessionId,
          courseId: row.course.id,
          userId: input.userId,
          status: "draft",
          bodyText: input.bodyText,
          imageStorageKey: imageKey,
          imageMimeType: imageMime,
          submittedAt: null,
        });
        submissionId = ins.id;
      } catch (e) {
        if (e instanceof PostgresError && e.code === "23505") {
          return { ok: false, status: 409, code: "active_submission_conflict" };
        }
        throw e;
      }
    } else {
      const updated = await repo.updateSubmissionDraft(tx, submissionId, {
        bodyText: input.bodyText,
        imageStorageKey: imageKey,
        imageMimeType: imageMime,
      });
      if (!updated) {
        return { ok: false, status: 409, code: "submission_not_editable" };
      }
    }

    const sub = await repo.getSubmissionByIdForUser(tx, submissionId!, input.userId);
    if (!sub) {
      return { ok: false, status: 500, code: "submission_missing" };
    }

    if (input.action === "submit") {
      if (!hasSubstantiveContent(sub.bodyText, sub.imageStorageKey)) {
        return { ok: false, status: 422, code: "empty_submission" };
      }
      const fin = await repo.submitSubmissionFinal(tx, submissionId!, input.userId);
      if (!fin) {
        return { ok: false, status: 409, code: "submit_failed" };
      }
      return { ok: true, submissionId: fin.id, status: fin.status };
    }

    return { ok: true, submissionId: sub.id, status: sub.status };
    });
  } catch (e) {
    if (e instanceof PostgresError && e.code === "23505") {
      return { ok: false, status: 409, code: "active_submission_conflict" };
    }
    throw e;
  }
}

/**
 * Regular mail-link access: grantId from verified cookie only; session/course enforced server-side.
 */
export async function saveOrSubmitSubmissionForRegular(
  db: Db,
  input: SaveSubmissionRegularInput
): Promise<SaveSubmissionResult> {
  const lenErr = assertBodyTextLength(input.bodyText);
  if (lenErr) return lenErr;

  const grantRow = await repo.getRegularGrantWithCourse(db, input.grantId);
  if (!grantRow) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  const { grant, course } = grantRow;
  if (!grant.accessEnabled) {
    return { ok: false, status: 403, code: "access_disabled" };
  }
  const nowCheck = new Date();
  if (grant.accessExpiresAt != null && grant.accessExpiresAt <= nowCheck) {
    return { ok: false, status: 403, code: "access_expired" };
  }
  if (!grant.courseId || course.id !== grant.courseId) {
    return { ok: false, status: 404, code: "session_not_found" };
  }

  const row = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!row || row.course.id !== course.id) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  if (row.course.status !== "active") {
    return { ok: false, status: 409, code: "course_not_active" };
  }

  await repo.lazyUnlockDueSessions(db, row.course.id);
  const refreshed = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!refreshed) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  const session = refreshed.session;

  const now = new Date();
  if (session.status === "completed") {
    return { ok: false, status: 409, code: "session_completed" };
  }
  if (session.unlockAt > now) {
    return { ok: false, status: 409, code: "session_locked" };
  }

  const sessions = await repo.listSessionsForCourseOrdered(db, row.course.id);
  const lower = sessions.filter((x) => x.index < session.index);
  if (!lower.every((x) => x.status === "completed")) {
    return { ok: false, status: 409, code: "complete_previous_sessions_first" };
  }

  const pipeline = await repo.findActivePipelineSubmissionForGrant(db, input.grantId);
  if (pipeline && pipeline.session.id !== input.sessionId) {
    return { ok: false, status: 409, code: "active_submission_on_other_session" };
  }

  let existing = await repo.getSubmissionBySessionIdForGrant(db, input.sessionId, input.grantId);
  if (!existing && pipeline && pipeline.session.id === input.sessionId) {
    existing = pipeline.submission;
  }

  if (existing && existing.regularAccessGrantId !== input.grantId) {
    return { ok: false, status: 403, code: "forbidden" };
  }

  if (existing && existing.status !== "draft") {
    return { ok: false, status: 409, code: "submission_not_editable" };
  }

  let imageKey = existing?.imageStorageKey ?? null;
  let imageMime = existing?.imageMimeType ?? null;

  if (input.imageBuffer && input.imageMimeType) {
    const v = validateImageUpload({
      mimeType: input.imageMimeType,
      byteLength: input.imageBuffer.length,
    });
    if (!v.ok) {
      return { ok: false, status: 400, code: v.reason };
    }
  }

  try {
    return await db.transaction(async (tx) => {
      let submissionId = existing?.id;

      if (input.imageBuffer && input.imageMimeType) {
        const v = validateImageUpload({
          mimeType: input.imageMimeType,
          byteLength: input.imageBuffer.length,
        });
        if (!v.ok) {
          return { ok: false, status: 400, code: v.reason };
        }

        if (!submissionId) {
          try {
            const ins = await repo.insertSubmission(tx, {
              sessionId: input.sessionId,
              courseId: row.course.id,
              userId: null,
              regularAccessGrantId: input.grantId,
              status: "draft",
              bodyText: input.bodyText,
              imageStorageKey: null,
              imageMimeType: null,
              submittedAt: null,
            });
            submissionId = ins.id;
          } catch (e) {
            if (e instanceof PostgresError && e.code === "23505") {
              return { ok: false, status: 409, code: "active_submission_conflict" };
            }
            throw e;
          }
        }

        const { storageKey } = buildStorageObjectKey({
          regularAccessGrantId: input.grantId,
          submissionId: submissionId!,
          mimeType: input.imageMimeType,
        });

        const supabase = getServiceRoleClient();
        const up = await supabase.storage
          .from(BUCKET)
          .upload(storageKey, input.imageBuffer, {
            contentType: input.imageMimeType.split(";")[0]?.trim(),
            upsert: false,
          });
        if (up.error) {
          console.error("storage_upload_failed", up.error.message);
          return { ok: false, status: 500, code: "storage_upload_failed" };
        }

        imageKey = storageKey;
        imageMime = input.imageMimeType.split(";")[0]?.trim() ?? input.imageMimeType;

        const updated = await repo.updateSubmissionDraftForGrant(tx, submissionId!, input.grantId, {
          bodyText: input.bodyText,
          imageStorageKey: imageKey,
          imageMimeType: imageMime,
        });
        if (!updated) {
          return { ok: false, status: 409, code: "submission_not_editable" };
        }

        if (input.action === "submit") {
          if (!hasSubstantiveContent(updated.bodyText, updated.imageStorageKey)) {
            return { ok: false, status: 422, code: "empty_submission" };
          }
          const fin = await repo.submitSubmissionFinalForGrant(tx, submissionId!, input.grantId);
          if (!fin) {
            return { ok: false, status: 409, code: "submit_failed" };
          }
          return { ok: true, submissionId: fin.id, status: fin.status };
        }
        return { ok: true, submissionId: updated.id, status: updated.status };
      }

      if (!submissionId) {
        try {
          const ins = await repo.insertSubmission(tx, {
            sessionId: input.sessionId,
            courseId: row.course.id,
            userId: null,
            regularAccessGrantId: input.grantId,
            status: "draft",
            bodyText: input.bodyText,
            imageStorageKey: imageKey,
            imageMimeType: imageMime,
            submittedAt: null,
          });
          submissionId = ins.id;
        } catch (e) {
          if (e instanceof PostgresError && e.code === "23505") {
            return { ok: false, status: 409, code: "active_submission_conflict" };
          }
          throw e;
        }
      } else {
        const updated = await repo.updateSubmissionDraftForGrant(tx, submissionId, input.grantId, {
          bodyText: input.bodyText,
          imageStorageKey: imageKey,
          imageMimeType: imageMime,
        });
        if (!updated) {
          return { ok: false, status: 409, code: "submission_not_editable" };
        }
      }

      const sub = await repo.getSubmissionByIdForGrant(tx, submissionId!, input.grantId);
      if (!sub) {
        return { ok: false, status: 500, code: "submission_missing" };
      }

      if (input.action === "submit") {
        if (!hasSubstantiveContent(sub.bodyText, sub.imageStorageKey)) {
          return { ok: false, status: 422, code: "empty_submission" };
        }
        const fin = await repo.submitSubmissionFinalForGrant(tx, submissionId!, input.grantId);
        if (!fin) {
          return { ok: false, status: 409, code: "submit_failed" };
        }
        return { ok: true, submissionId: fin.id, status: fin.status };
      }

      return { ok: true, submissionId: sub.id, status: sub.status };
    });
  } catch (e) {
    if (e instanceof PostgresError && e.code === "23505") {
      return { ok: false, status: 409, code: "active_submission_conflict" };
    }
    throw e;
  }
}

/**
 * 体験: trial_application_id は Cookie→mirinae-api で検証済みの値のみ渡す。
 * writing.submissions.trial_application_id が提出の source of truth。
 */
export async function saveOrSubmitSubmissionForTrial(
  db: Db,
  input: SaveSubmissionTrialInput
): Promise<SaveSubmissionResult> {
  const lenErr = assertBodyTextLength(input.bodyText);
  if (lenErr) return lenErr;

  const courseIdEnv = getTrialWritingCourseId();
  if (!courseIdEnv) {
    return { ok: false, status: 503, code: "trial_course_not_configured" };
  }

  const trialCourse = await repo.getWritingCourseById(db, courseIdEnv);
  if (!trialCourse || trialCourse.status !== "active") {
    return { ok: false, status: 404, code: "session_not_found" };
  }

  const row = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!row || row.course.id !== trialCourse.id) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  if (row.course.status !== "active") {
    return { ok: false, status: 409, code: "course_not_active" };
  }

  await repo.lazyUnlockDueSessions(db, row.course.id);
  const refreshed = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!refreshed) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  const session = refreshed.session;

  const now = new Date();
  if (session.status === "completed") {
    return { ok: false, status: 409, code: "session_completed" };
  }
  if (session.unlockAt > now) {
    return { ok: false, status: 409, code: "session_locked" };
  }

  const sessions = await repo.listSessionsForCourseOrdered(db, row.course.id);
  const lower = sessions.filter((x) => x.index < session.index);
  if (!lower.every((x) => x.status === "completed")) {
    return { ok: false, status: 409, code: "complete_previous_sessions_first" };
  }

  const pipeline = await repo.findActivePipelineSubmissionForTrial(db, input.trialApplicationId);
  if (pipeline && pipeline.session.id !== input.sessionId) {
    return { ok: false, status: 409, code: "active_submission_on_other_session" };
  }

  let existing = await repo.getSubmissionBySessionIdForTrial(db, input.sessionId, input.trialApplicationId);
  if (!existing && pipeline && pipeline.session.id === input.sessionId) {
    existing = pipeline.submission;
  }

  if (existing && existing.trialApplicationId !== input.trialApplicationId) {
    return { ok: false, status: 403, code: "forbidden" };
  }

  if (existing && existing.status !== "draft") {
    return { ok: false, status: 409, code: "submission_not_editable" };
  }

  let imageKey = existing?.imageStorageKey ?? null;
  let imageMime = existing?.imageMimeType ?? null;

  if (input.imageBuffer && input.imageMimeType) {
    const v = validateImageUpload({
      mimeType: input.imageMimeType,
      byteLength: input.imageBuffer.length,
    });
    if (!v.ok) {
      return { ok: false, status: 400, code: v.reason };
    }
  }

  try {
    return await db.transaction(async (tx) => {
      let submissionId = existing?.id;

      if (input.imageBuffer && input.imageMimeType) {
        const v = validateImageUpload({
          mimeType: input.imageMimeType,
          byteLength: input.imageBuffer.length,
        });
        if (!v.ok) {
          return { ok: false, status: 400, code: v.reason };
        }

        if (!submissionId) {
          try {
            const ins = await repo.insertSubmission(tx, {
              sessionId: input.sessionId,
              courseId: row.course.id,
              userId: null,
              regularAccessGrantId: null,
              trialApplicationId: input.trialApplicationId,
              status: "draft",
              bodyText: input.bodyText,
              imageStorageKey: null,
              imageMimeType: null,
              submittedAt: null,
            });
            submissionId = ins.id;
          } catch (e) {
            if (e instanceof PostgresError && e.code === "23505") {
              return { ok: false, status: 409, code: "active_submission_conflict" };
            }
            throw e;
          }
        }

        const { storageKey } = buildStorageObjectKey({
          trialApplicationId: input.trialApplicationId,
          submissionId: submissionId!,
          mimeType: input.imageMimeType,
        });

        const supabase = getServiceRoleClient();
        const up = await supabase.storage
          .from(BUCKET)
          .upload(storageKey, input.imageBuffer, {
            contentType: input.imageMimeType.split(";")[0]?.trim(),
            upsert: false,
          });
        if (up.error) {
          console.error("storage_upload_failed", up.error.message);
          return { ok: false, status: 500, code: "storage_upload_failed" };
        }

        imageKey = storageKey;
        imageMime = input.imageMimeType.split(";")[0]?.trim() ?? input.imageMimeType;

        const updated = await repo.updateSubmissionDraftForTrial(tx, submissionId!, input.trialApplicationId, {
          bodyText: input.bodyText,
          imageStorageKey: imageKey,
          imageMimeType: imageMime,
        });
        if (!updated) {
          return { ok: false, status: 409, code: "submission_not_editable" };
        }

        if (input.action === "submit") {
          if (!hasSubstantiveContent(updated.bodyText, updated.imageStorageKey)) {
            return { ok: false, status: 422, code: "empty_submission" };
          }
          const fin = await repo.submitSubmissionFinalForTrial(tx, submissionId!, input.trialApplicationId);
          if (!fin) {
            return { ok: false, status: 409, code: "submit_failed" };
          }
          return { ok: true, submissionId: fin.id, status: fin.status };
        }
        return { ok: true, submissionId: updated.id, status: updated.status };
      }

      if (!submissionId) {
        try {
          const ins = await repo.insertSubmission(tx, {
            sessionId: input.sessionId,
            courseId: row.course.id,
            userId: null,
            regularAccessGrantId: null,
            trialApplicationId: input.trialApplicationId,
            status: "draft",
            bodyText: input.bodyText,
            imageStorageKey: imageKey,
            imageMimeType: imageMime,
            submittedAt: null,
          });
          submissionId = ins.id;
        } catch (e) {
          if (e instanceof PostgresError && e.code === "23505") {
            return { ok: false, status: 409, code: "active_submission_conflict" };
          }
          throw e;
        }
      } else {
        const updated = await repo.updateSubmissionDraftForTrial(tx, submissionId, input.trialApplicationId, {
          bodyText: input.bodyText,
          imageStorageKey: imageKey,
          imageMimeType: imageMime,
        });
        if (!updated) {
          return { ok: false, status: 409, code: "submission_not_editable" };
        }
      }

      const sub = await repo.getSubmissionByIdForTrial(tx, submissionId!, input.trialApplicationId);
      if (!sub) {
        return { ok: false, status: 500, code: "submission_missing" };
      }

      if (input.action === "submit") {
        if (!hasSubstantiveContent(sub.bodyText, sub.imageStorageKey)) {
          return { ok: false, status: 422, code: "empty_submission" };
        }
        const fin = await repo.submitSubmissionFinalForTrial(tx, submissionId!, input.trialApplicationId);
        if (!fin) {
          return { ok: false, status: 409, code: "submit_failed" };
        }
        return { ok: true, submissionId: fin.id, status: fin.status };
      }

      return { ok: true, submissionId: sub.id, status: sub.status };
    });
  } catch (e) {
    if (e instanceof PostgresError && e.code === "23505") {
      return { ok: false, status: 409, code: "active_submission_conflict" };
    }
    throw e;
  }
}

export async function getSignedImageUrl(storageKey: string, expiresSec = 3600): Promise<string | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, expiresSec);
  if (error || !data?.signedUrl) {
    return null;
  }
  return data.signedUrl;
}

/** Owner-only submission detail; image returned as short-lived signed URL (never raw storage path to untrusted clients). */
export async function getSubmissionDetailForStudent(
  db: Db,
  userId: string,
  submissionId: string
) {
  const sub = await repo.getSubmissionByIdForUser(db, submissionId, userId);
  if (!sub) return null;
  let imageUrl: string | null = null;
  if (sub.imageStorageKey) {
    imageUrl = await getSignedImageUrl(sub.imageStorageKey);
  }
  return {
    id: sub.id,
    sessionId: sub.sessionId,
    courseId: sub.courseId,
    status: sub.status,
    bodyText: sub.bodyText,
    imageMimeType: sub.imageMimeType,
    imageUrl,
    submittedAt: sub.submittedAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

export async function getSubmissionDetailForRegularGrant(
  db: Db,
  grantId: string,
  submissionId: string
) {
  const sub = await repo.getSubmissionByIdForGrant(db, submissionId, grantId);
  if (!sub) return null;
  let imageUrl: string | null = null;
  if (sub.imageStorageKey) {
    imageUrl = await getSignedImageUrl(sub.imageStorageKey);
  }
  return {
    id: sub.id,
    sessionId: sub.sessionId,
    courseId: sub.courseId,
    status: sub.status,
    bodyText: sub.bodyText,
    imageMimeType: sub.imageMimeType,
    imageUrl,
    submittedAt: sub.submittedAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

/** Published correction + fragments + scores only (draft corrections invisible). */
export async function getPublishedStudentResult(db: Db, userId: string, submissionId: string) {
  const row = await repo.getPublishedResultForSubmission(db, submissionId, userId);
  if (!row) return null;
  const fragments = await repo.listFragmentsForCorrection(db, row.correction.id);
  const evaluationRow = await repo.getEvaluationForSubmission(db, submissionId);
  return {
    submissionId: row.submission.id,
    submission: {
      bodyText: row.submission.bodyText,
      submittedAt: row.submission.submittedAt?.toISOString() ?? null,
    },
    correction: {
      polishedSentence: row.correction.polishedSentence,
      modelAnswer: row.correction.modelAnswer,
      teacherComment: row.correction.teacherComment,
      publishedAt: row.correction.publishedAt?.toISOString() ?? null,
    },
    fragments: fragments.map((f) => ({
      orderIndex: f.orderIndex,
      originalText: f.originalText,
      correctedText: f.correctedText,
      category: f.category,
    })),
    evaluation: evaluationRow
      ? {
          grammarAccuracy: evaluationRow.grammarAccuracy,
          vocabularyUsage: evaluationRow.vocabularyUsage,
          contextualFluency: evaluationRow.contextualFluency,
        }
      : null,
  };
}

export async function getPublishedRegularResult(db: Db, grantId: string, submissionId: string) {
  const row = await repo.getPublishedResultForSubmissionGrant(db, submissionId, grantId);
  if (!row) return null;
  const fragments = await repo.listFragmentsForCorrection(db, row.correction.id);
  const evaluationRow = await repo.getEvaluationForSubmission(db, submissionId);
  return {
    submissionId: row.submission.id,
    submission: {
      bodyText: row.submission.bodyText,
      submittedAt: row.submission.submittedAt?.toISOString() ?? null,
    },
    correction: {
      polishedSentence: row.correction.polishedSentence,
      modelAnswer: row.correction.modelAnswer,
      teacherComment: row.correction.teacherComment,
      publishedAt: row.correction.publishedAt?.toISOString() ?? null,
    },
    fragments: fragments.map((f) => ({
      orderIndex: f.orderIndex,
      originalText: f.originalText,
      correctedText: f.correctedText,
      category: f.category,
    })),
    evaluation: evaluationRow
      ? {
          grammarAccuracy: evaluationRow.grammarAccuracy,
          vocabularyUsage: evaluationRow.vocabularyUsage,
          contextualFluency: evaluationRow.contextualFluency,
        }
      : null,
  };
}
