import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireTeacherUserId } from "../../../../../../server/lib/teacherAuth";
import { getTeacherSubmissionDetail } from "../../../../../../server/services/writingTeacherService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/teacher/writing/submissions/:id — draft correction visible to teacher only (not exposed on student routes). */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireTeacherUserId();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }

  const { id: submissionId } = await context.params;
  const db = getDb();
  const detail = await getTeacherSubmissionDetail(db, submissionId);
  if (!detail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
