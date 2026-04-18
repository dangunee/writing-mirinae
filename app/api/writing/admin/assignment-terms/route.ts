import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../server/lib/requireAdminSession";
import { listActiveTermsForAssignment } from "../../../../../server/services/writingAdminAssignmentCatalogService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/writing/admin/assignment-terms — active writing.terms for bootstrap dropdown.
 */
export async function GET() {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  try {
    const db = getDb();
    const terms = await listActiveTermsForAssignment(db);
    return NextResponse.json({ ok: true, terms });
  } catch (e) {
    console.error("admin_assignment_terms_failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
