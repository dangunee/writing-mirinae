/**
 * Admin-only QA sandbox: preview student UX for trial / regular / academy without impersonation.
 * Context is server-validated; test submissions live in writing.admin_sandbox_test_submissions (not writing.submissions).
 */

import { and, eq } from "drizzle-orm";

import {
  adminSandboxAudit,
  adminSandboxContexts,
  adminSandboxTestSubmissions,
  type writingSessions,
} from "../../db/schema";
import type { Db } from "../db/client";
import { checkSessionEligibleForWriting } from "../lib/writingSubmissionEligibility";
import * as repo from "../repositories/writingStudentRepository";

export type AdminSandboxMode = "trial" | "regular" | "academy";

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
  const trialCourseId = process.env.WRITING_TRIAL_COURSE_ID?.trim() ?? "";

  const row = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!row || row.session.courseId !== input.courseId) {
    return { ok: false, code: "session_not_found" };
  }

  const course = row.course;
  if (course.status !== "active") {
    return { ok: false, code: "course_not_active" };
  }

  if (input.mode === "trial") {
    if (!trialCourseId || course.id !== trialCourseId) {
      return { ok: false, code: "trial_course_mismatch" };
    }
    return { ok: true };
  }

  if (input.mode === "regular") {
    if (course.isAdminSandbox) {
      return { ok: false, code: "invalid_course_for_mode" };
    }
    if (trialCourseId && course.id === trialCourseId) {
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

  const elig = checkSessionEligibleForWriting(target, now);
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
}

export async function loadAdminSandboxContextById(
  db: Db,
  contextId: string,
  adminUserId: string
): Promise<typeof adminSandboxContexts.$inferSelect | null> {
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
  | { ok: true; submissionId: string; status: string }
  | { ok: false; status: number; code: string };

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
    return { ok: false, status: 403, code: "sandbox_context_invalid" };
  }

  const v = await validateAdminSandboxSelection(db, {
    mode: input.mode,
    courseId: input.courseId,
    sessionId: input.sessionId,
  });
  if (!v.ok) {
    return { ok: false, status: 400, code: v.code };
  }

  const row = await repo.getSessionByIdWithCourse(db, input.sessionId);
  if (!row || row.course.id !== input.courseId) {
    return { ok: false, status: 404, code: "session_not_found" };
  }
  const now = new Date();
  const elig = checkSessionEligibleForWriting(row.session, now);
  if (!elig.ok) {
    return { ok: false, status: 409, code: elig.code };
  }

  const status =
    input.action === "submit"
      ? "submitted"
      : "draft";
  const submittedAt = input.action === "submit" ? now : null;

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
      return { ok: false, status: 409, code: "submission_not_editable" };
    }
    if (cur && cur.status === "submitted" && input.action === "save") {
      return { ok: false, status: 409, code: "submission_not_editable" };
    }
  }

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
    return { ok: true, submissionId: existing.id, status };
  }

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
  return { ok: true, submissionId: ins.id, status };
}
