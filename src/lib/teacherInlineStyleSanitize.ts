/**
 * Allowlist inline CSS for teacher correction HTML (paste / save / student render).
 * No url(), expression(), behavior, @import, etc.
 */

const UNSAFE_CSS_TOKEN =
  /url\s*\(|expression\s*\(|behavior\s*:|@import|javascript\s*:|var\s*\(|binding\s*:|-moz-binding/i;

/** Normalized property names we keep (lowercase, unprefixed canonical form). */
const ALLOWED_PROPERTIES = new Set([
  "color",
  "background-color",
  "text-decoration",
  "text-decoration-line",
  "text-decoration-color",
  "text-decoration-style",
  "text-decoration-thickness",
  "text-underline-offset",
  "font-weight",
]);

/** Vendor prefixes we collapse to the canonical name above when values are safe. */
const VENDOR_PREFIX = /^-(webkit|moz|ms|o)-/i;

const BLOCKED_COLOR_NAMES =
  /^(expression|javascript|inherit|initial|unset|url|attr|behavior)$/i;

export function isSafeColorAttrValue(raw: string): boolean {
  const v = raw.trim().replace(/^["']|["']$/g, "");
  if (!v || v.length > 120) return false;
  if (UNSAFE_CSS_TOKEN.test(v)) return false;
  return isSafeColorOrDecorationValue(v);
}

/** color / background-color / text-decoration-color */
function isSafeColorOrDecorationValue(val: string): boolean {
  const v = val.trim();
  if (!v || v.length > 200) return false;
  if (UNSAFE_CSS_TOKEN.test(v)) return false;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return true;
  if (/^(transparent|currentcolor)$/i.test(v)) return true;
  if (/^rgba?\([^)]*\)$/i.test(v) && v.length <= 220) return true;
  if (/^hsla?\([^)]*\)$/i.test(v) && v.length <= 220) return true;
  if (/^[a-z][a-z0-9-]{2,35}$/i.test(v) && !BLOCKED_COLOR_NAMES.test(v)) return true;
  return false;
}

function isSafeFontWeightValue(val: string): boolean {
  const v = val.trim().toLowerCase();
  if (!v || v.length > 20) return false;
  if (UNSAFE_CSS_TOKEN.test(v)) return false;
  return /^(normal|bold|bolder|lighter|\d{3})$/.test(v);
}

/** text-decoration and related shorthands */
function isSafeTextDecorationValue(val: string): boolean {
  const v = val.trim();
  if (!v || v.length > 280) return false;
  if (UNSAFE_CSS_TOKEN.test(v)) return false;
  if (/[@{}]|!important/i.test(v)) return false;
  return /^[a-zA-Z0-9\s#%,.:/+_-]+$/i.test(v);
}

function isSafeThicknessOrOffset(val: string): boolean {
  const v = val.trim();
  if (!v || v.length > 40) return false;
  if (UNSAFE_CSS_TOKEN.test(v)) return false;
  return /^[\d.]+%?$|^(auto|from-font)$/i.test(v);
}

function canonicalProperty(prop: string): string | null {
  const p = prop.trim().toLowerCase();
  if (!p) return null;
  let stripped = p.replace(VENDOR_PREFIX, "");
  const alias: Record<string, string> = {
    "text-fill-color": "color",
  };
  if (alias[stripped]) stripped = alias[stripped];
  /** Skip noisy vendor-only props */
  if (stripped === "text-decoration-skip-ink") return null;
  if (ALLOWED_PROPERTIES.has(stripped)) return stripped;
  return null;
}

function isSafeValueForProperty(prop: string, val: string): boolean {
  if (!val.trim()) return false;
  if (UNSAFE_CSS_TOKEN.test(val)) return false;
  switch (prop) {
    case "color":
    case "background-color":
    case "text-decoration-color":
      return isSafeColorOrDecorationValue(val);
    case "text-decoration":
    case "text-decoration-line":
    case "text-decoration-style":
      return isSafeTextDecorationValue(val);
    case "text-decoration-thickness":
    case "text-underline-offset":
      return isSafeThicknessOrOffset(val);
    case "font-weight":
      return isSafeFontWeightValue(val);
    default:
      return false;
  }
}

/** Collapse duplicate properties (later wins → we keep last). */
export function sanitizeInlineStyleAllowlist(css: string): string {
  if (typeof css !== "string" || !css.trim()) return "";
  const chunks = css.split(";");
  const seen = new Map<string, string>();

  for (const chunk of chunks) {
    const idx = chunk.indexOf(":");
    if (idx === -1) continue;
    const rawProp = chunk.slice(0, idx).trim();
    const rawVal = chunk.slice(idx + 1).trim();
    const prop = canonicalProperty(rawProp);
    if (!prop || !rawVal) continue;
    if (!isSafeValueForProperty(prop, rawVal)) continue;
    seen.set(prop, rawVal.trim());
  }

  const order = [
    "color",
    "background-color",
    "font-weight",
    "text-decoration-line",
    "text-decoration-style",
    "text-decoration-color",
    "text-decoration-thickness",
    "text-underline-offset",
    "text-decoration",
  ];
  const out: string[] = [];
  for (const k of order) {
    const v = seen.get(k);
    if (v) out.push(`${k}:${v}`);
  }
  return out.join("; ");
}
