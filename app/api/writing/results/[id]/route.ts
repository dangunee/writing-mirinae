import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { getPublishedStudentResult } from "../../../../../server/services/writingStudentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/writing/results/:id
 * `:id` = submission id. Only returns data when correction is **published** (draft invisible).
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: submissionId } = await context.params;
  const db = getDb();
  const result = await getPublishedStudentResult(db, userId, submissionId);
  if (!result) {
    return NextResponse.json({ error: "not_found_or_not_published" }, { status: 404 });
  }

  return NextResponse.json(result);
}
