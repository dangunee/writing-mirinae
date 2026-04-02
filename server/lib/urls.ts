/**
 * Security: only allow redirects to configured URL prefixes (exact prefix match).
 * Set CHECKOUT_REDIRECT_ALLOWLIST to comma-separated full URL prefixes, e.g.
 * https://mirinae.jp/writing,https://localhost:5173/writing
 * (success URL 예: …/writing/app/complete — prefix가 …/writing 이면 허용)
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
    console.warn("checkout_redirect_rejected", { reason: "redirect_url_missing" });
    throw new Error("redirect_url_missing");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    console.warn("checkout_redirect_rejected", {
      reason: "redirect_url_invalid",
      urlPreview: trimmed.slice(0, 120),
    });
    throw new Error("redirect_url_invalid");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    console.warn("checkout_redirect_rejected", {
      reason: "redirect_url_invalid_protocol",
      protocol: parsed.protocol,
    });
    throw new Error("redirect_url_invalid_protocol");
  }
  if (allowlist.length === 0) {
    console.warn("checkout_redirect_rejected", {
      reason: "CHECKOUT_REDIRECT_ALLOWLIST_empty",
      url: trimmed.slice(0, 200),
      allowlistPrefixes: [] as string[],
    });
    throw new Error("redirect_url_not_allowlisted");
  }
  const ok = allowlist.some((prefix) => trimmed.startsWith(prefix));
  if (!ok) {
    console.warn("checkout_redirect_rejected", {
      reason: "no_prefix_match",
      url: trimmed.slice(0, 200),
      allowlistPrefixes: allowlist,
    });
    throw new Error("redirect_url_not_allowlisted");
  }
}
