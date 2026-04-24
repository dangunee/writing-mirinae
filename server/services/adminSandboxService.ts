/**
 * Admin-only QA sandbox: preview student UX for trial / regular / academy without impersonation.
 * Context is server-validated; test submissions live in writing.admin_sandbox_test_submissions.
 * On submit, a mirror row is upserted into writing.submissions (submission_mode = admin_sandbox) so
 * the teacher correction flow (FK to writing.submissions) can run without schema changes.
 */

import { and, eq, sql } from "drizzle-orm";

import {
  adminSandboxAudit,
  adminSandboxContexts,
  adminSandboxTestSubmissions,
  type writingSessions,
  writingSubmissions,
} from "../../db/schema";

import type { Db } from "../db/client";
import { getPostgresErrorDetail, isPostgresUniqueViolation, pgErrMeta } from "../lib/postgresErrorGuards";
import { resolveWritingTrialCourseIdForAdmin } from "../lib/writingTrialCourseResolve";
import { checkSessionEligibleForAdminSandboxTest } from "../lib/writingSubmissionEligibility";
import * as repo from "../repositories/writingStudentRepository";

export type AdminSandboxMode = "trial" | "regular" | "academy";

/** Mirrors into writing.submissions.submission_mode so teacher queue/detail can detect QA rows. */
export const ADMIN_SANDBOX_SUBMISSION_MODE = "admin_sandbox";

const COOKIE_NAME = "writing_admin_sbx_ctx";

function sessionIsTerminalForProgression(status: string): boolean {
  return status === "completed" || status === "missed";
}

function parseCsvIds(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function sandboxTtlSeconds(): number {
  const raw = process.env.ADMIN_SANDBOX_TTL_SECONDS;
  const n = raw ? parseInt(raw, 10) : 8 * 60 * 60;
  return Number.isFinite(n) && n > 60 && n <= 86400 ? n : 8 * 60 * 60;
}

export function adminSandboxCookieName(): string {
  return COOKIE_NAME;
}

export function adminSandboxCookieMaxAgeSeconds(): number {
  return sandboxTtlSeconds();
}

/** Request Cookie header parsing (same value Next.js cookies() would expose for sbx ctx). */
export function parseAdminSandboxContextIdFromCookieHeader(
  cookieHeader: string | null | undefined
): string | null {
  if (!cookieHeader?.trim()) return null;
  const prefix = `${COOKIE_NAME}=`;
  const segments = cookieHeader.split(";");
  for (const seg of segments) {
    const s = seg.trim();
    if (!s.startsWith(prefix)) continue;
    const raw = s.slice(prefix.length);
    try {
      const v = decodeURIComponent(raw).trim();
      return v.length > 0 ? v : null;
    } catch {
      return raw.trim() || null;
    }
  }
  return null;
}

/**
 * Validates mode + course + session against DB and env. Never trusts client without re-fetching rows.
 */
export async function validateAdminSandboxSelection(
  db: Db,
  input: { mode: AdminSandboxMode; courseId: string; sessionId: string }
): Promise<
  | { ok: true }
  | { ok: false; code: string }
> {
  const trialCourseIdResolved = await resolveWritingTrialCourseIdForAdmin(db);

  const row = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!row || row.session.courseId !== input.courseId) {
    return { ok: false, code: "session_not_found" };
  }

  const course = row.course;

  if (input.mode === "trial") {
    if (!trialCourseIdResolved || course.id !== trialCourseIdResolved) {
      return { ok: false, code: "trial_course_mismatch" };
    }
    /** Align with admin assignment list: trial authoring course may be pending_setup until schedule finalizes. */
    if (course.status !== "active" && course.status !== "pending_setup") {
      return { ok: false, code: "course_not_active" };
    }
    return { ok: true };
  }

  if (course.status !== "active") {
    return { ok: false, code: "course_not_active" };
  }

  if (input.mode === "regular") {
    if (course.isAdminSandbox) {
      return { ok: false, code: "invalid_course_for_mode" };
    }
    if (trialCourseIdResolved && course.id === trialCourseIdResolved) {
      return { ok: false, code: "invalid_course_for_mode" };
    }
    const allowIds = parseCsvIds(process.env.ADMIN_SANDBOX_REGULAR_ALLOWED_COURSE_IDS);
    if (allowIds.size > 0 && !allowIds.has(course.id)) {
      return { ok: false, code: "course_not_allowlisted" };
    }
    return { ok: true };
  }

  // academy
  const academyIds = parseCsvIds(process.env.ADMIN_SANDBOX_ACADEMY_COURSE_IDS);
  if (academyIds.size > 0 && academyIds.has(course.id)) {
    return { ok: true };
  }
  if (course.termId != null) {
    return { ok: true };
  }
  return { ok: false, code: "academy_course_invalid" };
}

export type AdminSandboxSessionJson = {
  ok: true;
  accessKind: "admin_sandbox";
  sandboxMode: AdminSandboxMode;
  courseId: string;
  mode: "pipeline" | "fresh" | "all_done";
  session: {
    id: string;
    courseId: string;
    index: number;
    unlockAt: string;
    status: string;
    themeSnapshot: string | null;
    runtimeStatus: string | null;
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
  /** Marks API response for client banner */
  adminSandbox: {
    contextExpiresAt: string;
    isTestSubmission: boolean;
  };
};

function sessionDto(
  s: Pick<
    typeof writingSessions.$inferSelect,
    | "id"
    | "courseId"
    | "index"
    | "unlockAt"
    | "status"
    | "themeSnapshot"
    | "runtimeStatus"
  >
) {
  return {
    id: s.id,
    courseId: s.courseId,
    index: s.index,
    unlockAt: s.unlockAt.toISOString(),
    status: s.status,
    themeSnapshot: s.themeSnapshot ?? null,
    runtimeStatus: s.runtimeStatus ?? null,
  };
}

/** Build GET /sessions/current payload for a validated admin sandbox context row. */
export async function buildAdminSandboxCurrentSessionResponse(
  db: Db,
  ctx: typeof adminSandboxContexts.$inferSelect
): Promise<AdminSandboxSessionJson | null> {
  console.time("[sandbox] buildAdminSandboxCurrentSessionResponse");
  try {
    const now = new Date();
    if (ctx.expiresAt <= now) {
      return null;
    }

    const row = await repo.getSessionByIdWithCourse(db, ctx.sessionId);
    if (!row || row.course.id !== ctx.courseId) {
      return null;
    }

    const v = await validateAdminSandboxSelection(db, {
      mode: ctx.mode as AdminSandboxMode,
      courseId: ctx.courseId,
      sessionId: ctx.sessionId,
    });
    if (!v.ok) {
      return null;
    }

    const courseId = ctx.courseId;
    const sessions = await repo.listSessionsForCourseOrdered(db, courseId);
  const target = sessions.find((s) => s.id === ctx.sessionId);
  if (!target) {
    return null;
  }

  const lower = sessions.filter((x) => x.index < target.index);
  if (!lower.every((x) => sessionIsTerminalForProgression(x.status))) {
    const blocker = lower.find((x) => !sessionIsTerminalForProgression(x.status));
    return {
      ok: true,
      accessKind: "admin_sandbox",
      sandboxMode: ctx.mode as AdminSandboxMode,
      courseId,
      mode: "fresh",
      session: sessionDto(target),
      submission: null,
      canSubmit: false,
      reasonIfNot: blocker ? "complete_previous_sessions_first" : "complete_previous_sessions_first",
      adminSandbox: {
        contextExpiresAt: ctx.expiresAt.toISOString(),
        isTestSubmission: true,
      },
    };
  }

  const elig = checkSessionEligibleForAdminSandboxTest(target, now);
  if (!elig.ok) {
    return {
      ok: true,
      accessKind: "admin_sandbox",
      sandboxMode: ctx.mode as AdminSandboxMode,
      courseId,
      mode: "fresh",
      session: sessionDto(target),
      submission: null,
      canSubmit: false,
      reasonIfNot: elig.code,
      adminSandbox: {
        contextExpiresAt: ctx.expiresAt.toISOString(),
        isTestSubmission: true,
      },
    };
  }

  const [testRow] = await db
    .select()
    .from(adminSandboxTestSubmissions)
    .where(
      and(
        eq(adminSandboxTestSubmissions.adminUserId, ctx.adminUserId),
        eq(adminSandboxTestSubmissions.sessionId, ctx.sessionId)
      )
    )
    .limit(1);

  const submission =
    testRow != null
      ? {
          id: testRow.id,
          status: testRow.status,
          bodyText: testRow.bodyText ?? null,
          imageStorageKey: null as string | null,
          imageMimeType: null as string | null,
          submittedAt: testRow.submittedAt?.toISOString() ?? null,
        }
      : null;

  const canSubmit =
    !testRow || testRow.status === "draft"
      ? true
      : false;

  return {
    ok: true,
    accessKind: "admin_sandbox",
    sandboxMode: ctx.mode as AdminSandboxMode,
    courseId,
    mode: testRow ? "pipeline" : "fresh",
    session: sessionDto(target),
    submission,
    canSubmit,
    reasonIfNot: canSubmit
      ? undefined
      : "sandbox_test_already_submitted",
    adminSandbox: {
      contextExpiresAt: ctx.expiresAt.toISOString(),
      isTestSubmission: true,
    },
  };
  } finally {
    console.timeEnd("[sandbox] buildAdminSandboxCurrentSessionResponse");
  }
}

export async function loadAdminSandboxContextById(
  db: Db,
  contextId: string,
  adminUserId: string
): Promise<typeof adminSandboxContexts.$inferSelect | null> {
  console.time("[sandbox] loadAdminSandboxContextById");
  try {
    const [row] = await db
      .select()
      .from(adminSandboxContexts)
      .where(eq(adminSandboxContexts.id, contextId))
      .limit(1);
    if (!row || row.adminUserId !== adminUserId) {
      return null;
    }
    if (row.expiresAt <= new Date()) {
      return null;
    }
    return row;
  } finally {
    console.timeEnd("[sandbox] loadAdminSandboxContextById");
  }
}

export async function upsertAdminSandboxContext(
  db: Db,
  input: {
    adminUserId: string;
    mode: AdminSandboxMode;
    courseId: string;
    sessionId: string;
    termId: string | null;
  }
): Promise<{ contextId: string; expiresAt: Date }> {
  const now = new Date();
  const ttlMs = sandboxTtlSeconds() * 1000;
  const expiresAt = new Date(now.getTime() + ttlMs);

  const [existing] = await db
    .select({ id: adminSandboxContexts.id })
    .from(adminSandboxContexts)
    .where(eq(adminSandboxContexts.adminUserId, input.adminUserId))
    .limit(1);

  if (existing) {
    await db
      .update(adminSandboxContexts)
      .set({
        mode: input.mode,
        courseId: input.courseId,
        sessionId: input.sessionId,
        termId: input.termId,
        expiresAt,
      })
      .where(eq(adminSandboxContexts.id, existing.id));
    return { contextId: existing.id, expiresAt };
  }

  const [ins] = await db
    .insert(adminSandboxContexts)
    .values({
      adminUserId: input.adminUserId,
      mode: input.mode,
      courseId: input.courseId,
      sessionId: input.sessionId,
      termId: input.termId,
      expiresAt,
    })
    .returning({ id: adminSandboxContexts.id, expiresAt: adminSandboxContexts.expiresAt });
  return { contextId: ins.id, expiresAt: ins.expiresAt };
}

export async function deleteAdminSandboxContextByAdmin(db: Db, adminUserId: string): Promise<void> {
  await db.delete(adminSandboxContexts).where(eq(adminSandboxContexts.adminUserId, adminUserId));
}

export async function appendAdminSandboxAudit(
  db: Db,
  row: {
    adminUserId: string;
    action: string;
    mode?: string | null;
    courseId?: string | null;
    sessionId?: string | null;
    success?: boolean;
    detail?: Record<string, unknown> | null;
  }
): Promise<void> {
  await db.insert(adminSandboxAudit).values({
    adminUserId: row.adminUserId,
    action: row.action,
    mode: row.mode ?? null,
    courseId: row.courseId ?? null,
    sessionId: row.sessionId ?? null,
    success: row.success ?? true,
    detail: row.detail ?? null,
  });
}

export type AdminSandboxSubmissionResult =
  | { ok: true; submissionId: string; status: string; alreadySubmitted?: boolean }
  | { ok: false; status: number; code: string };

/** Result of mirroring `admin_sandbox_test_submissions` → `writing.submissions` (teacher FK). */
export type SandboxMirrorSyncResult =
  | { outcome: "skipped_not_submitted"; sandboxTestId: string; sessionId: string }
  | {
      outcome: "skipped_missing_session";
      sandboxTestId: string;
      sessionId: string;
      reason: "session_not_found" | "course_mismatch";
    }
  | { outcome: "updated"; sandboxTestId: string; sessionId: string; writingSubmissionId: string }
  | { outcome: "created"; sandboxTestId: string; sessionId: string; writingSubmissionId: string }
  | {
      outcome: "skipped_conflict";
      sandboxTestId: string;
      sessionId: string;
      existingSubmissionId: string;
      existingSubmissionMode: string | null;
      existingUserId: string | null;
    }
  | { outcome: "skipped_unique_violation"; sandboxTestId: string; sessionId: string; adminUserId: string; detail?: string }
  | {
      outcome: "failed";
      sandboxTestId: string;
      sessionId: string;
      phase: "session_lookup" | "select_existing" | "update" | "insert" | "unexpected";
      message: string;
      pgCode?: string;
    }
  | { outcome: "skipped_no_test_row"; adminSandboxSubmissionId: string };

function logAdminSandboxMirrorSyncFailed(
  e: unknown,
  r: Extract<SandboxMirrorSyncResult, { outcome: "failed" }>
): void {
  console.error("admin_sandbox_mirror_sync_failed", {
    outcome: "failed" as const,
    sandboxTestId: r.sandboxTestId,
    sessionId: r.sessionId,
    phase: r.phase,
    message: r.message,
    pgCode: r.pgCode,
    error: e,
  });
}

/**
 * Ensures a writing.submissions row exists for this sandbox test row so corrections can attach (FK).
 * Skips if another (non-sandbox) submission already occupies the session.
 * Does not throw; inspect `outcome` and server logs. Mirror insert uses explicit SQL columns (not
 * `db.insert(writingSubmissions)`) so Postgres never sees `grammar_check_result` (absent on some prod DBs).
 */
export async function syncAdminSandboxTestRowToWritingSubmission(
  db: Db,
  testRow: typeof adminSandboxTestSubmissions.$inferSelect
): Promise<SandboxMirrorSyncResult> {
  const sandboxTestId = testRow.id;
  const sessionId = testRow.sessionId;

  if (testRow.status !== "submitted") {
    const r: SandboxMirrorSyncResult = { outcome: "skipped_not_submitted", sandboxTestId, sessionId };
    console.warn("admin_sandbox_mirror_sync", r);
    return r;
  }

  try {
    const sessionRow = await repo.getSessionByIdWithCourse(db, testRow.sessionId);
    if (!sessionRow) {
      const r: SandboxMirrorSyncResult = {
        outcome: "skipped_missing_session",
        sandboxTestId,
        sessionId,
        reason: "session_not_found",
      };
      console.warn("admin_sandbox_mirror_sync", r);
      return r;
    }
    if (sessionRow.course.id !== testRow.courseId) {
      const r: SandboxMirrorSyncResult = {
        outcome: "skipped_missing_session",
        sandboxTestId,
        sessionId,
        reason: "course_mismatch",
      };
      console.warn("admin_sandbox_mirror_sync", r);
      return r;
    }
  } catch (e) {
    const { message, pgCode } = pgErrMeta(e);
    const r: SandboxMirrorSyncResult = {
      outcome: "failed",
      sandboxTestId,
      sessionId,
      phase: "session_lookup",
      message,
      pgCode,
    };
    logAdminSandboxMirrorSyncFailed(e, r);
    return r;
  }

  let existingForSession: { id: string; userId: string | null; submissionMode: string | null } | undefined;
  try {
    const rows = await db
      .select({
        id: writingSubmissions.id,
        userId: writingSubmissions.userId,
        submissionMode: writingSubmissions.submissionMode,
      })
      .from(writingSubmissions)
      .where(eq(writingSubmissions.sessionId, testRow.sessionId))
      .limit(1);
    existingForSession = rows[0];
  } catch (e) {
    const { message, pgCode } = pgErrMeta(e);
    const r: SandboxMirrorSyncResult = {
      outcome: "failed",
      sandboxTestId,
      sessionId,
      phase: "select_existing",
      message,
      pgCode,
    };
    logAdminSandboxMirrorSyncFailed(e, r);
    return r;
  }

  const now = new Date();
  const submittedAt = testRow.submittedAt ?? now;

  if (existingForSession) {
    if (
      existingForSession.submissionMode === ADMIN_SANDBOX_SUBMISSION_MODE &&
      existingForSession.userId === testRow.adminUserId
    ) {
      try {
        await db.execute(sql`
          update writing.submissions
          set
            body_text = ${testRow.bodyText},
            course_id = ${testRow.courseId}::uuid,
            updated_at = ${now}
          where id = ${existingForSession.id}::uuid
        `);
        const r: SandboxMirrorSyncResult = {
          outcome: "updated",
          sandboxTestId,
          sessionId,
          writingSubmissionId: existingForSession.id,
        };
        console.info("admin_sandbox_mirror_sync", r);
        return r;
      } catch (e) {
        const { message, pgCode } = pgErrMeta(e);
        const r: SandboxMirrorSyncResult = {
          outcome: "failed",
          sandboxTestId,
          sessionId,
          phase: "update",
          message,
          pgCode,
        };
        logAdminSandboxMirrorSyncFailed(e, r);
        return r;
      }
    }
    const r: SandboxMirrorSyncResult = {
      outcome: "skipped_conflict",
      sandboxTestId,
      sessionId,
      existingSubmissionId: existingForSession.id,
      existingSubmissionMode: existingForSession.submissionMode,
      existingUserId: existingForSession.userId,
    };
    console.warn("admin_sandbox_mirror_sync", r);
    return r;
  }

  try {
    const insertRows = await db.execute(sql`
      insert into writing.submissions (
        session_id,
        course_id,
        user_id,
        regular_access_grant_id,
        trial_application_id,
        status,
        submission_mode,
        body_text,
        image_storage_key,
        image_mime_type,
        submitted_at
      )
      values (
        ${testRow.sessionId}::uuid,
        ${testRow.courseId}::uuid,
        ${testRow.adminUserId}::uuid,
        null,
        null,
        'submitted',
        ${ADMIN_SANDBOX_SUBMISSION_MODE},
        ${testRow.bodyText},
        null,
        null,
        ${submittedAt}
      )
      returning id
    `);
    const writingSubmissionId = (insertRows[0] as { id: string } | undefined)?.id;
    if (!writingSubmissionId) {
      const err = new Error("insert_returned_no_id");
      const r: SandboxMirrorSyncResult = {
        outcome: "failed",
        sandboxTestId,
        sessionId,
        phase: "insert",
        message: err.message,
      };
      logAdminSandboxMirrorSyncFailed(err, r);
      return r;
    }
    const r: SandboxMirrorSyncResult = { outcome: "created", sandboxTestId, sessionId, writingSubmissionId };
    console.info("admin_sandbox_mirror_sync", r);
    return r;
  } catch (e) {
    if (isPostgresUniqueViolation(e)) {
      const r: SandboxMirrorSyncResult = {
        outcome: "skipped_unique_violation",
        sandboxTestId,
        sessionId,
        adminUserId: testRow.adminUserId,
        detail: getPostgresErrorDetail(e),
      };
      console.warn("admin_sandbox_mirror_sync", r);
      return r;
    }
    const { message, pgCode } = pgErrMeta(e);
    const r: SandboxMirrorSyncResult = {
      outcome: "failed",
      sandboxTestId,
      sessionId,
      phase: "insert",
      message,
      pgCode,
    };
    logAdminSandboxMirrorSyncFailed(e, r);
    return r;
  }
}

/** Best-effort mirror sync after sandbox persist (does not fail the HTTP handler). */
export async function trySyncSandboxMirrorBySubmissionId(
  db: Db,
  adminSandboxSubmissionId: string
): Promise<SandboxMirrorSyncResult> {
  try {
    const [row] = await db
      .select()
      .from(adminSandboxTestSubmissions)
      .where(eq(adminSandboxTestSubmissions.id, adminSandboxSubmissionId))
      .limit(1);
    if (!row) {
      const r: SandboxMirrorSyncResult = { outcome: "skipped_no_test_row", adminSandboxSubmissionId };
      console.warn("admin_sandbox_mirror_sync", r);
      return r;
    }
    if (row.status !== "submitted") {
      const r: SandboxMirrorSyncResult = {
        outcome: "skipped_not_submitted",
        sandboxTestId: row.id,
        sessionId: row.sessionId,
      };
      console.warn("admin_sandbox_mirror_sync", r);
      return r;
    }
    return await syncAdminSandboxTestRowToWritingSubmission(db, row);
  } catch (e) {
    const { message, pgCode } = pgErrMeta(e);
    const r: SandboxMirrorSyncResult = {
      outcome: "failed",
      sandboxTestId: adminSandboxSubmissionId,
      sessionId: "",
      phase: "unexpected",
      message: `trySync_unexpected: ${message}`,
      pgCode,
    };
    logAdminSandboxMirrorSyncFailed(e, r);
    return r;
  }
}

/**
 * Called when loading the teacher queue so older sandbox submits get a mirror without re-submit.
 * Never throws: failures (missing table, DB errors, etc.) must not break the teacher queue response.
 */
export async function backfillSubmittedAdminSandboxMirrors(db: Db): Promise<void> {
  try {
    const rows = await db
      .select()
      .from(adminSandboxTestSubmissions)
      .where(eq(adminSandboxTestSubmissions.status, "submitted"));
    for (const testRow of rows) {
      const result = await syncAdminSandboxTestRowToWritingSubmission(db, testRow);
      console.info("admin_sandbox_mirror_backfill_row", {
        sandboxTestId: testRow.id,
        sessionId: testRow.sessionId,
        mirror: result,
      });
    }
  } catch (e) {
    console.warn("admin_sandbox_backfill_unavailable", { err: e });
  }
}

/**
 * Destructive QA reset: removes the admin's sandbox test row and the mirrored writing.submissions row
 * for the given session only. Guards: submission_mode must be admin_sandbox and user_id must match.
 * Does not modify writing.sessions (shared with real learners) or sandbox context cookie.
 */
export async function resetAdminSandboxSessionSubmissions(
  db: Db,
  input: { adminUserId: string; sessionId: string }
): Promise<{ ok: true } | { ok: false; code: string }> {
  const sessionId = input.sessionId?.trim();
  if (!sessionId) return { ok: false, code: "invalid_session" };

  const sessionRow = await repo.getSessionByIdWithCourse(db, sessionId);
  if (!sessionRow) return { ok: false, code: "session_not_found" };

  await db
    .delete(writingSubmissions)
    .where(
      and(
        eq(writingSubmissions.sessionId, sessionId),
        eq(writingSubmissions.userId, input.adminUserId),
        eq(writingSubmissions.submissionMode, ADMIN_SANDBOX_SUBMISSION_MODE)
      )
    );

  await db
    .delete(adminSandboxTestSubmissions)
    .where(
      and(
        eq(adminSandboxTestSubmissions.adminUserId, input.adminUserId),
        eq(adminSandboxTestSubmissions.sessionId, sessionId)
      )
    );

  return { ok: true };
}

async function syncMirrorAfterSandboxSubmit(
  db: Db,
  adminSandboxTestSubmissionId: string,
  sessionId: string,
  adminUserId: string
): Promise<void> {
  const mirror = await trySyncSandboxMirrorBySubmissionId(db, adminSandboxTestSubmissionId);
  console.info("admin_sandbox_submit_mirror_result", {
    adminSandboxTestSubmissionId,
    sessionId,
    adminUserId,
    mirror,
  });
}

export function sandboxSubmitErrorMessage(code: string): string {
  const map: Record<string, string> = {
    session_missed: "この回は失効済みのため、サンドボックス提出できません。",
    session_locked: "この回はまだ開始できません（解除日時前）。",
    session_expired: "提出期限を過ぎています。",
    sandbox_already_submitted: "既にサンドボックス提出済みです。GET /sessions/current で状態を確認してください。",
    sandbox_submit_unexpected: "サンドボックス提出の処理中にエラーが発生しました。",
    sandbox_insert_race: "同時更新のため保存できませんでした。再度お試しください。",
  };
  return map[code] ?? `サンドボックス提出を処理できません (${code})`;
}

/** Persist QA text only; isolated table. */
export async function writeAdminSandboxTestSubmission(
  db: Db,
  input: {
    adminUserId: string;
    mode: AdminSandboxMode;
    courseId: string;
    sessionId: string;
    action: "save" | "submit";
    bodyText: string | null;
    /** Must match an active admin_sandbox_contexts row */
    contextValid: boolean;
  }
): Promise<AdminSandboxSubmissionResult> {
  if (!input.contextValid) {
    console.warn("admin_sandbox_submit_context_invalid", { sessionId: input.sessionId });
    return { ok: false, status: 403, code: "sandbox_context_invalid" };
  }

  const v = await validateAdminSandboxSelection(db, {
    mode: input.mode,
    courseId: input.courseId,
    sessionId: input.sessionId,
  });
  if (!v.ok) {
    console.warn("admin_sandbox_submit_validation_failed", { code: v.code, sessionId: input.sessionId });
    return { ok: false, status: 400, code: v.code };
  }

  const row = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!row || row.course.id !== input.courseId) {
    console.warn("admin_sandbox_submit_session_not_found", { sessionId: input.sessionId, courseId: input.courseId });
    return { ok: false, status: 404, code: "session_not_found" };
  }

  const now = new Date();

  const [existing] = await db
    .select({ id: adminSandboxTestSubmissions.id })
    .from(adminSandboxTestSubmissions)
    .where(
      and(
        eq(adminSandboxTestSubmissions.adminUserId, input.adminUserId),
        eq(adminSandboxTestSubmissions.sessionId, input.sessionId)
      )
    )
    .limit(1);

  if (existing) {
    const [cur] = await db
      .select()
      .from(adminSandboxTestSubmissions)
      .where(eq(adminSandboxTestSubmissions.id, existing.id))
      .limit(1);
    if (cur && cur.status === "submitted" && input.action === "submit") {
      console.info("admin_sandbox_submit_idempotent", {
        submissionId: cur.id,
        sessionId: input.sessionId,
        adminUserId: input.adminUserId,
      });
      await syncMirrorAfterSandboxSubmit(db, cur.id, input.sessionId, input.adminUserId);
      return {
        ok: true,
        submissionId: cur.id,
        status: "submitted",
        alreadySubmitted: true,
      };
    }
    if (cur && cur.status === "submitted" && input.action === "save") {
      console.warn("admin_sandbox_submit_draft_after_submitted", { submissionId: cur.id, sessionId: input.sessionId });
      return { ok: false, status: 409, code: "sandbox_already_submitted" };
    }
  }

  const elig = checkSessionEligibleForAdminSandboxTest(row.session, now);
  if (!elig.ok) {
    console.warn("admin_sandbox_submit_eligibility_blocked", {
      code: elig.code,
      sessionId: input.sessionId,
      runtimeStatus: row.session.runtimeStatus,
      status: row.session.status,
    });
    return { ok: false, status: 409, code: elig.code };
  }

  const status = input.action === "submit" ? "submitted" : "draft";
  const submittedAt = input.action === "submit" ? now : null;

  if (existing) {
    await db
      .update(adminSandboxTestSubmissions)
      .set({
        bodyText: input.bodyText,
        status,
        submittedAt,
        sandboxMode: input.mode,
        updatedAt: now,
      })
      .where(eq(adminSandboxTestSubmissions.id, existing.id));
    if (status === "submitted") {
      await syncMirrorAfterSandboxSubmit(db, existing.id, input.sessionId, input.adminUserId);
    }
    return { ok: true, submissionId: existing.id, status };
  }

  try {
    const [ins] = await db
      .insert(adminSandboxTestSubmissions)
      .values({
        adminUserId: input.adminUserId,
        courseId: input.courseId,
        sessionId: input.sessionId,
        sandboxMode: input.mode,
        bodyText: input.bodyText,
        status,
        submittedAt,
      })
      .returning({ id: adminSandboxTestSubmissions.id });
    if (status === "submitted") {
      await syncMirrorAfterSandboxSubmit(db, ins.id, input.sessionId, input.adminUserId);
    }
    return { ok: true, submissionId: ins.id, status };
  } catch (e) {
    if (isPostgresUniqueViolation(e)) {
      const [cur] = await db
        .select()
        .from(adminSandboxTestSubmissions)
        .where(
          and(
            eq(adminSandboxTestSubmissions.adminUserId, input.adminUserId),
            eq(adminSandboxTestSubmissions.sessionId, input.sessionId)
          )
        )
        .limit(1);
      if (cur?.status === "submitted" && input.action === "submit") {
        console.info("admin_sandbox_submit_idempotent_after_race", { submissionId: cur.id, sessionId: input.sessionId });
        await syncMirrorAfterSandboxSubmit(db, cur.id, input.sessionId, input.adminUserId);
        return {
          ok: true,
          submissionId: cur.id,
          status: "submitted",
          alreadySubmitted: true,
        };
      }
      console.warn("admin_sandbox_submit_unique_race", { sessionId: input.sessionId, err: e });
      return { ok: false, status: 409, code: "sandbox_insert_race" };
    }
    console.error("admin_sandbox_submit_unexpected", { sessionId: input.sessionId, err: e });
    return { ok: false, status: 500, code: "sandbox_submit_unexpected" };
  }
}
