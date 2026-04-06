import { NextResponse } from "next/server";

import { resolveOAuthRedirectOrigin } from "../../../../../server/lib/authOrigin";
import { createSupabaseServerClient } from "../../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/oauth/google — starts Supabase OAuth (PKCE + state handled by @supabase/ssr).
 * Uses signInWithOAuth (same as login): existing Google identity signs into the same auth user; no app-side "signup" fork.
 */
export async function GET(request: Request) {
  const origin = resolveOAuthRedirectOrigin(request);
  if (!origin) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 400 });
  }

  const callbackUrl = `${origin}/api/auth/callback`;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    if (error || !data.url) {
      console.error("oauth_google_start_failed", error?.message);
      return NextResponse.json({ ok: false, error: "oauth_unavailable" }, { status: 500 });
    }
    return NextResponse.redirect(data.url);
  } catch (e) {
    console.error("oauth_google_start_failed", e);
    return NextResponse.json({ ok: false, error: "oauth_unavailable" }, { status: 500 });
  }
}
