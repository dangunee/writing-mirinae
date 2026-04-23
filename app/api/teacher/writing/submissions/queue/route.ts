import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireTeacherUserId } from "../../../../../../server/lib/teacherAuth";
import { getTeacherQueueGrouped } from "../../../../../../server/services/writingTeacherService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/teacher/writing/submissions/queue — teacher-only; oldest pending work first, grouped by UTC date. */
export async function GET() {
  try {
    const auth = await requireTeacherUserId();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
        { status: auth.reason === "unauthorized" ? 401 : 403 }
      );
    }

    const db = getDb();
    const body = await getTeacherQueueGrouped(db);
    return NextResponse.json(body);
  } catch (e) {
    console.error("teacher_queue_error", e);
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    return NextResponse.json(
      {
        ok: false,
        error: message,
        ...(stack ? { stack } : {}),
      },
      { status: 500 }
    );
  }
}
