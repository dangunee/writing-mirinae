import { NextResponse } from "next/server";

import { getPublicOrigin, isAllowedOrigin } from "../../../../../../server/lib/authOrigin";
import { createSupabaseServerClient } from "../../../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth link callback — Google identity attached to current session user.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getPublicOrigin(request);

  if (!isAllowedOrigin(origin)) {
    return NextResponse.redirect(`${origin}/writing/login?error=oauth`);
  }

  const err = url.searchParams.get("error") ?? url.searchParams.get("error_description");
  if (err) {
    return NextResponse.redirect(`${origin}/writing/app/settings?link_error=oauth_cancel`);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/writing/app/settings?link_error=oauth`);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth_link_google_callback_exchange_failed", error.message);
      const msg = error.message.toLowerCase();
      const code =
        msg.includes("already") || msg.includes("identity") || msg.includes("linked")
          ? "provider_already_used"
          : "oauth";
      return NextResponse.redirect(`${origin}/writing/app/settings?link_error=${code}`);
    }
    return NextResponse.redirect(`${origin}/writing/app/settings?linked=google`);
  } catch (e) {
    console.error("auth_link_google_callback_failed", e);
    return NextResponse.redirect(`${origin}/writing/app/settings?link_error=oauth`);
  }
}
