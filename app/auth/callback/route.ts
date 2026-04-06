import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getPublicOrigin, isAllowedOrigin } from "../../../server/lib/authOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGIN_WITH_AUTH_ERROR = "/writing/login";

function requireSupabaseEnv(): { url: string; anon: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }
  return { url, anon };
}

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

/**
 * Same env + cookie read path as createSupabaseServerClient, but session cookies from
 * exchangeCodeForSession must be written via the redirect response's cookies API so
 * Set-Cookie is attached to the outgoing NextResponse (next/headers alone can miss this).
 */
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
    const { url: supabaseUrl, anon } = requireSupabaseEnv();
    const cookieStore = await cookies();
    const redirectUrl = `${origin}${nextPath}`;
    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(supabaseUrl, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth_callback_exchange_failed", error.message);
      return NextResponse.redirect(`${origin}${LOGIN_WITH_AUTH_ERROR}?auth_error=exchange_failed`);
    }
    console.log("[auth/callback] exchange_ok", { nextPath });
    return response;
  } catch (e) {
    console.error("auth_callback_failed", e);
    return NextResponse.redirect(`${origin}${LOGIN_WITH_AUTH_ERROR}?auth_error=exchange_failed`);
  }
}
