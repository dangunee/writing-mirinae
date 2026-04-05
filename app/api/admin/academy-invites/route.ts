import { NextResponse } from "next/server";

import { academyInvites } from "../../../../db/schema";
import { getDb } from "../../../../server/db/client";
import { generateAcademyInviteToken, hashAcademyInviteToken, normalizeEmailForInvite } from "../../../../server/lib/academyInviteToken";
import { logInviteCreated } from "../../../../server/lib/academyInviteMonitoring";
import { requireAdminSessionUserId } from "../../../../server/lib/requireAdminSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string | null;
  name?: string | null;
  academyLabel?: string | null;
  expiresInDays?: number;
};

function siteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? process.env.SITE_URL?.trim() ?? "";
  if (!raw) return null;
  try {
    return new URL(raw.endsWith("/") ? raw : `${raw}/`).origin;
  } catch {
    return null;
  }
}

/**
 * POST /api/admin/academy-invites — admin session only; returns one-time URL with raw token once.
 */
export async function POST(req: Request) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const origin = siteOrigin();
  if (!origin) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const rawDays = body.expiresInDays;
  const expiresInDays =
    typeof rawDays === "number" && Number.isFinite(rawDays)
      ? Math.min(365, Math.max(1, Math.floor(rawDays)))
      : 14;

  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
  const labelRaw = typeof body.academyLabel === "string" ? body.academyLabel.trim() : "";

  const plain = generateAcademyInviteToken();
  const tokenHash = hashAcademyInviteToken(plain);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  try {
    const db = getDb();
    const [inserted] = await db
      .insert(academyInvites)
      .values({
        tokenHash,
        invitedEmail: emailRaw ? normalizeEmailForInvite(emailRaw) : null,
        invitedName: nameRaw || null,
        academyLabel: labelRaw || null,
        expiresAt,
        createdByUserId: admin.userId,
      })
      .returning({ id: academyInvites.id });

    if (!inserted?.id) {
      throw new Error("insert_returned_no_id");
    }

    logInviteCreated({
      adminUserId: admin.userId,
      inviteId: inserted.id,
      hasInvitedEmail: Boolean(emailRaw),
    });

    const inviteUrl = `${origin}/writing/invite?token=${encodeURIComponent(plain)}`;

    return NextResponse.json({
      ok: true,
      inviteUrl,
    });
  } catch (e) {
    console.error("admin_academy_invites_create_failed", e);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
}
