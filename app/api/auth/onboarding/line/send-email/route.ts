import { NextResponse } from "next/server";

import { findAuthUserIdByEmail } from "../../../../../../server/lib/authUsersLookup";
import { userHasProvider } from "../../../../../../server/lib/authIdentitiesLookup";
import { resolveAuthAppOrigin } from "../../../../../../server/lib/authOrigin";
import { createEmailVerificationToken } from "../../../../../../server/lib/emailVerificationToken";
import { getSessionUser } from "../../../../../../server/lib/supabaseServer";
import { sendEmailVerificationEmail } from "../../../../../../server/services/emailVerificationEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string };

/**
 * POST — request email verification for LINE onboarding (same JSON on success / skip / conflict).
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ ok: true });
  }

  const normalized = emailRaw.toLowerCase();
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: true });
  }

  try {
    const hasLine = await userHasProvider(session.id, "line");
    if (!hasLine) {
      return NextResponse.json({ ok: true });
    }

    const ownerId = await findAuthUserIdByEmail(normalized);
    if (ownerId && ownerId !== session.id) {
      return NextResponse.json({ ok: true });
    }

    const origin = resolveAuthAppOrigin(req);
    if (!origin) {
      return NextResponse.json({ ok: true });
    }

    const { plain } = await createEmailVerificationToken({
      userId: session.id,
      purpose: "line_onboarding",
      pendingEmail: normalized,
    });
    const verifyUrl = `${origin}/writing/verify-email?token=${encodeURIComponent(plain)}`;
    await sendEmailVerificationEmail({
      to: normalized,
      verifyUrl,
      subject: "【ミリネ韓国語教室】メールアドレスの確認",
    });
  } catch (e) {
    console.error("line_onboarding_send_email_failed", e);
  }

  return NextResponse.json({ ok: true });
}
