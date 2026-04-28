import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireTeacherUserId } from "../../../../../../../server/lib/teacherAuth";
import type { SaveCorrectionBody } from "../../../../../../../server/services/writingTeacherService";
import { saveCorrectionDraft } from "../../../../../../../server/services/writingTeacherService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/teacher/writing/submissions/:id/correction — upsert draft inline correction fields. */
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

  /** Only keys present on the JSON body — avoid `{ improvedText: undefined }`-style props that would make `"improvedText" in payload` true and clear DB fields on partial saves. */
  const b = body as Record<string, unknown>;
  const payload: SaveCorrectionBody = {};
  if ("polishedSentence" in b) {
    payload.polishedSentence = b.polishedSentence as string | null | undefined;
  }
  if ("modelAnswer" in b) {
    payload.modelAnswer = b.modelAnswer as string | null | undefined;
  }
  if ("teacherComment" in b) {
    payload.teacherComment = b.teacherComment as string | null | undefined;
  }
  if ("improvedText" in b) {
    payload.improvedText = b.improvedText as string | null | undefined;
  }
  if ("richDocumentJson" in b) {
    payload.richDocumentJson = b.richDocumentJson;
  }

  const { id: submissionId } = await context.params;
  const db = getDb();
  const result = await saveCorrectionDraft(db, auth.userId, submissionId, payload);
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  return NextResponse.json({ ok: true, correctionId: result.correctionId, status: result.status });
}
