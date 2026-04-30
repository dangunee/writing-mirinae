import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = 1;

/**
 * Verifies `writing_trial_access` cookie set by mirinae-api consume (same HMAC as mirinae-api
 * server/lib/trial/sessionCookie.ts). Requires identical TRIAL_SESSION_SECRET on this app.
 */
function secret(): string | null {
  const s = process.env.TRIAL_SESSION_SECRET?.trim();
  return s || null;
}

export function verifyTrialWritingSessionCookie(cookieValue: string): { applicationId: string } | null {
  const sec = secret();
  if (!sec) return null;

  const parts = cookieValue.trim().split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", sec).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: { v?: number; applicationId?: string; exp?: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as typeof parsed;
  } catch {
    return null;
  }
  if (parsed.v !== VERSION || typeof parsed.applicationId !== "string" || typeof parsed.exp !== "number") {
    return null;
  }
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return { applicationId: parsed.applicationId };
}

/** Extract signed trial application id from raw Cookie header (no logging of raw cookie). */
export function parseWritingTrialAccessApplicationId(cookieHeader: string): string | null {
  const m = cookieHeader.match(/(?:^|;\s*)writing_trial_access=([^;]+)/);
  if (!m?.[1]) return null;
  let raw = m[1].trim();
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const v = verifyTrialWritingSessionCookie(raw);
  return v?.applicationId ?? null;
}
