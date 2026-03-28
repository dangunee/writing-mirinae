import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import { getCurrentSessionForStudent } from "../../../../../server/services/writingStudentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/writing/sessions/current
 * Security: session user only; no query params trusted for identity.
 * Rate limiting: add edge limits per IP/user (not implemented here).
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const result = await getCurrentSessionForStudent(db, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result);
}
