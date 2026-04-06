import { NextResponse } from "next/server";

import { findAuthUserIdByEmail } from "../../../../../server/lib/authUsersLookup";
import { userHasProvider } from "../../../../../server/lib/authIdentitiesLookup";
import { resolveAuthAppOrigin } from "../../../../../server/lib/authOrigin";
import { encryptEmailLinkPassword } from "../../../../../server/lib/emailLinkPasswordCrypto";
import { createEmailVerificationToken } from "../../../../../server/lib/emailVerificationToken";
import { validatePasswordPolicy } from "../../../../../server/lib/passwordPolicy";
import { getSessionUser } from "../../../../../server/lib/supabaseServer";
import { sendEmailVerificationEmail } from "../../../../../server/services/emailVerificationEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  password?: string;
};

/**
 * POST — add email/password to the current session user (verification email; same JSON when skipped).
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || !password) {
    return NextResponse.json({ ok: true });
  }

  const policyErr = validatePasswordPolicy(password);
  if (policyErr) {
    return NextResponse.json({ ok: true });
  }

  const normalized = emailRaw.toLowerCase();
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (await userHasProvider(session.id, "email")) {
      return NextResponse.json({ ok: false, error: "already_linked" }, { status: 400 });
    }

    const ownerId = await findAuthUserIdByEmail(normalized);
    if (ownerId && ownerId !== session.id) {
      return NextResponse.json({ ok: true });
    }

    const origin = resolveAuthAppOrigin(req);
    if (!origin) {
      return NextResponse.json({ ok: true });
    }

    const passwordEncrypted = encryptEmailLinkPassword(password);
    const { plain } = await createEmailVerificationToken({
      userId: session.id,
      purpose: "email_link",
      pendingEmail: normalized,
      passwordEncrypted,
    });
    const verifyUrl = `${origin}/writing/verify-email?token=${encodeURIComponent(plain)}`;
    await sendEmailVerificationEmail({
      to: normalized,
      verifyUrl,
      subject: "【ミリネ韓国語教室】メールログインの確認",
    });
  } catch (e) {
    console.error("link_email_send_failed", e);
  }

  return NextResponse.json({ ok: true });
}
