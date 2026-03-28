/**
 * Security: only allow redirects to configured URL prefixes (exact prefix match).
 * Set CHECKOUT_REDIRECT_ALLOWLIST to comma-separated full URL prefixes, e.g.
 * https://mirinae.jp/writing,https://localhost:5173/writing
 * (success URL 예: …/writing/complete — prefix가 …/writing 이면 허용)
 */
export function parseCheckoutAllowlist(): string[] {
  const raw = process.env.CHECKOUT_REDIRECT_ALLOWLIST ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assertUrlAllowed(url: string, allowlist: string[]): void {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error("redirect_url_missing");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("redirect_url_invalid");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("redirect_url_invalid_protocol");
  }
  const ok = allowlist.some((prefix) => trimmed.startsWith(prefix));
  if (!ok) {
    throw new Error("redirect_url_not_allowlisted");
  }
}
