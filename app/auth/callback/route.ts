import { NextResponse } from "next/server";

import { getPublicOrigin, isAllowedOrigin } from "../../../server/lib/authOrigin";
import { createSupabaseServerClient } from "../../../server/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_WITH_AUTH_ERROR = "/writing/login";

function normalizeNext(next: string | null): string {
  const fallback = "/writing/app";
  if (!next) return fallback;
  let path = next.trim();
  try {
    path = decodeURIComponent(path);
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }
  const allowedPrefixes = ["/writing/app", "/writing/teacher"] as const;
  for (const prefix of allowedPrefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return path;
    }
  }
  return fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getPublicOrigin(request);

  if (!isAllowedOrigin(origin)) {
    return NextResponse.redirect(`${origin}${LOGIN_WITH_AUTH_ERROR}?auth_error=exchange_failed`);
  }

  const oauthErr = url.searchParams.get("error") ?? url.searchParams.get("error_description");
  if (oauthErr) {
    return NextResponse.redirect(`${origin}${LOGIN_WITH_AUTH_ERROR}?auth_error=access_denied`);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}${LOGIN_WITH_AUTH_ERROR}?auth_error=missing_code`);
  }

  const nextPath = normalizeNext(url.searchParams.get("next"));

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth_callback_exchange_failed", error.message);
      return NextResponse.redirect(`${origin}${LOGIN_WITH_AUTH_ERROR}?auth_error=exchange_failed`);
    }
    console.log("[auth/callback] exchange_ok", { nextPath });
    return NextResponse.redirect(`${origin}${nextPath}`);
  } catch (e) {
    console.error("auth_callback_failed", e);
    return NextResponse.redirect(`${origin}${LOGIN_WITH_AUTH_ERROR}?auth_error=exchange_failed`);
  }
}
