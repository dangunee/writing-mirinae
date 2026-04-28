import { NextResponse } from "next/server";

import { getDb } from "../../../../../../../server/db/client";
import { requireAdminSessionUserId } from "../../../../../../../server/lib/requireAdminSession";
import { trashTrialApplication } from "../../../../../../../server/services/trialApplicationsAdminService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/writing/admin/trial-applications/[id]/trash — soft-delete (admin session). Body: { trashReason?: string } */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminSessionUserId();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: admin.status });
  }

  const { id: applicationId } = await context.params;
  let trashReason: string | null = null;
  try {
    const raw = await req.text();
    if (raw?.trim()) {
      const body = JSON.parse(raw) as { trashReason?: unknown };
      if (typeof body.trashReason === "string") trashReason = body.trashReason;
    }
  } catch {
    trashReason = null;
  }

  try {
    const db = getDb();
    const out = await trashTrialApplication(db, applicationId, admin.userId, trashReason);
    if (!out.ok) {
      return NextResponse.json({ ok: false, error: out.code }, { status: out.status });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("trial-admin trash route error", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
