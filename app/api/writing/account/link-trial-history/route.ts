import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { getSessionUser } from "../../../../../server/lib/supabaseServer";
import { linkTrialApplicationsToUserByEmail } from "../../../../../server/services/trialApplicationLinkService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/writing/account/link-trial-history
 * Links writing.trial_applications (user_id IS NULL) to the session user when applicant_email matches.
 * user id / email from Supabase session only — never from the request body.
 */
export async function POST() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!session.email) {
    return NextResponse.json({ ok: false, error: "email_required" }, { status: 400 });
  }

  const db = getDb();
  const { matchedCount, linkedCount } = await linkTrialApplicationsToUserByEmail(
    db,
    session.id,
    session.email
  );

  return NextResponse.json({ ok: true, matchedCount, linkedCount });
}
