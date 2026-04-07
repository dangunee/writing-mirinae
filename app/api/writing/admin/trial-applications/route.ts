import { NextResponse } from "next/server";

import { requireAdminSessionUserId } from "../../../../../server/lib/requireAdminSession";
import { proxyTrialApplicationsList } from "../../../../../server/lib/trialAdminMirinaeProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/writing/admin/trial-applications — session admin + upstream list */
export async function GET(req: Request) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  try {
    return await proxyTrialApplicationsList(req);
  } catch (e) {
    console.error("trial_admin_list_route_error", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
