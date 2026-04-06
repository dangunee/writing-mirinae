import { NextResponse } from "next/server";

import {
  computeEntitlementsForUser,
  resolveRoleFromEnv,
  type AuthRole,
} from "../../../../server/lib/authMe";
import { getDb } from "../../../../server/db/client";
import { createSupabaseServerClient } from "../../../../server/lib/supabaseServer";
import { linkTrialApplicationsToUserByEmail } from "../../../../server/services/trialApplicationLinkService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — session from Supabase cookies only (no client userId).
 * 200: { ok: true, user, role, entitlements }
 * 401: { ok: false }
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    let user = session?.user ?? null;

    if (!user) {
      const {
        data: { user: jwtUser },
        error: userError,
      } = await supabase.auth.getUser();
      if (jwtUser) {
        user = jwtUser;
      } else if (userError) {
        console.log("[auth/me] getUser_no_session", userError.message);
      }
    }

    if (!user) {
      console.log("[auth/me] auth_me_unauthenticated");
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    console.log("[auth/me] auth_me_ok", { userId: user.id });

    let entitlements = {
      hasTrial: false,
      hasActiveCourse: false,
      isAcademyUnlimited: false,
    };
    let role: AuthRole | null = null;
    try {
      const db = getDb();
      const email = user.email?.trim();
      if (email) {
        try {
          await linkTrialApplicationsToUserByEmail(db, user.id, email);
        } catch {
          /* Trial linkage is best-effort; must not affect auth/me. */
        }
      }
      entitlements = await computeEntitlementsForUser(db, user.id);
      role = resolveRoleFromEnv(user.id);
    } catch (dbErr) {
      console.error("auth_me_db_or_entitlements_failed", dbErr);
      role = resolveRoleFromEnv(user.id);
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      role,
      entitlements,
    });
  } catch (e) {
    console.error("auth_me_failed", e);
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }
}
