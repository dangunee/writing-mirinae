import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { getSessionUserId } from "../../../../../../server/lib/supabaseServer";
import { saveOrSubmitSubmission } from "../../../../../../server/services/writingStudentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/writing/sessions/:id/submission
 * Security: identity from session; reject client-supplied userId/status/courseId.
 * Abuse mitigation: body size (platform + WRITING_MAX_BODY_TEXT_CHARS), MIME/size on images, unique index on active pipeline.
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id: sessionId } = await context.params;
  const contentType = req.headers.get("content-type") ?? "";

  let action: "save" | "submit" = "save";
  let bodyText: string | null = null;
  let imageBuffer: Buffer | null = null;
  let imageMimeType: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const act = form.get("action");
    action = act === "submit" ? "submit" : "save";
    const bt = form.get("bodyText");
    bodyText = typeof bt === "string" ? bt : null;
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      imageBuffer = Buffer.from(await file.arrayBuffer());
      imageMimeType = file.type || "application/octet-stream";
    }
  } else if (contentType.includes("application/json")) {
    let json: Record<string, unknown>;
    try {
      json = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    if ("userId" in json || "status" in json || "courseId" in json || "sessionId" in json) {
      return NextResponse.json({ error: "forbidden_fields" }, { status: 400 });
    }
    action = json.action === "submit" ? "submit" : "save";
    bodyText = typeof json.bodyText === "string" ? json.bodyText : null;
  } else {
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 415 });
  }

  const db = getDb();
  const result = await saveOrSubmitSubmission(db, {
    userId,
    sessionId,
    action,
    bodyText,
    imageBuffer,
    imageMimeType,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  return NextResponse.json({
    submissionId: result.submissionId,
    status: result.status,
  });
}
