import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireAdminUserId } from "../../../../../../server/lib/adminAuth";
import {
  adminSandboxCookieName,
  appendAdminSandboxAudit,
  loadAdminSandboxContextById,
  resetAdminSandboxSessionSubmissions,
} from "../../../../../../server/services/adminSandboxService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/writing/admin/sandbox/reset — delete QA + mirrored submission for current sandbox session (admin only).
 * Context cookie must be active; does not clear context (unlike DELETE /sandbox/context).
 */
export async function POST() {
  const auth = await requireAdminUserId();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }

  const cookieStore = await cookies();
  const contextId = cookieStore.get(adminSandboxCookieName())?.value?.trim();
  if (!contextId) {
    return NextResponse.json({ ok: false, error: "sandbox_inactive" }, { status: 400 });
  }

  const db = getDb();
  const ctx = await loadAdminSandboxContextById(db, contextId, auth.userId);
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "sandbox_inactive" }, { status: 400 });
  }

  const result = await resetAdminSandboxSessionSubmissions(db, {
    adminUserId: auth.userId,
    sessionId: ctx.sessionId,
  });

  if (!result.ok) {
    await appendAdminSandboxAudit(db, {
      adminUserId: auth.userId,
      action: "sandbox_reset_session",
      mode: ctx.mode,
      courseId: ctx.courseId,
      sessionId: ctx.sessionId,
      success: false,
      detail: { code: result.code },
    });
    return NextResponse.json({ ok: false, error: result.code }, { status: 400 });
  }

  await appendAdminSandboxAudit(db, {
    adminUserId: auth.userId,
    action: "sandbox_reset_session",
    mode: ctx.mode,
    courseId: ctx.courseId,
    sessionId: ctx.sessionId,
    success: true,
  });

  return NextResponse.json({ ok: true });
}
