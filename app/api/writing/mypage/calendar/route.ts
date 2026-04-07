import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { getMypageCalendar } from "../../../../../server/services/writingMypageService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/writing/mypage/calendar — timeline events (submission / due / missed / corrected) after reconciliation. */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const data = await getMypageCalendar(db, userId);
  if (!data) {
    return NextResponse.json({ error: "no_active_course" }, { status: 404 });
  }

  return NextResponse.json(data);
}
