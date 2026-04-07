import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../../../server/lib/requireAdminSession";
import * as masterRepo from "../../../../../../../../server/repositories/writingMasterRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/writing/terms/:termId/assignments/:assignmentId
 */
export async function PATCH(req: Request, context: { params: Promise<{ termId: string; assignmentId: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { termId, assignmentId } = await context.params;

  let body: {
    slotIndex?: unknown;
    theme?: unknown;
    requiredExpressions?: unknown;
    modelAnswer?: unknown;
    difficulty?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const db = getDb();
  const row = await masterRepo.getAssignmentMasterById(db, assignmentId);
  if (!row || row.termId !== termId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const patch: Parameters<typeof masterRepo.updateAssignmentMaster>[2] = {};

  if (typeof body.slotIndex === "number" && Number.isFinite(body.slotIndex)) {
    const idx = Math.floor(body.slotIndex);
    if (idx >= 1 && idx <= 10) {
      patch.slotIndex = idx;
    }
  }
  if (typeof body.theme === "string") {
    patch.theme = body.theme.trim();
  }
  if (typeof body.modelAnswer === "string") {
    patch.modelAnswer = body.modelAnswer.trim();
  }
  if (Array.isArray(body.requiredExpressions)) {
    const expr = body.requiredExpressions.filter((x) => typeof x === "string") as string[];
    if (expr.length >= 2 && expr.length <= 3) {
      patch.requiredExpressions = expr;
    }
  }
  if (typeof body.difficulty === "number" && Number.isFinite(body.difficulty)) {
    const d = Math.floor(body.difficulty);
    if (d >= 1 && d <= 5) {
      patch.difficulty = d;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "no_updates" }, { status: 400 });
  }

  if (patch.slotIndex !== undefined && patch.slotIndex !== row.slotIndex) {
    const taken = await masterRepo.getAssignmentMasterByTermAndSlot(db, termId, patch.slotIndex);
    if (taken && taken.id !== assignmentId) {
      return NextResponse.json({ ok: false, error: "slot_taken" }, { status: 409 });
    }
  }

  const updated = await masterRepo.updateAssignmentMaster(db, assignmentId, patch);
  if (!updated) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, assignment: updated });
}

/**
 * DELETE /api/admin/writing/terms/:termId/assignments/:assignmentId
 */
export async function DELETE(_req: Request, context: { params: Promise<{ termId: string; assignmentId: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { termId, assignmentId } = await context.params;
  const db = getDb();
  const row = await masterRepo.getAssignmentMasterById(db, assignmentId);
  if (!row || row.termId !== termId) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const ok = await masterRepo.deleteAssignmentMaster(db, assignmentId);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
