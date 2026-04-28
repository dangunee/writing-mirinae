import { NextResponse } from "next/server";

import { getDb } from "../../../../../server/db/client";
import { parseRegularWritingGrantIdFromCookieHeader } from "../../../../../server/lib/regularSessionCookie";
import { getSessionUserId } from "../../../../../server/lib/supabaseServer";
import {
  getPublishedRegularResult,
  getPublishedWritingResultForViewer,
} from "../../../../../server/services/writingStudentService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/writing/results/:id
 * `:id` = submission id. Published correction only (draft never returned). Missed sessions return missed-safe payload.
 * Students: owner-only. Teachers/admins: same published-safe payload for any submission id (audit log on staff path).
 */
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id: submissionId } = await context.params;
  const db = getDb();

  const userId = await getSessionUserId();
  if (userId) {
    const result = await getPublishedWritingResultForViewer(db, userId, submissionId);
    if (!result) {
      return NextResponse.json({ error: "not_found_or_not_published" }, { status: 404 });
    }
    return NextResponse.json(result);
  }

  const grantId = parseRegularWritingGrantIdFromCookieHeader(req.headers.get("cookie"));
  if (!grantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getPublishedRegularResult(db, grantId, submissionId);
  if (!result) {
    return NextResponse.json({ error: "not_found_or_not_published" }, { status: 404 });
  }

  return NextResponse.json(result);
}
