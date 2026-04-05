import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { academyInvites, academyUnlimitedGrants } from "../../../../db/schema";
import { getDb } from "../../../../server/db/client";
import { hashAcademyInviteToken, normalizeEmailForInvite } from "../../../../server/lib/academyInviteToken";
import {
  logInviteAcceptFailed,
  logInviteAcceptSuccess,
  type InviteAcceptFailReason,
} from "../../../../server/lib/academyInviteMonitoring";
import { createSupabaseServerClient, getSessionUserId } from "../../../../server/lib/supabaseServer";

function mapAcceptErrorToReason(msg: string): InviteAcceptFailReason {
  if (msg === "email_mismatch") return "mismatch";
  if (msg === "used") return "used";
  if (msg === "race") return "race";
  if (msg === "expired") return "expired";
  if (msg === "invalid_invite") return "invalid";
  return "server_error";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { token?: string };

/**
 * POST /api/academy-invites/accept — requires Supabase session; consumes invite once; grants academy unlimited.
 */
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const email = user.email;
  if (email == null || String(email).trim() === "") {
    logInviteAcceptFailed({ userId, reason: "no_email" });
    return NextResponse.json({ ok: false, error: "email_required_for_invite" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    logInviteAcceptFailed({ userId, reason: "missing_token" });
    return NextResponse.json({ ok: false, error: "missing_token" }, { status: 400 });
  }

  const tokenHash = hashAcademyInviteToken(token);
  const sessionEmail = normalizeEmailForInvite(email);

  const db = getDb();

  let inviteRowId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const found = await tx.select().from(academyInvites).where(eq(academyInvites.tokenHash, tokenHash)).limit(1);
      const inv = found[0];
      if (!inv) {
        throw new Error("invalid_invite");
      }
      inviteRowId = inv.id;
      if (inv.revokedAt != null) {
        throw new Error("invalid_invite");
      }
      if (inv.usedAt != null) {
        throw new Error("used");
      }
      if (inv.expiresAt.getTime() <= Date.now()) {
        throw new Error("expired");
      }
      if (inv.invitedEmail) {
        if (sessionEmail !== normalizeEmailForInvite(inv.invitedEmail)) {
          throw new Error("email_mismatch");
        }
      }

      const updated = await tx
        .update(academyInvites)
        .set({ usedAt: new Date(), usedByUserId: userId })
        .where(and(eq(academyInvites.id, inv.id), isNull(academyInvites.usedAt)))
        .returning({ id: academyInvites.id });

      if (updated.length === 0) {
        throw new Error("race");
      }

      await tx
        .insert(academyUnlimitedGrants)
        .values({ userId, inviteId: inv.id })
        .onConflictDoNothing({ target: academyUnlimitedGrants.userId });
    });

    if (inviteRowId) {
      logInviteAcceptSuccess({ userId, inviteId: inviteRowId });
    }

    return NextResponse.json({ ok: true, isAcademyUnlimited: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const reason = mapAcceptErrorToReason(msg);
    logInviteAcceptFailed({ userId, inviteId: inviteRowId, reason });
    if (msg === "email_mismatch") {
      return NextResponse.json({ ok: false, error: "email_mismatch" }, { status: 403 });
    }
    if (msg === "used" || msg === "race") {
      return NextResponse.json({ ok: false, error: "invite_unavailable" }, { status: 409 });
    }
    if (msg === "expired") {
      return NextResponse.json({ ok: false, error: "invite_unavailable" }, { status: 410 });
    }
    if (msg === "invalid_invite") {
      return NextResponse.json({ ok: false, error: "invite_unavailable" }, { status: 400 });
    }
    console.error("academy_invite_accept_failed", e);
    return NextResponse.json({ ok: false, error: "accept_failed" }, { status: 500 });
  }
}
