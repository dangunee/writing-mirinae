import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../../server/lib/requireAdminSession";
import { populateCourseSessionsFromTerm } from "../../../../../../../server/services/writingCourseSessionGeneratorService";
import type { CourseInterval } from "../../../../../../../server/types/writing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERVALS: ReadonlySet<CourseInterval> = new Set([
  "interval_1d",
  "interval_2d",
  "interval_3d",
  "interval_1w",
  "interval_10d",
  "interval_2w",
]);

/**
 * POST /api/admin/writing/courses/:courseId/populate-from-term
 * Body: { termId, startDateIso, interval } — pending_setup course only.
 */
export async function POST(req: Request, context: { params: Promise<{ courseId: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { courseId } = await context.params;

  let body: { termId?: unknown; startDateIso?: unknown; interval?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const termId = typeof body.termId === "string" ? body.termId.trim() : "";
  const startDateIso = typeof body.startDateIso === "string" ? body.startDateIso.trim() : "";
  const interval = typeof body.interval === "string" ? body.interval.trim() : "";

  if (!termId || !startDateIso || !interval) {
    return NextResponse.json({ ok: false, error: "termId_startDate_interval_required" }, { status: 400 });
  }

  if (!INTERVALS.has(interval as CourseInterval)) {
    return NextResponse.json({ ok: false, error: "invalid_interval" }, { status: 400 });
  }

  const db = getDb();
  const result = await populateCourseSessionsFromTerm(db, {
    courseId,
    termId,
    startDateIso,
    interval: interval as CourseInterval,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
