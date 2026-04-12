import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../server/lib/requireAdminSession";
import { upsertAssignmentContentForCourse } from "../../../../../../server/services/writingAdminAssignmentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/writing/admin/assignments/create — admin-only; writes writing.sessions (theme_snapshot + unlock).
 */
export async function POST(req: Request) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const courseId = typeof b.courseId === "string" ? b.courseId : "";
  const title = typeof b.title === "string" ? b.title : "";
  const prompt = typeof b.prompt === "string" ? b.prompt : "";
  const requirementsRaw = b.requirements;
  const requirements =
    typeof requirementsRaw === "string" && requirementsRaw.trim() ? requirementsRaw : null;

  let sessionIndex = 1;
  if (b.sessionIndex !== undefined && b.sessionIndex !== null) {
    const n = typeof b.sessionIndex === "number" ? b.sessionIndex : Number(b.sessionIndex);
    if (Number.isFinite(n)) {
      sessionIndex = Math.floor(n);
    }
  }

  const result = await upsertAssignmentContentForCourse(getDb(), {
    courseId,
    sessionIndex,
    title,
    prompt,
    requirements,
  });

  if (!result.ok) {
    const status =
      result.code === "course_not_found" || result.code === "course_not_active" ? 404 : 400;
    return NextResponse.json({ ok: false, code: result.code }, { status });
  }

  return NextResponse.json({ ok: true, sessionId: result.sessionId });
}
