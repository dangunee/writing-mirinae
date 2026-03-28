import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireTeacherUserId } from "../../../../../../../server/lib/teacherAuth";
import {
  saveEvaluationDraft,
  type EvaluationInput,
} from "../../../../../../../server/services/writingTeacherService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/teacher/writing/submissions/:id/evaluation — merge draft scores (0–100 integers). */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireTeacherUserId();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const payload: EvaluationInput = {
    grammarScore: "grammarScore" in b ? (b.grammarScore as number | null | undefined) : undefined,
    vocabularyScore: "vocabularyScore" in b ? (b.vocabularyScore as number | null | undefined) : undefined,
    contextScore: "contextScore" in b ? (b.contextScore as number | null | undefined) : undefined,
  };

  const { id: submissionId } = await context.params;
  const db = getDb();
  const result = await saveEvaluationDraft(db, auth.userId, submissionId, payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
