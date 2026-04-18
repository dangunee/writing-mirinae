import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../server/lib/requireAdminSession";
import { listActiveWritingCoursesWithTerm } from "../../../../../server/repositories/writingAdminRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CourseRow = Awaited<ReturnType<typeof listActiveWritingCoursesWithTerm>>[number];

function buildDisplayName(row: CourseRow, trialCourseId: string | undefined): string {
  if (row.isAdminSandbox) {
    return "管理者テスト（sandbox）";
  }
  if (trialCourseId && row.id === trialCourseId) {
    const t = row.termTitle?.trim();
    return t ? `体験コース — ${t}` : "体験コース";
  }
  const t = row.termTitle?.trim();
  const statusLabel = row.status === "pending_setup" ? "準備中" : "active";
  if (t) {
    return `${t} · ${statusLabel}`;
  }
  return `コース ${row.id.slice(0, 8)}… · ${statusLabel}`;
}

/**
 * GET /api/writing/admin/courses — admin-only; active writing courses for assignment form dropdown.
 */
export async function GET() {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const trialId = process.env.WRITING_TRIAL_COURSE_ID?.trim();
  const db = getDb();
  const rows = await listActiveWritingCoursesWithTerm(db);

  const courses = rows.map((r) => ({
    courseId: r.id,
    displayName: buildDisplayName(r, trialId),
    status: r.status,
    isAdminSandbox: r.isAdminSandbox,
    sessionCount: r.sessionCount,
  }));

  return NextResponse.json({ ok: true, courses });
}
