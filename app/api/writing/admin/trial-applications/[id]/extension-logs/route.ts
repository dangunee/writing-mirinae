import { NextResponse } from "next/server";

import { requireAdminSessionUserId } from "../../../../../../../server/lib/requireAdminSession";
import { proxyTrialApplicationExtensionLogs } from "../../../../../../../server/lib/trialAdminMirinaeProxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { id } = await context.params;
  const applicationId = id?.trim() ?? "";
  if (!applicationId) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    return await proxyTrialApplicationExtensionLogs(applicationId);
  } catch (e) {
    console.error("trial_admin_extension_logs_route_error", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
