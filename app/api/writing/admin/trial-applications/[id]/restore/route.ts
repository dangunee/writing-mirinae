import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../../server/lib/requireAdminSession";
import { restoreTrialApplication } from "../../../../../../../server/services/trialApplicationsAdminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/writing/admin/trial-applications/[id]/restore */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { id: applicationId } = await context.params;

  try {
    const db = getDb();
    const out = await restoreTrialApplication(db, applicationId, admin.userId);
    if (!out.ok) {
      return NextResponse.json({ ok: false, error: out.code }, { status: out.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("trial-admin restore route error", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
