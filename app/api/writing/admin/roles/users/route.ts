import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../server/lib/requireAdminSession";
import { listUsersWithWritingRoles } from "../../../../../../server/services/writingAdminRolesService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/writing/admin/roles/users — admin-only; auth.users + profiles + effective writing role.
 */
export async function GET() {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  try {
    const db = getDb();
    const users = await listUsersWithWritingRoles(db);
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    console.error("admin_roles_users_list_failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
