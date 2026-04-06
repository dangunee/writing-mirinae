import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { getLinkedTrialHistoryForMypage } from "../../../../../server/services/trialHistoryMypageService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/writing/mypage/trial-history — linked trial applications for the session user (newest first). */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const body = await getLinkedTrialHistoryForMypage(db, userId);
  return NextResponse.json(body);
}
