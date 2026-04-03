import { createHmac, timingSafeEqual } from "crypto";

const VERSION = 1;
const KIND = "regular" as const;

function secret(): string {
  const s = process.env.TRIAL_SESSION_SECRET?.trim();
  if (!s) {
    throw new Error("TRIAL_SESSION_SECRET is required for regular writing session");
  }
  return s;
}

/**
 * Signed cookie (same algorithm as mirinae-api). Payload: grantId + exp + kind.
 */
export function verifyRegularWritingSessionCookie(cookieValue: string): { grantId: string } | null {
  const parts = cookieValue.trim().split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: { v?: number; kind?: string; grantId?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as typeof parsed;
  } catch {
    return null;
  }
  if (
    parsed.v !== VERSION ||
    parsed.kind !== KIND ||
    typeof parsed.grantId !== "string" ||
    typeof parsed.exp !== "number"
  ) {
    return null;
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return { grantId: parsed.grantId };
}

const REGULAR_COOKIE_RE = /(?:^|;\s*)writing_regular_access=([^;]+)/;

export function parseRegularWritingGrantIdFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader?.trim()) return null;
  const m = cookieHeader.match(REGULAR_COOKIE_RE);
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  try {
    return verifyRegularWritingSessionCookie(decodeURIComponent(raw))?.grantId ?? null;
  } catch {
    return null;
  }
}
