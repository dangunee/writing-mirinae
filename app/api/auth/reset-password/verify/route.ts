import { NextResponse } from "next/server";

import { findValidResetToken } from "../../../../../server/lib/passwordResetToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/reset-password/verify?token=
 * Read-only: does not consume the token.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ valid: false });
  }
  const row = await findValidResetToken(token);
  return NextResponse.json({ valid: row != null });
}
