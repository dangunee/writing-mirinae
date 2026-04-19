import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { parseRegularWritingGrantIdFromCookieHeader } from "../../../../../server/lib/regularSessionCookie";
import { resolveRoleFromEnv } from "../../../../../server/lib/authMe";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { resolveWritingRoleFromDbOrEnv } from "../../../../../server/lib/writingAuthRoles";
import { ensureAdminSandboxCourse } from "../../../../../server/services/adminSandboxProvisionService";
import {
  adminSandboxCookieName,
  buildAdminSandboxCurrentSessionResponse,
  loadAdminSandboxContextById,
} from "../../../../../server/services/adminSandboxService";
import { advanceRegularGrantToNextCourseIfNeeded } from "../../../../../server/services/regularGrantAdvanceService";
import {
  getCurrentSessionForAdminSandbox,
  getCurrentSessionForRegularGrant,
  getCurrentSessionForStudent,
  getCurrentSessionForTrialApplication,
} from "../../../../../server/services/writingStudentService";

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
  const db = getDb();
  const cookieHeader = req.headers.get("cookie") ?? "";

  const userId = await getSessionUserId();
  let studentError: string | undefined;

  if (userId) {
    const role = await resolveWritingRoleFromDbOrEnv(db, userId);
    if (role === "admin") {
      const c = await cookies();
      const sbxId = c.get(adminSandboxCookieName())?.value?.trim();
      if (sbxId) {
        try {
          const ctx = await loadAdminSandboxContextById(db, sbxId, userId);
          if (!ctx) {
            console.warn("sessions_current_admin_sandbox_ctx_missing_or_expired", {
              userId,
              contextIdPrefix: sbxId.slice(0, 8),
            });
            return NextResponse.json(
              {
                ok: false as const,
                accessKind: "admin_sandbox" as const,
                code: "sandbox_context_missing_or_expired",
              },
              { status: 200 }
            );
          }
          const json = await buildAdminSandboxCurrentSessionResponse(db, ctx);
          if (!json) {
            console.warn("sessions_current_admin_sandbox_build_null", {
              userId,
              contextIdPrefix: sbxId.slice(0, 8),
              sessionId: ctx.sessionId,
            });
            return NextResponse.json(
              {
                ok: false as const,
                accessKind: "admin_sandbox" as const,
                code: "sandbox_context_invalid_or_stale",
              },
              { status: 200 }
            );
          }
          return NextResponse.json(json);
        } catch (e) {
          console.error("sessions_current_admin_sandbox_unhandled", {
            userId,
            err: e instanceof Error ? e.message : String(e),
            stack: e instanceof Error ? e.stack : undefined,
          });
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
    }

    const result = await getCurrentSessionForStudent(db, userId);
    if (result.ok) {
      return NextResponse.json(result);
    }
    studentError = "error" in result ? String(result.error) : "no_active_course";
  }

  const trialRes = await tryTrialSessionFromCookie(req, db);
  if (trialRes) {
    return trialRes;
  }

  const grantId = parseRegularWritingGrantIdFromCookieHeader(cookieHeader);
  if (grantId) {
    const advance = await advanceRegularGrantToNextCourseIfNeeded(db, grantId);
    const result = await getCurrentSessionForRegularGrant(db, grantId);
    if (!result.ok) {
      return NextResponse.json({ ok: false, code: "NO_ACTIVE_COURSE" as const }, { status: 401 });
    }
    return NextResponse.json({
      ...result,
      advancedToNextCourse: advance.advanced,
      previousCourseId: advance.previousCourseId,
    });
  }

  if (userId && resolveRoleFromEnv(userId) === "admin") {
    try {
      await ensureAdminSandboxCourse(db, userId);
    } catch (e) {
      console.error("sessions_current_ensure_admin_sandbox_course_failed", {
        userId,
        err: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      const adminSandbox = await getCurrentSessionForAdminSandbox(db, userId);
      if (adminSandbox.ok) {
        return NextResponse.json(adminSandbox);
      }
    } catch (e) {
      console.error("sessions_current_get_admin_sandbox_failed", {
        userId,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  if (userId) {
    return NextResponse.json({ error: studentError ?? "not_found" }, { status: 404 });
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
