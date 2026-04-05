import { NextResponse } from "next/server";

import { validatePasswordPolicy } from "../../../../../server/lib/passwordPolicy";
import {
  findValidResetToken,
  markResetTokenUsed,
} from "../../../../../server/lib/passwordResetToken";
import { getServiceRoleClient } from "../../../../../server/lib/supabaseServiceRole";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  token?: string;
  password?: string;
  passwordConfirm?: string;
};

/**
 * POST /api/auth/reset-password/complete — consumes token (one-time) after successful password update.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  if (!token || !password) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ ok: false, error: "password_mismatch" }, { status: 400 });
  }

  const policyErr = validatePasswordPolicy(password);
  if (policyErr) {
    return NextResponse.json({ ok: false, error: "password_policy", message: policyErr }, { status: 400 });
  }

  const row = await findValidResetToken(token);
  if (!row) {
    return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 400 });
  }

  try {
    const admin = getServiceRoleClient();
    const { error } = await admin.auth.admin.updateUserById(row.userId, { password });
    if (error) {
      console.error("auth_reset_password_update_failed", error.message);
      return NextResponse.json({ ok: false, error: "reset_failed" }, { status: 400 });
    }
    await markResetTokenUsed(row.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("auth_reset_password_complete_failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
