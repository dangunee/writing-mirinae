import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireTeacherUserId } from "../../../../../../../server/lib/teacherAuth";
import { publishTeacherCorrection } from "../../../../../../../server/services/writingTeacherService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/teacher/writing/submissions/:id/publish — atomically publish correction (DB triggers sync submission + session). */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireTeacherUserId();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }

  const { id: submissionId } = await context.params;
  const db = getDb();
  const result = await publishTeacherCorrection(db, auth.userId, submissionId);
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    correctionId: result.correctionId,
    publishedAt: result.publishedAt,
  });
}
