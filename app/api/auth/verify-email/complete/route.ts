import { NextResponse } from "next/server";

import { profiles } from "../../../../../db/schema";
import { getDb } from "../../../../../server/db/client";
import {
  findValidEmailVerificationToken,
  markEmailVerificationTokenUsed,
} from "../../../../../server/lib/emailVerificationToken";
import { decryptEmailLinkPassword } from "../../../../../server/lib/emailLinkPasswordCrypto";
import { getServiceRoleClient } from "../../../../../server/lib/supabaseServiceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { token?: string };

/**
 * POST — consume one-time email verification token (LINE onboarding or email link).
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 400 });
  }

  const row = await findValidEmailVerificationToken(token);
  if (!row) {
    return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 400 });
  }

  try {
    const admin = getServiceRoleClient();

    if (row.purpose === "line_onboarding") {
      const { error } = await admin.auth.admin.updateUserById(row.userId, {
        email: row.pendingEmail,
        email_confirm: true,
      });
      if (error) {
        console.error("verify_email_line_onboarding_failed", error.message);
        return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });
      }
      const db = getDb();
      const now = new Date();
      await db
        .insert(profiles)
        .values({
          id: row.userId,
          email: row.pendingEmail,
          emailVerified: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: {
            email: row.pendingEmail,
            emailVerified: true,
            updatedAt: now,
          },
        });
    } else if (row.purpose === "email_link") {
      if (!row.passwordEncrypted) {
        return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 400 });
      }
      let password: string;
      try {
        password = decryptEmailLinkPassword(row.passwordEncrypted);
      } catch {
        return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
      }
      const { error } = await admin.auth.admin.updateUserById(row.userId, {
        email: row.pendingEmail,
        password,
        email_confirm: true,
      });
      if (error) {
        console.error("verify_email_link_failed", error.message);
        return NextResponse.json({ ok: false, error: "verify_failed" }, { status: 400 });
      }
      const db = getDb();
      const now = new Date();
      await db
        .insert(profiles)
        .values({
          id: row.userId,
          email: row.pendingEmail,
          emailVerified: true,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: {
            email: row.pendingEmail,
            emailVerified: true,
            updatedAt: now,
          },
        });
    }

    await markEmailVerificationTokenUsed(row.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("verify_email_complete_failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
