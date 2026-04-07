import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../../server/lib/requireAdminSession";
import { reconcileCourseSessions } from "../../../../../../../server/services/writingSessionReconciliationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/writing/courses/:courseId/reconcile — force unlock/missed pass (debug / support).
 */
export async function POST(_req: Request, context: { params: Promise<{ courseId: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { courseId } = await context.params;
  const db = getDb();
  await reconcileCourseSessions(db, courseId);
  return NextResponse.json({ ok: true });
}
