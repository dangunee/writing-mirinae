import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { parseRegularWritingGrantIdFromCookieHeader } from "../../../../../../server/lib/regularSessionCookie";
import { fetchTrialApplicationIdFromMirinaeSessionCookie } from "../../../../../../server/lib/writingTrialUpstream";
import { resolveLinkedTrialApplicationForWritingSession } from "../../../../../../server/services/trialLinkedUserWritingSession";
import { requireWritingSubmissionEntitlement, resolveRoleFromEnv } from "../../../../../../server/lib/authMe";
import { parseWritingSubmissionPost } from "../../../../../../server/lib/parseWritingSubmissionPost";
import { getSessionUserId } from "../../../../../../server/lib/supabaseServer";
import { resolveWritingRoleFromDbOrEnv } from "../../../../../../server/lib/writingAuthRoles";
import * as writingStudentRepo from "../../../../../../server/repositories/writingStudentRepository";
import {
  appendAdminSandboxAudit,
  loadAdminSandboxContextById,
  parseAdminSandboxContextIdFromCookieHeader,
  sandboxSubmitErrorMessage,
  writeAdminSandboxTestSubmission,
  type AdminSandboxMode,
} from "../../../../../../server/services/adminSandboxService";
import type { PreparedAttachment } from "../../../../../../server/services/writingSubmissionInternal";
import {
  saveOrSubmitSubmission,
  saveOrSubmitSubmissionForRegular,
  saveOrSubmitSubmissionForTrial,
} from "../../../../../../server/services/writingStudentService";
import { mapTrialWritingErrorToPublic } from "../../../../../../server/lib/trialWritingPublicErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trialParseErrorToPublic(internal: string): string {
  switch (internal) {
    case "body_text_over_limit":
      return "body_text_over_limit";
    default:
      return "internal_error";
  }
}

/**
 * POST /api/writing/sessions/:id/submission
 * Identity: trial cookie (mirinae-api) first → regular grant cookie → Supabase session userId.
 * Never trust userId / trialApplicationId from body (forbidden keys rejected below).
 */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  console.info("[submission] route_enter");
  console.time("[submission] POST_total");
  try {
    return await postSubmissionHandler(req, context);
  } catch (e) {
    console.error("[submission] unhandled_exception", {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json({ ok: false as const, error: "internal_error" as const }, { status: 500 });
  } finally {
    console.timeEnd("[submission] POST_total");
  }
}

async function postSubmissionHandler(req: Request, context: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id: sessionId } = await context.params;
  console.info("[submission] handler_context", {
    sessionIdPrefix: sessionId.slice(0, 8),
  });

  const cookieHeader = req.headers.get("cookie");
  let trialApplicationId = await fetchTrialApplicationIdFromMirinaeSessionCookie(cookieHeader);
  const grantId = parseRegularWritingGrantIdFromCookieHeader(cookieHeader);
  const userId = await getSessionUserId();

  if (!trialApplicationId && userId && !grantId) {
    const linked = await resolveLinkedTrialApplicationForWritingSession(db, userId);
    trialApplicationId = linked?.id ?? null;
  }

  const parsed = await parseWritingSubmissionPost(req);
  if (!parsed.ok) {
    if (trialApplicationId) {
      const pub = trialParseErrorToPublic(parsed.error);
      console.warn("[submission] parse_failed_trial", {
        internal: parsed.error,
        public: pub,
        status: parsed.status,
      });
      return NextResponse.json({ ok: false as const, error: pub }, { status: parsed.status });
    }
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { action, bodyText, attachments, submissionMode } = parsed;

  const insertPath: "trial" | "regular_grant" | "session_user" = trialApplicationId
    ? "trial"
    : grantId
      ? "regular_grant"
      : "session_user";

  if (trialApplicationId) {
    console.info("[submission] trial_enter", {
      sessionIdPrefix: sessionId.slice(0, 8),
      trialApplicationIdPrefix: trialApplicationId.slice(0, 8),
      action,
      insertPath,
    });
  }

  console.info("[submission] identity_resolved", {
    sessionIdPrefix: sessionId.slice(0, 8),
    trialApplicationIdPrefix: trialApplicationId ? trialApplicationId.slice(0, 8) : null,
    insertPath,
    hasGrantCookie: Boolean(grantId),
    hasSupabaseSession: Boolean(userId),
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
      const ctxId = parseAdminSandboxContextIdFromCookieHeader(cookieHeader)?.trim();
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
            console.warn("submission_admin_sandbox_failed", {
              sessionId,
              userId,
              status: r.status,
              code: r.code,
              message: sandboxSubmitErrorMessage(r.code),
            });
            await appendAdminSandboxAudit(db, {
              adminUserId: userId,
              action: "sandbox_submit",
              mode: ctx.mode,
              courseId: ctx.courseId,
              sessionId,
              success: false,
              detail: { code: r.code },
            });
            return NextResponse.json(
              {
                error: r.code,
                code: r.code,
                message: sandboxSubmitErrorMessage(r.code),
              },
              { status: r.status }
            );
          }
          await appendAdminSandboxAudit(db, {
            adminUserId: userId,
            action: "sandbox_submit",
            mode: ctx.mode,
            courseId: ctx.courseId,
            sessionId,
            success: true,
            detail: { submissionId: r.submissionId, alreadySubmitted: r.alreadySubmitted },
          });
          return NextResponse.json({
            submissionId: r.submissionId,
            status: r.status,
            adminSandboxTest: true as const,
            ...(r.alreadySubmitted ? { alreadySubmitted: true as const } : {}),
          });
        }
        if (ctx && ctx.sessionId !== sessionId) {
          console.warn("submission_admin_sandbox_session_mismatch", {
            cookieSessionId: ctx.sessionId,
            pathSessionId: sessionId,
            userId,
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
    console.warn("[submission] failed", {
      insertPath,
      sessionIdPrefix: sessionId.slice(0, 8),
      trialApplicationIdPrefix: trialApplicationId ? trialApplicationId.slice(0, 8) : null,
      status: result.status,
      codeInternal: result.code,
    });
    if (trialApplicationId) {
      const pub = mapTrialWritingErrorToPublic(result.code);
      console.warn("[submission] failed_trial_public_code", {
        sessionIdPrefix: sessionId.slice(0, 8),
        codePublic: pub,
      });
      return NextResponse.json({ ok: false as const, error: pub }, { status: result.status });
    }
    return NextResponse.json({ error: result.code }, { status: result.status });
  }

  if (trialApplicationId) {
    console.info("[submission] trial_ok", {
      sessionIdPrefix: sessionId.slice(0, 8),
      trialApplicationIdPrefix: trialApplicationId.slice(0, 8),
      submissionIdPrefix: result.submissionId.slice(0, 8),
      status: result.status,
    });
  }

  return NextResponse.json({
    ok: true as const,
    submissionId: result.submissionId,
    status: result.status,
  });
}
