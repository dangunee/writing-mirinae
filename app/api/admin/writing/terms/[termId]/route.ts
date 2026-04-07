import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../server/lib/requireAdminSession";
import * as masterRepo from "../../../../../../server/repositories/writingMasterRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/writing/terms/:termId
 */
export async function PATCH(req: Request, context: { params: Promise<{ termId: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { termId } = await context.params;

  let body: { title?: unknown; sortOrder?: unknown; isActive?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const patch: {
    title?: string;
    sortOrder?: number;
    isActive?: boolean;
  } = {};

  if (typeof body.title === "string") {
    patch.title = body.title.trim();
  }
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    patch.sortOrder = Math.floor(body.sortOrder);
  }
  if (typeof body.isActive === "boolean") {
    patch.isActive = body.isActive;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "no_updates" }, { status: 400 });
  }

  const db = getDb();
  const updated = await masterRepo.updateTerm(db, termId, patch);
  if (!updated) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, term: updated });
}

/**
 * DELETE /api/admin/writing/terms/:termId — cascades assignment_masters; sessions keep snapshots (FK SET NULL).
 */
export async function DELETE(_req: Request, context: { params: Promise<{ termId: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { termId } = await context.params;
  const db = getDb();
  const ok = await masterRepo.deleteTermById(db, termId);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
