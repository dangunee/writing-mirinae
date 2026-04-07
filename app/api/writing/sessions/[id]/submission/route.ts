import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { parseRegularWritingGrantIdFromCookieHeader } from "../../../../../../server/lib/regularSessionCookie";
import { fetchTrialApplicationIdFromMirinaeSessionCookie } from "../../../../../../server/lib/writingTrialUpstream";
import { requireWritingSubmissionEntitlement, resolveRoleFromEnv } from "../../../../../../server/lib/authMe";
import { getSessionUserId } from "../../../../../../server/lib/supabaseServer";
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
  let imageBuffer: Buffer | null = null;
  let imageMimeType: string | null = null;

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
  } else {
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 415 });
  }

  const result = trialApplicationId
    ? await saveOrSubmitSubmissionForTrial(db, {
        trialApplicationId,
        sessionId,
        action,
        bodyText,
        imageBuffer,
        imageMimeType,
      })
    : grantId
      ? await saveOrSubmitSubmissionForRegular(db, {
          grantId,
          sessionId,
          action,
          bodyText,
          imageBuffer,
          imageMimeType,
        })
      : await saveOrSubmitSubmission(db, {
          userId: userId!,
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
