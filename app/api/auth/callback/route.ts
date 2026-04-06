import { NextResponse } from "next/server";

import { getPublicOrigin, isAllowedOrigin } from "../../../../server/lib/authOrigin";
import { detectGoogleEmailConflict } from "../../../../server/lib/googleEmailConflict";
import { createSupabaseServerClient } from "../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth callback — exchanges authorization code for session (cookies). Redirect target is allowlisted only.
 * Supabase validates OAuth state / PKCE via cookies set at OAuth start.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getPublicOrigin(request);

  if (!isAllowedOrigin(origin)) {
    return NextResponse.redirect(`${origin}/writing/login?error=oauth`);
  }

  const err = url.searchParams.get("error") ?? url.searchParams.get("error_description");
  if (err) {
    return NextResponse.redirect(`${origin}/writing/login?error=oauth`);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/writing/login?error=oauth`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth_oauth_callback_exchange_failed", error.message);
      return NextResponse.redirect(`${origin}/writing/login?error=oauth`);
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && (await detectGoogleEmailConflict(user))) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        `${origin}/writing/login?error=email_conflict_existing_account&existing_method=email`
      );
    }
    return NextResponse.redirect(`${origin}/writing/oauth-complete`);
  } catch (e) {
    console.error("auth_oauth_callback_failed", e);
    return NextResponse.redirect(`${origin}/writing/login?error=oauth`);
  }
}
