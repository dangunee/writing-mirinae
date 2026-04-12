import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../server/lib/requireAdminSession";
import { setTeacherRoleForUser } from "../../../../../../server/services/writingAdminRolesService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/writing/admin/roles/set-teacher — admin-only; student ↔ teacher via writing.user_roles only.
 * Never sets admin; rejects targets whose effective role is admin.
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
  const targetUserId = typeof b.targetUserId === "string" ? b.targetUserId : "";
  const makeTeacher = b.makeTeacher === true;

  if (b.makeTeacher !== true && b.makeTeacher !== false) {
    return NextResponse.json({ ok: false, error: "make_teacher_boolean_required" }, { status: 400 });
  }

  const db = getDb();
  const result = await setTeacherRoleForUser(db, targetUserId, makeTeacher);

  if (!result.ok) {
    const status =
      result.code === "invalid_target"
        ? 400
        : result.code === "not_found"
          ? 404
          : 403;
    return NextResponse.json({ ok: false, code: result.code }, { status });
  }

  return NextResponse.json({ ok: true });
}
