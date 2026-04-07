import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../server/lib/requireAdminSession";
import * as masterRepo from "../../../../../server/repositories/writingMasterRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/writing/terms — list terms (assignment master groups).
 */
export async function GET() {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }
  const db = getDb();
  const terms = await masterRepo.listTermsOrdered(db);
  return NextResponse.json({ ok: true, terms });
}

/**
 * POST /api/admin/writing/terms — create term.
 */
export async function POST(req: Request) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  let body: { title?: unknown; sortOrder?: unknown; isActive?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });
  }

  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? Math.floor(body.sortOrder)
      : 0;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  const db = getDb();
  const term = await masterRepo.insertTerm(db, {
    title,
    sortOrder,
    isActive,
  });
  return NextResponse.json({ ok: true, term });
}
