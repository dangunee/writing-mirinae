import { NextResponse } from "next/server";

import { requireAdminSessionUserId } from "../../../../../server/lib/requireAdminSession";
import { proxyTrialAdminMutation } from "../../../../../server/lib/trialAdminMirinaeProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/writing/admin/bff — activate / extend / resend (mirinae-api upstream).
 * Auth: Supabase session + ADMIN_USER_IDS (no BFF bearer token).
 */
export async function POST(req: Request) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  try {
    const u = new URL(req.url);
    const fromQuery = u.searchParams.get("id")?.trim();
    const applicationId =
      fromQuery ??
      u.pathname.match(/\/trial-applications\/([^/]+)\/(?:activate|extend-access|resend-access)/)?.[1]?.trim() ??
      "";
    return proxyTrialAdminMutation(req, applicationId, { actorUserId: admin.userId });
  } catch (e) {
    console.error("trial_admin_bff_route_error", e);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
