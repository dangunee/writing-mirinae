import { NextResponse } from "next/server";
import type { Provider } from "@supabase/supabase-js";

import { resolveOAuthRedirectOrigin } from "../../../../../server/lib/authOrigin";
import { createSupabaseServerClient } from "../../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/oauth/line — starts Supabase OAuth (LINE must be enabled in Supabase Auth providers).
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
      provider: "line" as Provider,
      options: {
        redirectTo: callbackUrl,
      },
    });
    if (error || !data.url) {
      console.error("oauth_line_start_failed", error?.message);
      return NextResponse.json({ ok: false, error: "oauth_unavailable" }, { status: 500 });
    }
    return NextResponse.redirect(data.url);
  } catch (e) {
    console.error("oauth_line_start_failed", e);
    return NextResponse.json({ ok: false, error: "oauth_unavailable" }, { status: 500 });
  }
}
