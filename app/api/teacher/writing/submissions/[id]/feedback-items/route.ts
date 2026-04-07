import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireTeacherUserId } from "../../../../../../../server/lib/teacherAuth";
import {
  replaceSubmissionFeedbackItems,
  type FeedbackItemInput,
} from "../../../../../../../server/services/writingTeacherService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/teacher/writing/submissions/:id/feedback-items — replace structured feedback rows (does not sync writing.fragments). */
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

  const raw = (body as { feedbackItems?: unknown }).feedbackItems;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "feedback_items_array_required" }, { status: 400 });
  }

  const { id: submissionId } = await context.params;
  const db = getDb();
  const result = await replaceSubmissionFeedbackItems(
    db,
    auth.userId,
    submissionId,
    raw as unknown as FeedbackItemInput[]
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    correctionId: result.correctionId,
    count: result.count,
  });
}
