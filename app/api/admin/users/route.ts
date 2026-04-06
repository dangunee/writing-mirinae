import { NextResponse } from "next/server";

import { getDb } from "../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../server/lib/requireAdminSession";
import { listAdminUsersWithTrialLinkage } from "../../../../server/services/adminUsersTrialService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — Supabase session admin only; auth.users + trial_applications linkage counts.
 * Does not accept userId/email from client (query is fixed server-side).
 */
export async function GET() {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  try {
    const db = getDb();
    const users = await listAdminUsersWithTrialLinkage(db);
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    console.error("admin_users_list_failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
