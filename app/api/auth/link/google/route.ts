import { NextResponse } from "next/server";

import { getPublicOrigin, isAllowedOrigin } from "../../../../../server/lib/authOrigin";
import { userHasProvider } from "../../../../../server/lib/authIdentitiesLookup";
import { createSupabaseServerClient } from "../../../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function startGoogleLink(request: Request): Promise<Response> {
  const origin = getPublicOrigin(request);
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/writing/login`);
    }
    if (await userHasProvider(user.id, "google")) {
      return NextResponse.json({ ok: false, error: "already_linked" }, { status: 400 });
    }
    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${origin}/api/auth/callback/link/google`,
      },
    });
    if (error || !data.url) {
      console.error("link_google_start_failed", error?.message);
      return NextResponse.json({ ok: false, error: "oauth_unavailable" }, { status: 500 });
    }
    return NextResponse.redirect(data.url);
  } catch (e) {
    console.error("link_google_start_failed", e);
    return NextResponse.json({ ok: false, error: "oauth_unavailable" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return startGoogleLink(request);
}

export async function POST(request: Request) {
  return startGoogleLink(request);
}
