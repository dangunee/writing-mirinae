import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { parseRegularWritingGrantIdFromCookieHeader } from "../../../../../../server/lib/regularSessionCookie";
import { fetchTrialApplicationIdFromMirinaeSessionCookie } from "../../../../../../server/lib/writingTrialUpstream";
import { requireWritingSubmissionEntitlement, resolveRoleFromEnv } from "../../../../../../server/lib/authMe";
import { parseSubmissionMode } from "../../../../../../server/lib/writingSubmissionMode";
import { getSessionUserId } from "../../../../../../server/lib/supabaseServer";
import type { PreparedAttachment } from "../../../../../../server/services/writingSubmissionInternal";
import * as writingStudentRepo from "../../../../../../server/repositories/writingStudentRepository";
import {
  saveOrSubmitSubmission,
  saveOrSubmitSubmissionForRegular,
  saveOrSubmitSubmissionForTrial,
} from "../../../../../../server/services/writingStudentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/writing/sessions/:id/submission
 * Identity: trial cookie (mirinae-api) first → regular grant cookie → Supabase session userId.
 * Never trust userId / trialApplicationId from body (forbidden keys rejected below).
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const cookieHeader = req.headers.get("cookie");
  const trialApplicationId = await fetchTrialApplicationIdFromMirinaeSessionCookie(cookieHeader);
  const grantId = parseRegularWritingGrantIdFromCookieHeader(cookieHeader);
  const userId = await getSessionUserId();

  console.log("[submission] path:", {
    trial: !!trialApplicationId,
    grant: !!grantId,
    user: !!userId,
  });

  if (!trialApplicationId && !grantId && !userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!trialApplicationId && userId && grantId) {
    return NextResponse.json({ error: "ambiguous_identity" }, { status: 400 });
  }

  const db = getDb();
  const { id: sessionId } = await context.params;

  if (userId && !trialApplicationId && !grantId) {
    const probe = await writingStudentRepo.getSessionByIdWithCourse(db, sessionId);
    if (probe?.course.isAdminSandbox) {
      if (resolveRoleFromEnv(userId) !== "admin" || probe.course.userId !== userId) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    } else {
      const gate = await requireWritingSubmissionEntitlement(db, userId);
      if (!gate.ok) {
        return NextResponse.json({ error: "insufficient_entitlement" }, { status: 403 });
      }
    }
  }
  const contentType = req.headers.get("content-type") ?? "";

  let action: "save" | "submit" = "save";
  let bodyText: string | null = null;
  const attachments: PreparedAttachment[] = [];
  let submissionMode = null as ReturnType<typeof parseSubmissionMode>;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const forbiddenFormKeys = [
      "userId",
      "user_id",
      "status",
      "courseId",
      "course_id",
      "sessionId",
      "session_id",
      "grantId",
      "grant_id",
      "trialApplicationId",
      "trial_application_id",
    ];
    for (const k of forbiddenFormKeys) {
      if (form.has(k)) {
        return NextResponse.json({ error: "forbidden_fields" }, { status: 400 });
      }
    }
    const act = form.get("action");
    action = act === "submit" ? "submit" : "save";
    const bt = form.get("bodyText");
    bodyText = typeof bt === "string" ? bt : null;
    const sm = form.get("submissionMode");
    submissionMode = typeof sm === "string" ? parseSubmissionMode(sm) : null;
    const legacyImage = form.get("image");
    if (legacyImage instanceof File && legacyImage.size > 0) {
      attachments.push({
        buffer: Buffer.from(await legacyImage.arrayBuffer()),
        mimeType: legacyImage.type || "application/octet-stream",
        originalFilename: legacyImage.name || "image",
      });
    }
    for (const entry of form.getAll("files")) {
      if (entry instanceof File && entry.size > 0) {
        attachments.push({
          buffer: Buffer.from(await entry.arrayBuffer()),
          mimeType: entry.type || "application/octet-stream",
          originalFilename: entry.name || "file",
        });
      }
    }
  } else if (contentType.includes("application/json")) {
    let json: Record<string, unknown>;
    try {
      json = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const forbiddenJsonKeys = [
      "userId",
      "user_id",
      "status",
      "courseId",
      "course_id",
      "sessionId",
      "session_id",
      "grantId",
      "grant_id",
      "trialApplicationId",
      "trial_application_id",
    ];
    for (const k of forbiddenJsonKeys) {
      if (k in json) {
        return NextResponse.json({ error: "forbidden_fields" }, { status: 400 });
      }
    }
    action = json.action === "submit" ? "submit" : "save";
    bodyText = typeof json.bodyText === "string" ? json.bodyText : null;
    submissionMode =
      typeof json.submissionMode === "string" ? parseSubmissionMode(json.submissionMode) : null;
  } else {
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 415 });
  }

  const result = trialApplicationId
    ? await saveOrSubmitSubmissionForTrial(db, {
        trialApplicationId,
        sessionId,
        action,
        bodyText,
        submissionMode,
        attachments,
      })
    : grantId
      ? await saveOrSubmitSubmissionForRegular(db, {
          grantId,
          sessionId,
          action,
          bodyText,
          submissionMode,
          attachments,
        })
      : await saveOrSubmitSubmission(db, {
          userId: userId!,
          sessionId,
          action,
          bodyText,
          submissionMode,
          attachments,
        });

  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  return NextResponse.json({
    submissionId: result.submissionId,
    status: result.status,
  });
}
