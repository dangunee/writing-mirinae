import { NextResponse } from "next/server";

import type { CourseInterval } from "../../../../../../server/design/payment-to-course-flow";
import { getDb } from "../../../../../../server/db/client";
import { getSessionUserId } from "../../../../../../server/lib/supabaseServer";
import { provisionWritingSessions } from "../../../../../../server/services/writingSchedule";

export const runtime = "nodejs";

const ALLOWED_INTERVALS = new Set<CourseInterval>([
  "interval_1d",
  "interval_2d",
  "interval_3d",
  "interval_1w",
  "interval_10d",
  "interval_2w",
]);

/**
 * POST /api/writing/courses/:id/schedule
 * Security: course owner only (actorUserId from session); interval allowlist; no client unlock arrays.
 */
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: courseId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if ("sessionCount" in body || "unlockAt" in body || "unlock_at" in body) {
    return NextResponse.json({ error: "forbidden_fields" }, { status: 400 });
  }

  const startDate = typeof body.startDate === "string" ? body.startDate : null;
  const interval = typeof body.interval === "string" ? body.interval : null;
  if (!startDate || !interval) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  if (!ALLOWED_INTERVALS.has(interval as CourseInterval)) {
    return NextResponse.json({ error: "invalid_interval" }, { status: 400 });
  }

  const db = getDb();
  const result = await provisionWritingSessions(db, {
    courseId,
    actorUserId: userId,
    startDateIso: startDate,
    interval: interval as CourseInterval,
  });

  if (!result.ok) {
    const status = result.httpStatus;
    return NextResponse.json({ error: result.reason }, { status });
  }

  return NextResponse.json({ ok: true });
}
