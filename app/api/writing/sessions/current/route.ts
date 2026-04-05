import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { parseRegularWritingGrantIdFromCookieHeader } from "../../../../../server/lib/regularSessionCookie";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { advanceRegularGrantToNextCourseIfNeeded } from "../../../../../server/services/regularGrantAdvanceService";
import {
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

/**
 * GET /api/writing/sessions/current
 * Identity: Supabase session (student) → trial cookie (upstream) → regular mail-link cookie.
 * No client-supplied userId / grantId.
 */
export async function GET(req: Request) {
  const db = getDb();
  const userId = await getSessionUserId();
  if (userId) {
    const result = await getCurrentSessionForStudent(db, userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  const cookieHeader = req.headers.get("cookie") ?? "";

  const trialBase = mirinaeApiBase();
  if (trialBase && cookieHeader.includes("writing_trial_access=")) {
    try {
      const upstream = await fetch(`${trialBase}/api/writing/trial/session/current`, {
        headers: { Cookie: cookieHeader },
      });
      if (upstream.ok) {
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
          return NextResponse.json({
            ok: true,
            accessKind: "trial" as const,
            applicationId,
            canSubmit: true,
            expiresAt: accessExpiresAt,
          });
        }
      }
    } catch (e) {
      console.warn("sessions_current_trial_upstream", e);
    }
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

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
