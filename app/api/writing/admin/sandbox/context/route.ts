import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getDb } from "../../../../../../server/db/client";
import { requireAdminUserId } from "../../../../../../server/lib/adminAuth";
import {
  adminSandboxCookieMaxAgeSeconds,
  adminSandboxCookieName,
  appendAdminSandboxAudit,
  deleteAdminSandboxContextByAdmin,
  loadAdminSandboxContextById,
  upsertAdminSandboxContext,
  validateAdminSandboxSelection,
  type AdminSandboxMode,
  buildAdminSandboxCurrentSessionResponse,
} from "../../../../../../server/services/adminSandboxService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BODY_MODES = new Set(["trial", "regular", "academy"]);

function parseJson(req: Request): Promise<Record<string, unknown>> {
  return req.json().catch(() => ({})) as Promise<Record<string, unknown>>;
}

/**
 * GET /api/writing/admin/sandbox/context — current sandbox + env hints for UI (admin only).
 */
export async function GET() {
  const auth = await requireAdminUserId();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }

  const c = await cookies();
  const id = c.get(adminSandboxCookieName())?.value?.trim();
  const db = getDb();

  if (!id) {
    return NextResponse.json({
      ok: true,
      active: false,
      hints: {
        trialCourseId: process.env.WRITING_TRIAL_COURSE_ID?.trim() ?? null,
        regularAllowlistActive: Boolean(process.env.ADMIN_SANDBOX_REGULAR_ALLOWED_COURSE_IDS?.trim()),
        academyAllowlist: process.env.ADMIN_SANDBOX_ACADEMY_COURSE_IDS?.trim() ?? null,
      },
    });
  }

  const ctx = await loadAdminSandboxContextById(db, id, auth.userId);
  if (!ctx) {
    return NextResponse.json({
      ok: true,
      active: false,
      hints: {
        trialCourseId: process.env.WRITING_TRIAL_COURSE_ID?.trim() ?? null,
        regularAllowlistActive: Boolean(process.env.ADMIN_SANDBOX_REGULAR_ALLOWED_COURSE_IDS?.trim()),
        academyAllowlist: process.env.ADMIN_SANDBOX_ACADEMY_COURSE_IDS?.trim() ?? null,
      },
    });
  }

  const sessionJson = await buildAdminSandboxCurrentSessionResponse(db, ctx);
  return NextResponse.json({
    ok: true,
    active: true,
    context: {
      id: ctx.id,
      mode: ctx.mode,
      courseId: ctx.courseId,
      sessionId: ctx.sessionId,
      termId: ctx.termId,
      expiresAt: ctx.expiresAt.toISOString(),
    },
    sessionPreview: sessionJson,
    hints: {
      trialCourseId: process.env.WRITING_TRIAL_COURSE_ID?.trim() ?? null,
      regularAllowlistActive: Boolean(process.env.ADMIN_SANDBOX_REGULAR_ALLOWED_COURSE_IDS?.trim()),
      academyAllowlist: process.env.ADMIN_SANDBOX_ACADEMY_COURSE_IDS?.trim() ?? null,
    },
  });
}

/**
 * POST /api/writing/admin/sandbox/context — activate or replace sandbox (admin only).
 * Body: { mode, courseId, sessionId, termId? } — IDs revalidated from DB.
 */
export async function POST(req: Request) {
  const auth = await requireAdminUserId();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }

  const body = await parseJson(req);
  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const termId =
    typeof body.termId === "string" && body.termId.trim().length > 0 ? body.termId.trim() : null;

  if (!BODY_MODES.has(mode) || !courseId || !sessionId) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();
  const v = await validateAdminSandboxSelection(db, {
    mode: mode as AdminSandboxMode,
    courseId,
    sessionId,
  });
  if (!v.ok) {
    await appendAdminSandboxAudit(db, {
      adminUserId: auth.userId,
      action: "sandbox_activate",
      mode,
      courseId,
      sessionId,
      success: false,
      detail: { code: v.code },
    });
    return NextResponse.json({ ok: false, error: v.code }, { status: 400 });
  }

  const { contextId, expiresAt } = await upsertAdminSandboxContext(db, {
    adminUserId: auth.userId,
    mode: mode as AdminSandboxMode,
    courseId,
    sessionId,
    termId,
  });

  const cookieStore = await cookies();
  cookieStore.set(adminSandboxCookieName(), contextId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: adminSandboxCookieMaxAgeSeconds(),
  });

  await appendAdminSandboxAudit(db, {
    adminUserId: auth.userId,
    action: "sandbox_activate",
    mode,
    courseId,
    sessionId,
    success: true,
    detail: { contextId },
  });

  return NextResponse.json({
    ok: true,
    contextId,
    expiresAt: expiresAt.toISOString(),
  });
}

/**
 * DELETE /api/writing/admin/sandbox/context — clear cookie + DB row (admin only).
 */
export async function DELETE() {
  const auth = await requireAdminUserId();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason === "unauthorized" ? "unauthorized" : "forbidden" },
      { status: auth.reason === "unauthorized" ? 401 : 403 }
    );
  }

  const db = getDb();
  await deleteAdminSandboxContextByAdmin(db, auth.userId);
  const cookieStore = await cookies();
  cookieStore.delete(adminSandboxCookieName());

  await appendAdminSandboxAudit(db, {
    adminUserId: auth.userId,
    action: "sandbox_clear",
    success: true,
  });

  return NextResponse.json({ ok: true });
}
