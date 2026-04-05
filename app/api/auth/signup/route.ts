import { NextResponse } from "next/server";

import { getPublicOrigin } from "../../../../server/lib/authOrigin";
import { validatePasswordPolicy } from "../../../../server/lib/passwordPolicy";
import { createSupabaseServerClient } from "../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  password?: string;
  passwordConfirm?: string;
  fullName?: string;
  termsAccepted?: boolean;
};

/**
 * POST /api/auth/signup — email/password + display name in user_metadata only.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const termsAccepted = body.termsAccepted === true;

  if (!email || !password || !fullName) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }
  if (!termsAccepted) {
    return NextResponse.json({ ok: false, error: "terms_required" }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ ok: false, error: "password_mismatch" }, { status: 400 });
  }

  const policyErr = validatePasswordPolicy(password);
  if (policyErr) {
    return NextResponse.json({ ok: false, error: "password_policy", message: policyErr }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const origin = getPublicOrigin(req);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/writing/login`,
        data: {
          full_name: fullName,
        },
      },
    });
    if (error) {
      console.error("auth_signup_supabase", error.message);
      return NextResponse.json({ ok: false, error: "signup_failed" }, { status: 400 });
    }
    if (!data.user) {
      console.error("auth_signup_no_user");
      return NextResponse.json({ ok: false, error: "signup_failed" }, { status: 400 });
    }
    const needsEmailConfirmation = !data.session;
    return NextResponse.json({ ok: true, needsEmailConfirmation });
  } catch (e) {
    console.error("auth_signup_failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
