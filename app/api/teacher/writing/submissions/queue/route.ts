import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireTeacherUserId } from "../../../../../../server/lib/teacherAuth";
import {
  getTeacherQueueGrouped,
  type TeacherQueueFilter,
} from "../../../../../../server/services/writingTeacherService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseQueueFilter(req: Request): TeacherQueueFilter {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("status")?.trim().toLowerCase();
    if (raw === "completed") return "completed";
    return "pending";
  } catch {
    return "pending";
  }
}

/** GET /api/teacher/writing/submissions/queue?status=pending|completed — teacher-only. */
export async function GET(req: Request) {
  try {
    const auth = await requireTeacherUserId();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
        { status: auth.reason === "unauthorized" ? 401 : 403 }
      );
    }

    const filter = parseQueueFilter(req);
    const db = getDb();
    const body = await getTeacherQueueGrouped(db, filter);
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
