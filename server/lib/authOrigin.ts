/**
 * OAuth callback redirects and Referer validation — allowlisted origins only (no open redirects).
 */

/** Known writing-app deploy origins (env may duplicate; Set dedupes). No wildcards. */
const WRITING_APP_STATIC_ORIGINS = [
  "https://writing-mirinae.vercel.app",
  "https://mirinae.jp",
] as const;

export function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const proto = forwardedProto || "https";
    return `${proto}://${forwardedHost.split(",")[0].trim()}`;
  }
  return new URL(request.url).origin;
}

export function collectAllowedOrigins(): Set<string> {
  const allowed = new Set<string>();
  for (const o of WRITING_APP_STATIC_ORIGINS) {
    allowed.add(o);
  }
  for (const key of ["NEXT_PUBLIC_SITE_URL", "SITE_URL"] as const) {
    const v = process.env[key]?.trim();
    if (v) {
      try {
        allowed.add(new URL(v.endsWith("/") ? v : `${v}/`).origin);
      } catch {
        /* ignore */
      }
    }
  }
  if (process.env.NODE_ENV === "development") {
    for (const o of [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]) {
      allowed.add(o);
    }
  }
  return allowed;
}

export function isAllowedOrigin(origin: string): boolean {
  return collectAllowedOrigins().has(origin);
}

/**
 * OAuth start: only trust Referer or Origin when they match the allowlist (blocks arbitrary redirect chains).
 */
export function resolveOAuthRedirectOrigin(request: Request): string | null {
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const o = new URL(referer).origin;
      if (isAllowedOrigin(o)) return o;
    } catch {
      /* ignore */
    }
  }
  const originHeader = request.headers.get("origin");
  if (originHeader && isAllowedOrigin(originHeader)) return originHeader;
  return null;
}
