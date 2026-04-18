import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../server/lib/requireAdminSession";
import { listWritingSessionsForAdminAssignmentList } from "../../../../../../server/repositories/writingAdminRepository";
import { getWritingCourseById } from "../../../../../../server/repositories/writingStudentRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/writing/admin/assignments/list?courseId=...
 * Admin-only; active course; sessions 1–10 with theme_snapshot presence + raw text.
 */
export async function GET(req: Request) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const url = new URL(req.url);
  const courseId = url.searchParams.get("courseId")?.trim() ?? "";
  if (!UUID_RE.test(courseId)) {
    return NextResponse.json({ ok: false, error: "invalid_course_id" }, { status: 400 });
  }

  const db = getDb();
  const course = await getWritingCourseById(db, courseId);
  if (!course) {
    return NextResponse.json({ ok: false, error: "course_not_found" }, { status: 404 });
  }
  if (course.status !== "active" && course.status !== "pending_setup") {
    return NextResponse.json({ ok: false, error: "course_not_active" }, { status: 404 });
  }

  const rows = await listWritingSessionsForAdminAssignmentList(db, courseId);
  const byIndex = new Map(rows.map((r) => [r.index, r]));

  const sessions = [];
  for (let i = 1; i <= 10; i++) {
    const row = byIndex.get(i);
    const raw = row?.themeSnapshot ?? null;
    const trimmed = raw != null ? String(raw).trim() : "";
    const hasThemeSnapshot = trimmed.length > 0;
    sessions.push({
      sessionIndex: i,
      sessionId: row?.id ?? null,
      hasThemeSnapshot,
      themeSnapshot: hasThemeSnapshot ? String(raw) : null,
    });
  }

  return NextResponse.json({ ok: true, courseId, sessions });
}
