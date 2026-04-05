import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { academyInvites } from "../../../../db/schema";
import { getDb } from "../../../../server/db/client";
import { recordInviteValidateFailed } from "../../../../server/lib/academyInviteMonitoring";
import { hashAcademyInviteToken } from "../../../../server/lib/academyInviteToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvalidReason = "expired" | "used" | "invalid";

/**
 * GET /api/academy-invites/validate?token= — public; no auth.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ valid: false as const, reason: "invalid" satisfies InvalidReason });
  }

  const tokenHash = hashAcademyInviteToken(token);
  const db = getDb();
  const rows = await db.select().from(academyInvites).where(eq(academyInvites.tokenHash, tokenHash)).limit(1);
  const inv = rows[0];
  if (!inv) {
    recordInviteValidateFailed({ reason: "invalid", tokenHash });
    return NextResponse.json({ valid: false as const, reason: "invalid" satisfies InvalidReason });
  }
  if (inv.revokedAt != null) {
    recordInviteValidateFailed({ reason: "invalid", tokenHash, inviteId: inv.id, detail: "revoked" });
    return NextResponse.json({ valid: false as const, reason: "invalid" satisfies InvalidReason });
  }
  if (inv.usedAt != null) {
    recordInviteValidateFailed({ reason: "used", tokenHash, inviteId: inv.id });
    return NextResponse.json({ valid: false as const, reason: "used" satisfies InvalidReason });
  }
  if (inv.expiresAt.getTime() <= Date.now()) {
    recordInviteValidateFailed({ reason: "expired", tokenHash, inviteId: inv.id });
    return NextResponse.json({ valid: false as const, reason: "expired" satisfies InvalidReason });
  }

  return NextResponse.json({
    valid: true as const,
    invitedEmail: inv.invitedEmail,
    invitedName: inv.invitedName,
    academyLabel: inv.academyLabel,
  });
}
