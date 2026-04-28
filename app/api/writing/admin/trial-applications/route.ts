import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../server/lib/requireAdminSession";
import { listTrialApplicationsForAdmin } from "../../../../../server/services/trialApplicationsAdminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/writing/admin/trial-applications — admin session; excludes trashed unless ?trash=1 or ?status=trash */
export async function GET(req: Request) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  try {
    const db = getDb();
    const result = await listTrialApplicationsForAdmin(db, req.url);
    if (!result) {
      return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      items: result.items,
      pagination: result.pagination,
      sort: result.sort,
    });
  } catch (e) {
    console.error("trial-admin list route error", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
