import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireTeacherUserId } from "../../../../../../../server/lib/teacherAuth";
import {
  replaceSubmissionFragments,
  type FragmentInput,
} from "../../../../../../../server/services/writingTeacherService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/teacher/writing/submissions/:id/fragments — replace all fragments for the correction (transactional). */
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

  const raw = (body as { fragments?: unknown }).fragments;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: "fragments_array_required" }, { status: 400 });
  }

  const { id: submissionId } = await context.params;
  const db = getDb();
  const result = await replaceSubmissionFragments(
    db,
    auth.userId,
    submissionId,
    raw as unknown as FragmentInput[]
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    correctionId: result.correctionId,
    fragmentCount: result.fragmentCount,
  });
}
