import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../server/lib/requireAdminSession";
import { ensureCourseForAssignmentTerm } from "../../../../../../server/services/writingAdminAssignmentCatalogService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCatalogOwnerUserId(): string | undefined {
  const raw = process.env.WRITING_ASSIGNMENT_CATALOG_OWNER_USER_ID?.trim();
  if (!raw) return undefined;
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return UUID_RE.test(raw) ? raw : undefined;
}

/**
 * POST /api/writing/admin/courses/ensure-for-term
 * Body: { termId: string }
 * Creates writing.courses + entitlement when no course exists for this term (admin-only).
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

  const termId = typeof (body as { termId?: unknown }).termId === "string"
    ? (body as { termId: string }).termId
    : "";

  const ownerUserId = parseCatalogOwnerUserId() ?? admin.userId;

  const db = getDb();
  const result = await ensureCourseForAssignmentTerm(db, ownerUserId, termId);

  if (!result.ok) {
    const status =
      result.code === "invalid_term" || result.code === "term_inactive"
        ? 400
        : result.code === "product_missing"
          ? 503
          : 500;
    return NextResponse.json({ ok: false, code: result.code }, { status });
  }

  return NextResponse.json({
    ok: true,
    courseId: result.courseId,
    created: result.created,
  });
}
