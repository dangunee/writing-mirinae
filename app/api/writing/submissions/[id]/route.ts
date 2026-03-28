import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { getSubmissionDetailForStudent } from "../../../../../server/services/writingStudentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/writing/submissions/:id
 * Security: owner-only; draft teacher content never included (corrections not loaded here).
 */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: submissionId } = await context.params;
  const db = getDb();
  const detail = await getSubmissionDetailForStudent(db, userId, submissionId);
  if (!detail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
