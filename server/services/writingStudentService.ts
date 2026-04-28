/**
 * Student submission — abuse mitigations implemented here:
 * 1) IDOR: every query joins/ filters by `auth.users` id from the verified session (never from body).
 * 2) Parallel active drafts: DB partial unique index `writing_submissions_one_active_pipeline_per_user` + 23505 handling.
 * 3) Upload abuse: allowlisted MIME + max bytes; objects stored under server-generated keys in Supabase Storage (not web root).
 * Rate limiting / WAF: configure at the edge; optional per-user caps can wrap these handlers later.
 */

import { writingCourses, writingSessions, writingSubmissions } from "../../db/schema";
import type { Db } from "../db/client";
import { resolveWritingRoleFromDbOrEnv } from "../lib/writingAuthRoles";
import { checkSessionEligibleForWriting } from "../lib/writingSubmissionEligibility";
import { validateSubmissionFileUpload } from "../lib/writingUploads";
import { getServiceRoleClient } from "../lib/supabaseServiceRole";
import {
  isWritingCourseOpenForTrialLearner,
  resolveWritingTrialCourseIdForLearner,
} from "../lib/writingTrialCourseResolve";
import { trialBootstrapBlocked, trialBootstrapVerbose } from "../lib/trialSessionBootstrapLog";
import * as repo from "../repositories/writingStudentRepository";
import type { PublishedResultRow } from "../repositories/writingStudentRepository";
import type { PreparedAttachment } from "./writingSubmissionInternal";
import { executeSubmissionWrite } from "./writingSubmissionInternal";
import type { SubmissionMode } from "../lib/writingSubmissionMode";
import { ensureTrialCourseFirstSessionIfMissing } from "./trialCourseSessionBootstrapService";

type WritingCourseRow = typeof writingCourses.$inferSelect;

const BUCKET = process.env.WRITING_UPLOADS_BUCKET ?? "writing-submissions";

/** Security: cap text length to mitigate abuse (configurable). */
const MAX_BODY_TEXT_CHARS = (() => {
  const raw = process.env.WRITING_MAX_BODY_TEXT_CHARS;
  if (!raw) return 50_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 50_000;
})();

/** Prior sessions are "done" for progression when corrected or missed (deadline). */
function sessionIsTerminalForProgression(status: string): boolean {
  return status === "completed" || status === "missed";
}

function sessionDtoFromRow(
  s: Pick<
    typeof writingSessions.$inferSelect,
    "id" | "courseId" | "index" | "unlockAt" | "status" | "themeSnapshot"
  >
) {
  return {
    id: s.id,
    courseId: s.courseId,
    index: s.index,
    unlockAt: s.unlockAt.toISOString(),
    status: s.status,
    themeSnapshot: s.themeSnapshot ?? null,
  };
}

function trialSessionDtoFromRow(s: typeof writingSessions.$inferSelect) {
  return {
    id: s.id,
    courseId: s.courseId,
    index: s.index,
    unlockAt: s.unlockAt.toISOString(),
    status: s.status,
    themeSnapshot: s.themeSnapshot ?? null,
    runtimeStatus: s.runtimeStatus ?? null,
    requiredExpressionsSnapshot: s.requiredExpressionsSnapshot ?? null,
    modelAnswerSnapshot: s.modelAnswerSnapshot ?? null,
  };
}

export type CurrentSessionResponse =
  | {
      ok: true;
      /** `admin_test` = isolated sandbox course for ADMIN_USER_IDS only (see adminSandboxProvisionService). */
      accessKind: "student" | "admin_test";
      courseId: string;
      mode: "pipeline" | "fresh" | "all_done";
      session: {
        id: string;
        courseId: string;
        index: number;
        unlockAt: string;
        status: string;
        themeSnapshot: string | null;
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
        themeSnapshot: string | null;
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
        themeSnapshot: string | null;
        runtimeStatus: string | null;
        requiredExpressionsSnapshot: unknown;
        modelAnswerSnapshot: string | null;
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
async function buildOwnedCourseCurrentSession(
  db: Db,
  userId: string,
  course: WritingCourseRow,
  accessKind: "student" | "admin_test"
): Promise<CurrentSessionResponse> {
  await repo.lazyUnlockDueSessions(db, course.id);
  const sessions = await repo.listSessionsForCourseOrdered(db, course.id);

  const pipeline = await repo.findActivePipelineSubmissionForUserForCourse(db, userId, course.id);
  if (pipeline) {
    return {
      ok: true,
      accessKind,
      courseId: course.id,
      mode: "pipeline",
      session: sessionDtoFromRow(pipeline.session),
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
    if (sessionIsTerminalForProgression(s.status)) continue;

    const lower = sessions.filter((x) => x.index < s.index);
    const prevAllCompleted = lower.every((x) => sessionIsTerminalForProgression(x.status));
    if (!prevAllCompleted) {
      const blocker = lower.find((x) => !sessionIsTerminalForProgression(x.status));
      if (blocker) {
        return {
          ok: true,
          accessKind,
          courseId: course.id,
          mode: "fresh",
          session: sessionDtoFromRow(blocker),
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
        accessKind,
        courseId: course.id,
        mode: "fresh",
        session: sessionDtoFromRow(s),
        submission: null,
        canSubmit: false,
        reasonIfNot: "session_not_unlocked_yet",
      };
    }

    return {
      ok: true,
      accessKind,
      courseId: course.id,
      mode: "fresh",
      session: sessionDtoFromRow(s),
      submission: null,
      canSubmit: true,
    };
  }

  return {
    ok: true,
    accessKind,
    courseId: course.id,
    mode: "all_done",
    session: null,
    submission: null,
    canSubmit: false,
    reasonIfNot: "all_sessions_completed",
  };
}

export async function getCurrentSessionForStudent(
  db: Db,
  userId: string
): Promise<CurrentSessionResponse> {
  const course = await repo.findActiveWritingCourseForUser(db, userId);
  if (!course) {
    return { ok: false, error: "no_active_course" };
  }
  return buildOwnedCourseCurrentSession(db, userId, course, "student");
}

/** Admin sandbox: same UX as student; course is provisioned per admin user (is_admin_sandbox). */
export async function getCurrentSessionForAdminSandbox(
  db: Db,
  userId: string
): Promise<CurrentSessionResponse> {
  const course = await repo.findAdminSandboxCourseForUser(db, userId);
  if (!course) {
    return { ok: false, error: "no_active_course" };
  }
  return buildOwnedCourseCurrentSession(db, userId, course, "admin_test");
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
      session: sessionDtoFromRow(pipeline.session),
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
    if (sessionIsTerminalForProgression(s.status)) continue;

    const lower = sessions.filter((x) => x.index < s.index);
    const prevAllCompleted = lower.every((x) => sessionIsTerminalForProgression(x.status));
    if (!prevAllCompleted) {
      const blocker = lower.find((x) => !sessionIsTerminalForProgression(x.status));
      if (blocker) {
        return {
          ok: true,
          accessKind: "regular",
          grantId,
          courseId: course.id,
          accessExpiresAt: grant.accessExpiresAt?.toISOString() ?? null,
          pendingSubmissionId: null,
          mode: "fresh",
          session: sessionDtoFromRow(blocker),
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
        session: sessionDtoFromRow(s),
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
      session: sessionDtoFromRow(s),
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

/**
 * 体験: trial_application_id は Cookie 経由の upstream 検証後にのみ渡す。
 * 提出データの source of truth は writing.submissions（trial_application_id）。
 */
export async function getCurrentSessionForTrialApplication(
  db: Db,
  applicationId: string
): Promise<CurrentSessionResponse> {
  const hasEnvTrialCourseId = Boolean(process.env.WRITING_TRIAL_COURSE_ID?.trim());
  const courseId = await resolveWritingTrialCourseIdForLearner(db);
  trialBootstrapVerbose("trial_resolve_course_id", {
    hasEnvTrialCourseId,
    resolved: Boolean(courseId),
    courseIdPrefix: courseId ? `${courseId.slice(0, 8)}…` : null,
  });
  if (!courseId) {
    trialBootstrapBlocked("no_course_id", { hasEnvTrialCourseId });
    return { ok: false, error: "no_active_course" };
  }
  const course = await repo.getWritingCourseById(db, courseId);
  if (!course || !isWritingCourseOpenForTrialLearner(course.status)) {
    trialBootstrapBlocked("course_not_usable_for_trial", {
      courseIdPrefix: `${courseId.slice(0, 8)}…`,
      courseRowFound: Boolean(course),
      courseStatus: course?.status ?? null,
      courseTermIdPrefix: course?.termId ? `${course.termId.slice(0, 8)}…` : null,
    });
    return { ok: false, error: "no_active_course" };
  }

  await ensureTrialCourseFirstSessionIfMissing(db, course);
  await repo.lazyUnlockDueSessions(db, course.id);
  const sessions = await repo.listSessionsForCourseOrdered(db, course.id);
  trialBootstrapVerbose("trial_sessions_after_bootstrap", {
    courseIdPrefix: `${course.id.slice(0, 8)}…`,
    courseStatus: course.status,
    courseTermIdPrefix: course.termId ? `${course.termId.slice(0, 8)}…` : null,
    sessionCount: sessions.length,
    sessionIndexes: sessions.map((s) => s.index),
  });

  const pipeline = await repo.findActivePipelineSubmissionForTrial(db, applicationId);
  if (pipeline) {
    trialBootstrapVerbose("trial_return_pipeline", {
      sessionIndex: pipeline.session.index,
      sessionIdPrefix: `${pipeline.session.id.slice(0, 8)}…`,
    });
    return {
      ok: true,
      accessKind: "trial",
      applicationId,
      courseId: course.id,
      accessExpiresAt: null,
      pendingSubmissionId: pipeline.submission.id,
      mode: "pipeline",
      session: trialSessionDtoFromRow(pipeline.session),
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
    if (sessionIsTerminalForProgression(s.status)) continue;

    const lower = sessions.filter((x) => x.index < s.index);
    const prevAllCompleted = lower.every((x) => sessionIsTerminalForProgression(x.status));
    if (!prevAllCompleted) {
      const blocker = lower.find((x) => !sessionIsTerminalForProgression(x.status));
      if (blocker) {
        trialBootstrapVerbose("trial_return_blocker", { sessionIndex: blocker.index });
        return {
          ok: true,
          accessKind: "trial",
          applicationId,
          courseId: course.id,
          accessExpiresAt: null,
          pendingSubmissionId: null,
          mode: "fresh",
          session: trialSessionDtoFromRow(blocker),
          submission: null,
          canSubmit: false,
          reasonIfNot: "complete_previous_sessions_first",
        };
      }
    }

    const timeOk = s.unlockAt <= now;
    if (!timeOk) {
      trialBootstrapVerbose("trial_return_not_unlocked_time", { sessionIndex: s.index });
      return {
        ok: true,
        accessKind: "trial",
        applicationId,
        courseId: course.id,
        accessExpiresAt: null,
        pendingSubmissionId: null,
        mode: "fresh",
        session: trialSessionDtoFromRow(s),
        submission: null,
        canSubmit: false,
        reasonIfNot: "session_not_unlocked_yet",
      };
    }

    trialBootstrapVerbose("trial_return_can_submit", {
      sessionIndex: s.index,
      sessionIdPrefix: `${s.id.slice(0, 8)}…`,
      status: s.status,
      runtimeStatus: s.runtimeStatus,
    });
    return {
      ok: true,
      accessKind: "trial",
      applicationId,
      courseId: course.id,
      accessExpiresAt: null,
      pendingSubmissionId: null,
      mode: "fresh",
      session: trialSessionDtoFromRow(s),
      submission: null,
      canSubmit: true,
    };
  }

  trialBootstrapVerbose("trial_return_all_done", { sessionCount: sessions.length });
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

export type SaveSubmissionInput = {
  userId: string;
  sessionId: string;
  action: "save" | "submit";
  bodyText: string | null;
  submissionMode: SubmissionMode | null;
  attachments: PreparedAttachment[];
};

export type SaveSubmissionRegularInput = {
  grantId: string;
  sessionId: string;
  action: "save" | "submit";
  bodyText: string | null;
  submissionMode: SubmissionMode | null;
  attachments: PreparedAttachment[];
};

export type SaveSubmissionTrialInput = {
  trialApplicationId: string;
  sessionId: string;
  action: "save" | "submit";
  bodyText: string | null;
  submissionMode: SubmissionMode | null;
  attachments: PreparedAttachment[];
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
  const elig = checkSessionEligibleForWriting(session, now);
  if (!elig.ok) {
    return { ok: false, status: 409, code: elig.code };
  }

  const sessions = await repo.listSessionsForCourseOrdered(db, row.course.id);
  const lower = sessions.filter((x) => x.index < session.index);
  if (!lower.every((x) => sessionIsTerminalForProgression(x.status))) {
    return { ok: false, status: 409, code: "complete_previous_sessions_first" };
  }

  const pipeline = await repo.findActivePipelineSubmissionForUserForCourse(db, input.userId, row.course.id);
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

  for (const a of input.attachments) {
    const v = validateSubmissionFileUpload({ mimeType: a.mimeType, byteLength: a.buffer.length });
    if (!v.ok) {
      return { ok: false, status: 400, code: v.reason };
    }
  }

  const replaceAttachmentFiles = input.attachments.length > 0;

  return executeSubmissionWrite(db, {
    courseId: row.course.id,
    sessionId: input.sessionId,
    action: input.action,
    submissionMode: input.submissionMode,
    bodyText: input.bodyText,
    attachments: input.attachments,
    replaceAttachmentFiles,
    existing,
    identity: { type: "user", userId: input.userId },
  });
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
  const elig = checkSessionEligibleForWriting(session, now);
  if (!elig.ok) {
    return { ok: false, status: 409, code: elig.code };
  }

  const sessions = await repo.listSessionsForCourseOrdered(db, row.course.id);
  const lower = sessions.filter((x) => x.index < session.index);
  if (!lower.every((x) => sessionIsTerminalForProgression(x.status))) {
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

  for (const a of input.attachments) {
    const v = validateSubmissionFileUpload({ mimeType: a.mimeType, byteLength: a.buffer.length });
    if (!v.ok) {
      return { ok: false, status: 400, code: v.reason };
    }
  }

  const replaceAttachmentFiles = input.attachments.length > 0;

  return executeSubmissionWrite(db, {
    courseId: row.course.id,
    sessionId: input.sessionId,
    action: input.action,
    submissionMode: input.submissionMode,
    bodyText: input.bodyText,
    attachments: input.attachments,
    replaceAttachmentFiles,
    existing,
    identity: { type: "grant", grantId: input.grantId },
  });
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

  const courseIdEnv = await resolveWritingTrialCourseIdForLearner(db);
  if (!courseIdEnv) {
    return { ok: false, status: 503, code: "trial_course_not_configured" };
  }

  const trialCourse = await repo.getWritingCourseById(db, courseIdEnv);
  if (!trialCourse || !isWritingCourseOpenForTrialLearner(trialCourse.status)) {
    return { ok: false, status: 404, code: "session_not_found" };
  }

  const row = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!row || row.course.id !== trialCourse.id) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  if (!isWritingCourseOpenForTrialLearner(row.course.status)) {
    return { ok: false, status: 409, code: "course_not_active" };
  }

  await repo.lazyUnlockDueSessions(db, row.course.id);
  const refreshed = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!refreshed) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  const session = refreshed.session;

  const now = new Date();
  const elig = checkSessionEligibleForWriting(session, now);
  if (!elig.ok) {
    return { ok: false, status: 409, code: elig.code };
  }

  const sessions = await repo.listSessionsForCourseOrdered(db, row.course.id);
  const lower = sessions.filter((x) => x.index < session.index);
  if (!lower.every((x) => sessionIsTerminalForProgression(x.status))) {
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

  for (const a of input.attachments) {
    const v = validateSubmissionFileUpload({ mimeType: a.mimeType, byteLength: a.buffer.length });
    if (!v.ok) {
      return { ok: false, status: 400, code: v.reason };
    }
  }

  const replaceAttachmentFiles = input.attachments.length > 0;

  return executeSubmissionWrite(db, {
    courseId: row.course.id,
    sessionId: input.sessionId,
    action: input.action,
    submissionMode: input.submissionMode,
    bodyText: input.bodyText,
    attachments: input.attachments,
    replaceAttachmentFiles,
    existing,
    identity: { type: "trial", trialApplicationId: input.trialApplicationId },
  });
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

/** Signed URL for arbitrary bucket/key (submission_attachments may use same or WRITING_UPLOADS_BUCKET). */
async function getSignedStorageUrl(
  bucket: string,
  storageKey: string,
  expiresSec = 3600
): Promise<string | null> {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storageKey, expiresSec);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function listSubmissionAttachmentsForApi(db: Db, submissionId: string) {
  const rows = await repo.listSubmissionAttachmentsBySubmissionId(db, submissionId);
  const out: Array<{
    id: string;
    mimeType: string;
    byteSize: number;
    sortOrder: number;
    originalFilename: string | null;
    pageCount: number | null;
    downloadUrl: string | null;
  }> = [];
  for (const a of rows) {
    const downloadUrl = await getSignedStorageUrl(a.storageBucket, a.storageKey);
    out.push({
      id: a.id,
      mimeType: a.mimeType,
      byteSize: a.byteSize,
      sortOrder: a.sortOrder,
      originalFilename: a.originalFilename ?? null,
      pageCount: a.pageCount ?? null,
      downloadUrl,
    });
  }
  return out;
}

function sessionIsMissed(s: { runtimeStatus: string | null; status: string }): boolean {
  return s.runtimeStatus === "missed" || s.status === "missed";
}

async function buildPublishedResultPayload(
  db: Db,
  row: PublishedResultRow,
  session: typeof writingSessions.$inferSelect
) {
  const submissionId = row.submission.id;
  const correctionId = row.correction.id;
  const [
    fragments,
    feedbackItems,
    annotations,
    evaluationRow,
    correctionEvalRow,
    attachments,
  ] = await Promise.all([
    repo.listFragmentsForCorrection(db, correctionId),
    repo.listCorrectionFeedbackItemsForCorrection(db, correctionId),
    repo.listCorrectionAnnotationsForCorrection(db, correctionId),
    repo.getEvaluationForSubmission(db, submissionId),
    repo.getCorrectionEvaluationByCorrectionId(db, correctionId),
    listSubmissionAttachmentsForApi(db, submissionId),
  ]);

  return {
    outcome: "published" as const,
    submissionId: row.submission.id,
    session: {
      id: session.id,
      index: session.index,
      status: session.status,
      runtimeStatus: session.runtimeStatus ?? null,
      unlockAt: session.unlockAt.toISOString(),
      availableFrom: session.availableFrom?.toISOString() ?? null,
      dueAt: session.dueAt?.toISOString() ?? null,
      missedAt: session.missedAt?.toISOString() ?? null,
    },
    submission: {
      bodyText: row.submission.bodyText,
      submittedAt: row.submission.submittedAt?.toISOString() ?? null,
      submissionMode: row.submission.submissionMode ?? null,
    },
    attachments,
    correction: {
      polishedSentence: row.correction.polishedSentence,
      modelAnswer: row.correction.modelAnswer,
      teacherComment: row.correction.teacherComment,
      richDocumentJson: row.correction.richDocumentJson ?? null,
      improvedText: row.correction.improvedText,
      publishedAt: row.correction.publishedAt?.toISOString() ?? null,
    },
    fragments: fragments.map((f) => ({
      orderIndex: f.orderIndex,
      originalText: f.originalText,
      correctedText: f.correctedText,
      category: f.category,
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
    evaluation: evaluationRow
      ? {
          grammarAccuracy: evaluationRow.grammarAccuracy,
          vocabularyUsage: evaluationRow.vocabularyUsage,
          contextualFluency: evaluationRow.contextualFluency,
        }
      : null,
    correctionEvaluation: correctionEvalRow
      ? {
          grammar: correctionEvalRow.grammar,
          vocabulary: correctionEvalRow.vocabulary,
          flow: correctionEvalRow.flow,
          coherence: correctionEvalRow.coherence,
        }
      : null,
  };
}

async function buildMissedResultPayload(
  submission: typeof writingSubmissions.$inferSelect,
  session: typeof writingSessions.$inferSelect,
  attachments: Awaited<ReturnType<typeof listSubmissionAttachmentsForApi>>
) {
  return {
    outcome: "missed" as const,
    submissionId: submission.id,
    session: {
      id: session.id,
      index: session.index,
      status: session.status,
      runtimeStatus: session.runtimeStatus ?? null,
      unlockAt: session.unlockAt.toISOString(),
      availableFrom: session.availableFrom?.toISOString() ?? null,
      dueAt: session.dueAt?.toISOString() ?? null,
      missedAt: session.missedAt?.toISOString() ?? null,
      modelAnswerSnapshot: session.modelAnswerSnapshot,
    },
    submission: {
      bodyText: submission.bodyText,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      submissionMode: submission.submissionMode ?? null,
    },
    attachments,
    correction: null,
    fragments: [],
    feedbackItems: [],
    annotations: [],
    evaluation: null,
    correctionEvaluation: null,
  };
}

/** Owner-only submission detail; image returned as short-lived signed URL (never raw storage path to untrusted clients). */
export async function getSubmissionDetailForStudent(
  db: Db,
  userId: string,
  submissionId: string
) {
  const sub = await repo.getSubmissionByIdForUser(db, submissionId, userId);
  if (!sub) return null;
  await repo.lazyUnlockDueSessions(db, sub.courseId);
  let imageUrl: string | null = null;
  if (sub.imageStorageKey) {
    imageUrl = await getSignedImageUrl(sub.imageStorageKey);
  }
  const attachments = await listSubmissionAttachmentsForApi(db, submissionId);
  return {
    id: sub.id,
    sessionId: sub.sessionId,
    courseId: sub.courseId,
    status: sub.status,
    bodyText: sub.bodyText,
    imageMimeType: sub.imageMimeType,
    imageUrl,
    submissionMode: sub.submissionMode ?? null,
    attachments,
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
  await repo.lazyUnlockDueSessions(db, sub.courseId);
  let imageUrl: string | null = null;
  if (sub.imageStorageKey) {
    imageUrl = await getSignedImageUrl(sub.imageStorageKey);
  }
  const attachments = await listSubmissionAttachmentsForApi(db, submissionId);
  return {
    id: sub.id,
    sessionId: sub.sessionId,
    courseId: sub.courseId,
    status: sub.status,
    bodyText: sub.bodyText,
    imageMimeType: sub.imageMimeType,
    imageUrl,
    submissionMode: sub.submissionMode ?? null,
    attachments,
    submittedAt: sub.submittedAt?.toISOString() ?? null,
    createdAt: sub.createdAt.toISOString(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

/**
 * Student result: reconcile → missed-safe payload OR published-only correction (draft never returned).
 * Regular session + cookie grant paths.
 */
export async function getPublishedStudentResult(db: Db, userId: string, submissionId: string) {
  const sub = await repo.getSubmissionByIdForUser(db, submissionId, userId);
  if (!sub) return null;
  await repo.lazyUnlockDueSessions(db, sub.courseId);
  const joined = await repo.getSubmissionWithSessionForUser(db, submissionId, userId);
  if (!joined) return null;
  const { submission, session } = joined;
  const attachments = await listSubmissionAttachmentsForApi(db, submissionId);

  if (sessionIsMissed(session)) {
    return buildMissedResultPayload(submission, session, attachments);
  }

  if (submission.status !== "published") {
    return null;
  }

  const row = await repo.getPublishedResultForSubmission(db, submissionId, userId);
  if (!row) return null;
  return buildPublishedResultPayload(db, row, session);
}

export async function getPublishedRegularResult(db: Db, grantId: string, submissionId: string) {
  const sub = await repo.getSubmissionByIdForGrant(db, submissionId, grantId);
  if (!sub) return null;
  await repo.lazyUnlockDueSessions(db, sub.courseId);
  const joined = await repo.getSubmissionWithSessionForGrant(db, submissionId, grantId);
  if (!joined) return null;
  const { submission, session } = joined;
  const attachments = await listSubmissionAttachmentsForApi(db, submissionId);

  if (sessionIsMissed(session)) {
    return buildMissedResultPayload(submission, session, attachments);
  }

  if (submission.status !== "published") {
    return null;
  }

  const row = await repo.getPublishedResultForSubmissionGrant(db, submissionId, grantId);
  if (!row) return null;
  return buildPublishedResultPayload(db, row, session);
}

/**
 * Student-first: owner sees published/missed same as before.
 * Teacher/admin may preview the same published-safe payload for any submission id (draft never returned).
 */
export async function getPublishedWritingResultForViewer(db: Db, viewerUserId: string, submissionId: string) {
  const asOwner = await getPublishedStudentResult(db, viewerUserId, submissionId);
  if (asOwner) return asOwner;

  const role = await resolveWritingRoleFromDbOrEnv(db, viewerUserId);
  if (role !== "teacher" && role !== "admin") return null;

  const first = await repo.getSubmissionWithSessionById(db, submissionId);
  if (!first) return null;
  await repo.lazyUnlockDueSessions(db, first.submission.courseId);
  const joined = await repo.getSubmissionWithSessionById(db, submissionId);
  if (!joined) return null;
  const { submission, session } = joined;
  const attachments = await listSubmissionAttachmentsForApi(db, submissionId);

  if (sessionIsMissed(session)) {
    const missed = await buildMissedResultPayload(submission, session, attachments);
    console.info(
      JSON.stringify({
        audit: "writing_results_staff_preview",
        viewerUserId,
        submissionId,
        role,
        outcome: missed.outcome,
        submissionStatus: submission.status,
        sessionRuntimeStatus: session.runtimeStatus,
      })
    );
    return missed;
  }

  if (submission.status !== "published") {
    if (process.env.WRITING_DEBUG_RESULTS === "true") {
      console.info(
        JSON.stringify({
          audit: "writing_results_staff_preview_denied_not_published",
          viewerUserId,
          submissionId,
          role,
          submissionStatus: submission.status,
          sessionRuntimeStatus: session.runtimeStatus,
        })
      );
    }
    return null;
  }

  const row = await repo.getPublishedResultForSubmissionStaffPreview(db, submissionId);
  if (!row) {
    if (process.env.WRITING_DEBUG_RESULTS === "true") {
      console.info(
        JSON.stringify({
          audit: "writing_results_staff_preview_denied_no_published_row",
          viewerUserId,
          submissionId,
          role,
          submissionStatus: submission.status,
          sessionRuntimeStatus: session.runtimeStatus,
          correctionStatus: null,
        })
      );
    }
    return null;
  }

  const published = await buildPublishedResultPayload(db, row, session);
  console.info(
    JSON.stringify({
      audit: "writing_results_staff_preview",
      viewerUserId,
      submissionId,
      role,
      outcome: published.outcome,
      submissionStatus: submission.status,
      sessionRuntimeStatus: session.runtimeStatus,
      correctionStatus: row.correction.status,
    })
  );
  return published;
}
