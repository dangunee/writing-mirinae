import { NextResponse } from "next/server";

import { findAuthUserIdByEmail } from "../../../../server/lib/authUsersLookup";
import {
  getPublicOrigin,
  isAllowedOrigin,
  resolveOAuthRedirectOrigin,
} from "../../../../server/lib/authOrigin";
import { createPasswordResetToken } from "../../../../server/lib/passwordResetToken";
import { sendPasswordResetEmail } from "../../../../server/services/passwordResetEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string };

function resolveAppOrigin(request: Request): string | null {
  const fromRefererOrOrigin = resolveOAuthRedirectOrigin(request);
  if (fromRefererOrOrigin) return fromRefererOrOrigin;
  const o = request.headers.get("origin");
  if (o && isAllowedOrigin(o)) return o;
  const pub = getPublicOrigin(request);
  if (isAllowedOrigin(pub)) return pub;
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) {
    try {
      const origin = new URL(env.endsWith("/") ? env : `${env}/`).origin;
      if (isAllowedOrigin(origin)) return origin;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * POST /api/auth/forgot-password — always same JSON success (no email enumeration).
 * Sends our one-time link (15 min) when an auth user exists for the email.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ ok: true });
  }

  const origin = resolveAppOrigin(req);
  if (!origin) {
    return NextResponse.json({ ok: true });
  }

  try {
    const userId = await findAuthUserIdByEmail(email);
    if (userId) {
      const { plain } = await createPasswordResetToken(userId);
      const resetUrl = `${origin}/writing/reset-password?token=${encodeURIComponent(plain)}`;
      await sendPasswordResetEmail({ to: email, resetUrl });
    }
  } catch (e) {
    console.error("auth_forgot_password_failed", e);
  }

  return NextResponse.json({ ok: true });
}
