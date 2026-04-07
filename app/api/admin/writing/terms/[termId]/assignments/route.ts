import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../../server/lib/requireAdminSession";
import * as masterRepo from "../../../../../../../server/repositories/writingMasterRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/writing/terms/:termId/assignments
 */
export async function GET(_req: Request, context: { params: Promise<{ termId: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { termId } = await context.params;
  const db = getDb();
  const term = await masterRepo.getTermById(db, termId);
  if (!term) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const assignments = await masterRepo.listAssignmentMastersForTerm(db, termId);
  return NextResponse.json({ ok: true, assignments });
}

/**
 * POST /api/admin/writing/terms/:termId/assignments
 */
export async function POST(req: Request, context: { params: Promise<{ termId: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { termId } = await context.params;

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

  const slotIndex =
    typeof body.slotIndex === "number" && Number.isFinite(body.slotIndex) ? Math.floor(body.slotIndex) : NaN;
  if (slotIndex < 1 || slotIndex > 10) {
    return NextResponse.json({ ok: false, error: "invalid_slot_index" }, { status: 400 });
  }

  const theme = typeof body.theme === "string" ? body.theme.trim() : "";
  const modelAnswer = typeof body.modelAnswer === "string" ? body.modelAnswer.trim() : "";
  if (!theme || !modelAnswer) {
    return NextResponse.json({ ok: false, error: "theme_and_model_answer_required" }, { status: 400 });
  }

  let requiredExpressions: unknown[] = [];
  if (Array.isArray(body.requiredExpressions)) {
    requiredExpressions = body.requiredExpressions.filter((x) => typeof x === "string") as string[];
  }
  if (requiredExpressions.length < 2 || requiredExpressions.length > 3) {
    return NextResponse.json({ ok: false, error: "required_expressions_count_2_to_3" }, { status: 400 });
  }

  const difficulty =
    typeof body.difficulty === "number" && Number.isFinite(body.difficulty)
      ? Math.floor(body.difficulty)
      : 1;
  if (difficulty < 1 || difficulty > 5) {
    return NextResponse.json({ ok: false, error: "invalid_difficulty" }, { status: 400 });
  }

  const db = getDb();
  const term = await masterRepo.getTermById(db, termId);
  if (!term) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const existing = await masterRepo.getAssignmentMasterByTermAndSlot(db, termId, slotIndex);
  if (existing) {
    return NextResponse.json({ ok: false, error: "slot_taken" }, { status: 409 });
  }

  const assignment = await masterRepo.insertAssignmentMaster(db, {
    termId,
    slotIndex,
    theme,
    requiredExpressions,
    modelAnswer,
    difficulty,
  });
  return NextResponse.json({ ok: true, assignment });
}
