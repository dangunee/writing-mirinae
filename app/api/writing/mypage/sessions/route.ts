import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { getMypageSessions } from "../../../../../server/services/writingMypageService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/writing/mypage/sessions — ordered session history for the active course. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const data = await getMypageSessions(db, userId);
  if (!data) {
    return NextResponse.json({ error: "no_active_course" }, { status: 404 });
  }

  return NextResponse.json(data);
}
