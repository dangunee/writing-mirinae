import { NextResponse } from "next/server";

import { profiles } from "../../../../../../db/schema";
import { getDb } from "../../../../../../server/db/client";
import { findAuthUserIdByEmail } from "../../../../../../server/lib/authUsersLookup";
import { userHasProvider } from "../../../../../../server/lib/authIdentitiesLookup";
import { getSessionUser } from "../../../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  email?: string;
  koreanLevel?: string;
  termsAccepted?: boolean;
};

/**
 * POST — finalize LINE onboarding (session + verified email on auth user).
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const koreanLevel =
    typeof body.koreanLevel === "string" && body.koreanLevel.trim().length > 0
      ? body.koreanLevel.trim()
      : null;
  const termsAccepted = body.termsAccepted === true;

  if (!name || !email || !termsAccepted) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const hasLine = await userHasProvider(session.id, "line");
  if (!hasLine) {
    return NextResponse.json({ ok: false, error: "invalid_session" }, { status: 400 });
  }

  const sessionEmail = session.email?.trim().toLowerCase() ?? "";
  if (!sessionEmail || sessionEmail !== email) {
    return NextResponse.json({ ok: false, error: "email_not_verified" }, { status: 400 });
  }

  const ownerId = await findAuthUserIdByEmail(email);
  if (ownerId && ownerId !== session.id) {
    return NextResponse.json({ ok: false, error: "email_conflict_existing_account" }, { status: 409 });
  }

  const db = getDb();
  const now = new Date();
  await db
    .insert(profiles)
    .values({
      id: session.id,
      email,
      name,
      koreanLevel,
      emailVerified: true,
      onboardingCompletedAt: now,
      termsAcceptedAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        email,
        name,
        koreanLevel,
        emailVerified: true,
        onboardingCompletedAt: now,
        termsAcceptedAt: now,
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true });
}
