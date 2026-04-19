import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { parseRegularWritingGrantIdFromCookieHeader } from "../../../../../../server/lib/regularSessionCookie";
import { fetchTrialApplicationIdFromMirinaeSessionCookie } from "../../../../../../server/lib/writingTrialUpstream";
import { requireWritingSubmissionEntitlement, resolveRoleFromEnv } from "../../../../../../server/lib/authMe";
import { parseWritingSubmissionPost } from "../../../../../../server/lib/parseWritingSubmissionPost";
import { getSessionUserId } from "../../../../../../server/lib/supabaseServer";
import { resolveWritingRoleFromDbOrEnv } from "../../../../../../server/lib/writingAuthRoles";
import * as writingStudentRepo from "../../../../../../server/repositories/writingStudentRepository";
import {
  appendAdminSandboxAudit,
  adminSandboxCookieName,
  loadAdminSandboxContextById,
  writeAdminSandboxTestSubmission,
  type AdminSandboxMode,
} from "../../../../../../server/services/adminSandboxService";
import type { PreparedAttachment } from "../../../../../../server/services/writingSubmissionInternal";
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
  const db = getDb();
  const { id: sessionId } = await context.params;

  const parsed = await parseWritingSubmissionPost(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { action, bodyText, attachments, submissionMode } = parsed;

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

  /** Admin QA sandbox — isolated table; session must match cookie context. */
  if (userId && !trialApplicationId && !grantId) {
    const role = await resolveWritingRoleFromDbOrEnv(db, userId);
    if (role === "admin") {
      const cookieStore = await cookies();
      const ctxId = cookieStore.get(adminSandboxCookieName())?.value?.trim();
      if (ctxId) {
        const ctx = await loadAdminSandboxContextById(db, ctxId, userId);
        if (ctx && ctx.sessionId === sessionId) {
          if (attachments.length > 0) {
            return NextResponse.json({ error: "sandbox_attachments_not_supported" }, { status: 400 });
          }
          const r = await writeAdminSandboxTestSubmission(db, {
            adminUserId: userId,
            mode: ctx.mode as AdminSandboxMode,
            courseId: ctx.courseId,
            sessionId,
            action,
            bodyText,
            contextValid: true,
          });
          if (!r.ok) {
            await appendAdminSandboxAudit(db, {
              adminUserId: userId,
              action: "sandbox_submit",
              mode: ctx.mode,
              courseId: ctx.courseId,
              sessionId,
              success: false,
              detail: { code: r.code },
            });
            return NextResponse.json({ error: r.code }, { status: r.status });
          }
          await appendAdminSandboxAudit(db, {
            adminUserId: userId,
            action: "sandbox_submit",
            mode: ctx.mode,
            courseId: ctx.courseId,
            sessionId,
            success: true,
            detail: { submissionId: r.submissionId },
          });
          return NextResponse.json({
            submissionId: r.submissionId,
            status: r.status,
            adminSandboxTest: true as const,
          });
        }
      }
    }

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

  const result = trialApplicationId
    ? await saveOrSubmitSubmissionForTrial(db, {
        trialApplicationId,
        sessionId,
        action,
        bodyText,
        submissionMode,
        attachments: attachments as PreparedAttachment[],
      })
    : grantId
      ? await saveOrSubmitSubmissionForRegular(db, {
          grantId,
          sessionId,
          action,
          bodyText,
          submissionMode,
          attachments: attachments as PreparedAttachment[],
        })
      : await saveOrSubmitSubmission(db, {
          userId: userId!,
          sessionId,
          action,
          bodyText,
          submissionMode,
          attachments: attachments as PreparedAttachment[],
        });

  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  return NextResponse.json({
    submissionId: result.submissionId,
    status: result.status,
  });
}
