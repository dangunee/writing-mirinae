import { NextResponse } from "next/server";

import {
  computeEntitlementsForUser,
  resolveRoleFromEnv,
  type AuthMePayload,
  type AuthRole,
} from "../../../../server/lib/authMe";
import { getDb } from "../../../../server/db/client";
import { createSupabaseServerClient } from "../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/me — session user + role + entitlements (no client userId).
 */
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      const body: AuthMePayload = {
        user: null,
        role: null,
        entitlements: {
          hasTrial: false,
          hasActiveCourse: false,
          isAcademyUnlimited: false,
        },
      };
      return NextResponse.json(body);
    }

    let entitlements = {
      hasTrial: false,
      hasActiveCourse: false,
      isAcademyUnlimited: false,
    };
    let role: AuthRole | null = null;
    try {
      const db = getDb();
      entitlements = await computeEntitlementsForUser(db, user.id);
      role = resolveRoleFromEnv(user.id);
    } catch (dbErr) {
      // Avoid 500 after successful login/signup when only Postgres/entitlements fail (e.g. missing DATABASE_URL).
      console.error("auth_me_db_or_entitlements_failed", dbErr);
      role = resolveRoleFromEnv(user.id);
    }

    const body: AuthMePayload = {
      user: {
        id: user.id,
        email: user.email ?? null,
      },
      role,
      entitlements,
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("auth_me_failed", e);
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }
}
