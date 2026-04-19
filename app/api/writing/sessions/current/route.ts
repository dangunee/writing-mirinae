import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { parseRegularWritingGrantIdFromCookieHeader } from "../../../../../server/lib/regularSessionCookie";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { resolveWritingRoleFromDbOrEnv } from "../../../../../server/lib/writingAuthRoles";
import { ensureAdminSandboxCourse } from "../../../../../server/services/adminSandboxProvisionService";
import {
  adminSandboxCookieName,
  buildAdminSandboxCurrentSessionResponse,
  loadAdminSandboxContextById,
  parseAdminSandboxContextIdFromCookieHeader,
} from "../../../../../server/services/adminSandboxService";
import { advanceRegularGrantToNextCourseIfNeeded } from "../../../../../server/services/regularGrantAdvanceService";
import {
  getCurrentSessionForAdminSandbox,
  getCurrentSessionForRegularGrant,
  getCurrentSessionForStudent,
  getCurrentSessionForTrialApplication,
} from "../../../../../server/services/writingStudentService";
import type { AuthRole } from "../../../../../server/lib/authMe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mirinaeApiBase(): string | null {
  const base = process.env.MIRINAE_API_BASE_URL?.trim();
  if (!base) return null;
  return base.replace(/\/$/, "");
}

async function tryTrialSessionFromCookie(req: Request, db: ReturnType<typeof getDb>) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const trialBase = mirinaeApiBase();
  if (!trialBase || !cookieHeader.includes("writing_trial_access=")) {
    return null;
  }
  try {
    const upstream = await fetch(`${trialBase}/api/writing/trial/session/current`, {
      headers: { Cookie: cookieHeader },
    });
    if (!upstream.ok) {
      return null;
    }
    const j = (await upstream.json()) as {
      ok?: boolean;
      application?: { id?: string; accessExpiresAt?: string | null };
    };
    if (j?.ok === true && j.application?.id) {
      const applicationId = j.application.id;
      const accessExpiresAt = j.application.accessExpiresAt ?? null;
      const trialCourseId = process.env.WRITING_TRIAL_COURSE_ID?.trim();
      if (trialCourseId) {
        const trialSession = await getCurrentSessionForTrialApplication(db, applicationId);
        if (trialSession.ok === true && trialSession.accessKind === "trial") {
          return NextResponse.json({
            ...trialSession,
            accessExpiresAt: accessExpiresAt ?? trialSession.accessExpiresAt,
          });
        }
      }
      /**
       * Upstream validated writing_trial_access; DB course row may lag or env unset.
       * Still return 200 + ok:true so EntitlementRouteGuard allows /writing/app (WritingPage handles partial trial).
       * Include `courseId` when WRITING_TRIAL_COURSE_ID is set so the client can keep state (theme UI wiring).
       */
      return NextResponse.json({
        ok: true,
        accessKind: "trial" as const,
        applicationId,
        ...(trialCourseId ? { courseId: trialCourseId } : {}),
        accessExpiresAt,
        mode: "fresh" as const,
        session: null,
        submission: null,
        canSubmit: false,
        reasonIfNot: "trial_session_pending",
      });
    }
  } catch (e) {
    console.warn("sessions_current_trial_upstream", e);
  }
  return null;
}

/**
 * GET /api/writing/sessions/current
 * Identity: Supabase session (student) → trial cookie (upstream) → regular mail-link cookie.
 * If logged in but no platform course, still try trial / regular grant (trial mail users may be logged in).
 */
export async function GET(req: Request) {
  const tStart = performance.now();
  const logEnd = (branch: string, extra?: Record<string, unknown>) => {
    const ms = Math.round(performance.now() - tStart);
    console.log("[sessions/current] end", { branch, totalMs: ms, ...extra });
  };

  console.log("[sessions/current] start");
  console.time("sessions/current_total");

  try {
    const db = getDb();
    const cookieHeader = req.headers.get("cookie") ?? "";

    const sbxIdFromHeader = parseAdminSandboxContextIdFromCookieHeader(cookieHeader);
    if (sbxIdFromHeader) {
      console.log("[sessions/current] sandbox_cookie_present", {
        name: adminSandboxCookieName(),
      });
    }

    const userId = await getSessionUserId();
    let studentError: string | undefined;
    /** DB `writing.user_roles` + ADMIN_USER_IDS env — must match all admin branches (sandbox + fallback). */
    let resolvedRole: AuthRole | undefined;

    if (userId) {
      const tRole = performance.now();
      resolvedRole = await resolveWritingRoleFromDbOrEnv(db, userId);
      console.log("[sessions/current] branch=resolve_role", {
        ms: Math.round(performance.now() - tRole),
        role: resolvedRole,
      });

      // Admin + sandbox cookie: resolve sandbox only — do not call getCurrentSessionForStudent first.
      if (resolvedRole === "admin" && sbxIdFromHeader) {
        try {
          const tSbx = performance.now();
          const ctx = await loadAdminSandboxContextById(db, sbxIdFromHeader, userId);
          console.log("[sessions/current] branch=admin_sandbox_load_ctx", {
            ms: Math.round(performance.now() - tSbx),
            hasCtx: !!ctx,
          });
          if (!ctx) {
            console.warn("sessions_current_admin_sandbox_ctx_missing_or_expired", {
              userId,
              contextIdPrefix: sbxIdFromHeader.slice(0, 8),
            });
            logEnd("admin_sandbox_error", { code: "sandbox_context_missing_or_expired" });
            return NextResponse.json(
              {
                ok: false as const,
                accessKind: "admin_sandbox" as const,
                code: "sandbox_context_missing_or_expired",
              },
              { status: 200 }
            );
          }
          const tBuild = performance.now();
          const json = await buildAdminSandboxCurrentSessionResponse(db, ctx);
          console.log("[sessions/current] branch=admin_sandbox_build", {
            ms: Math.round(performance.now() - tBuild),
            ok: !!json,
          });
          if (!json) {
            console.warn("sessions_current_admin_sandbox_build_null", {
              userId,
              contextIdPrefix: sbxIdFromHeader.slice(0, 8),
              sessionId: ctx.sessionId,
            });
            logEnd("admin_sandbox_error", { code: "sandbox_context_invalid_or_stale" });
            return NextResponse.json(
              {
                ok: false as const,
                accessKind: "admin_sandbox" as const,
                code: "sandbox_context_invalid_or_stale",
              },
              { status: 200 }
            );
          }
          logEnd("admin_sandbox_ok");
          return NextResponse.json(json);
        } catch (e) {
          console.error("sessions_current_admin_sandbox_unhandled", {
            userId,
            err: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
          });
          logEnd("admin_sandbox_error", { code: "sandbox_resolution_failed" });
          return NextResponse.json(
            {
              ok: false as const,
              accessKind: "admin_sandbox" as const,
              code: "sandbox_resolution_failed",
            },
            { status: 200 }
          );
        }
      }

      const tStudent = performance.now();
      const result = await getCurrentSessionForStudent(db, userId);
      console.log("[sessions/current] branch=student", {
        ms: Math.round(performance.now() - tStudent),
        ok: result.ok,
      });
      if (result.ok) {
        logEnd("student_ok");
        return NextResponse.json(result);
      }
      studentError = "error" in result ? String(result.error) : "no_active_course";
    }

    const tTrial = performance.now();
    const trialRes = await tryTrialSessionFromCookie(req, db);
    console.log("[sessions/current] branch=trial", {
      ms: Math.round(performance.now() - tTrial),
      hit: !!trialRes,
    });
    if (trialRes) {
      logEnd("trial_ok");
      return trialRes;
    }

    const grantId = parseRegularWritingGrantIdFromCookieHeader(cookieHeader);
    const tGrant = performance.now();
    if (grantId) {
      const advance = await advanceRegularGrantToNextCourseIfNeeded(db, grantId);
      const result = await getCurrentSessionForRegularGrant(db, grantId);
      console.log("[sessions/current] branch=grant", {
        ms: Math.round(performance.now() - tGrant),
        ok: result.ok,
      });
      if (!result.ok) {
        logEnd("grant_denied");
        return NextResponse.json({ ok: false, code: "NO_ACTIVE_COURSE" as const }, { status: 401 });
      }
      logEnd("grant_ok");
      return NextResponse.json({
        ...result,
        advancedToNextCourse: advance.advanced,
        previousCourseId: advance.previousCourseId,
      });
    }
    console.log("[sessions/current] branch=grant", { ms: Math.round(performance.now() - tGrant), hit: false });

    /**
     * Admin without a normal student/trial/grant session can still use DB-backed `writing.user_roles` admin.
     * IMPORTANT: use `resolvedRole` (DB + env), NOT `resolveRoleFromEnv` only — production admins often
     * exist only in `writing.user_roles` while `ADMIN_USER_IDS` is empty or incomplete (→ was 404 before).
     */
    if (userId && resolvedRole === "admin") {
      try {
        await ensureAdminSandboxCourse(db, userId);
      } catch (e) {
        console.error("sessions_current_ensure_admin_sandbox_course_failed", {
          userId,
          err: e instanceof Error ? e.message : String(e),
        });
      }
      try {
        const tAsb = performance.now();
        const adminSandbox = await getCurrentSessionForAdminSandbox(db, userId);
        console.log("[sessions/current] branch=admin_fallback_sandbox_course", {
          ms: Math.round(performance.now() - tAsb),
          ok: adminSandbox.ok,
        });
        if (adminSandbox.ok) {
          logEnd("admin_course_sandbox_ok");
          return NextResponse.json(adminSandbox);
        }
      } catch (e) {
        console.error("sessions_current_get_admin_sandbox_failed", {
          userId,
          err: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Logged-in admin with no resolvable session: stable 200 for UI (avoid raw 404 + confusing client probes).
    if (userId && resolvedRole === "admin") {
      logEnd("admin_no_writing_session_context");
      return NextResponse.json(
        {
          ok: false as const,
          accessKind: "admin_sandbox" as const,
          code: "admin_no_writing_session_context",
        },
        { status: 200 }
      );
    }

    if (userId) {
      logEnd("not_found", { studentError });
      return NextResponse.json({ error: studentError ?? "not_found" }, { status: 404 });
    }

    logEnd("unauthorized");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  } finally {
    console.timeEnd("sessions/current_total");
  }
}
