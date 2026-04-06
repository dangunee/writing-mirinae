import { NextResponse } from "next/server";

import { findAuthUserIdByEmail } from "../../../../server/lib/authUsersLookup";
import { getIdentityProvidersForUserId } from "../../../../server/lib/authIdentitiesLookup";
import { createSupabaseServerClient } from "../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  password?: string;
};

/**
 * POST /api/auth/login — email/password; sets Supabase cookie session.
 * Never returns provider error messages to the client (enumeration / detail).
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
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "missing_credentials" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const normalized = email.trim().toLowerCase();
      const existingId = await findAuthUserIdByEmail(normalized);
      if (existingId) {
        const providers = await getIdentityProvidersForUserId(existingId);
        if (!providers.includes("email")) {
          if (providers.includes("google")) {
            return NextResponse.json(
              { ok: false, error: "wrong_login_method", expected: "google" },
              { status: 401 }
            );
          }
          if (providers.includes("line")) {
            return NextResponse.json(
              { ok: false, error: "wrong_login_method", expected: "line" },
              { status: 401 }
            );
          }
        }
      }
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }
    if (!data.session || !data.user) {
      return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("auth_login_failed", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
