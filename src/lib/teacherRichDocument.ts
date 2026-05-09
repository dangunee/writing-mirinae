/**
 * Rich correction payload for writing.corrections.rich_document_json (jsonb).
 * No DB schema change: stored as a small JSON object.
 */
import { TEACHER_RICH_FORMAT_HTML_V1 } from "./teacherRichDocumentFormat";
import { sanitizeTeacherCorrectionHtml } from "./teacherCorrectionSanitize";

export { TEACHER_RICH_FORMAT_HTML_V1 } from "./teacherRichDocumentFormat";

export type TeacherRichDocumentHtmlV1 = {
  format: typeof TEACHER_RICH_FORMAT_HTML_V1;
  html: string;
};

export function parseTeacherHtmlV1(json: unknown): string | null {
  if (json == null || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.format === TEACHER_RICH_FORMAT_HTML_V1 && typeof o.html === "string") {
    return o.html;
  }
  return null;
}

export function buildTeacherRichJson(html: string): TeacherRichDocumentHtmlV1 {
  return { format: TEACHER_RICH_FORMAT_HTML_V1, html: sanitizeTeacherCorrectionHtml(html) };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Initial HTML for the editor: saved rich > legacy plain polished > student body. */
export function buildInitialEditorHtml(
  bodyText: string,
  richJson: unknown,
  polishedSentence: string | null | undefined
): string {
  const fromRich = parseTeacherHtmlV1(richJson);
  if (fromRich != null && fromRich.replace(/<[^>]*>/g, "").trim() !== "") {
    return sanitizeTeacherCorrectionHtml(fromRich);
  }
  const plain = (polishedSentence != null && polishedSentence !== ""
    ? polishedSentence
    : bodyText) ?? "";
  if (plain === "") {
    return sanitizeTeacherCorrectionHtml("<p><br></p>");
  }
  return sanitizeTeacherCorrectionHtml(`<p>${escapeHtml(plain).replace(/\n/g, "<br>")}</p>`);
}

/** True if the HTML has visible text (ignores tags). */
export function isHtmlVisiblyNonEmpty(html: string): boolean {
  if (typeof html !== "string") return false;
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 0;
}

function normalizePlainFromDomFragment(el: HTMLElement): string {
  const t = el.innerText ?? el.textContent ?? "";
  return t.replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

type ComparisonSeg = { kind: "plain" | "red"; text: string };

function colorLooksRedish(cssColor: string): boolean {
  const v = cssColor.trim().toLowerCase();
  if (!v || v.length > 120) return false;
  if (/(url|expression|behavior|javascript|@import)/i.test(v)) return false;
  if (v === "red" || v === "crimson" || v === "darkred" || v === "firebrick" || v === "tomato") return true;
  if (v === "orange" || v === "gold" || v === "amber") return false;

  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && r > 130 && r > g + 85 && r > b + 35;
  }

  const rgb = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    return (
      Number.isFinite(r) &&
      Number.isFinite(g) &&
      Number.isFinite(b) &&
      r > 130 &&
      r > g + 85 &&
      r > b + 35
    );
  }

  return false;
}

/** Yellow / highlighter backgrounds — original/problem text dropped from comparison plain. */
function styleIsYellowHighlight(style: string | null): boolean {
  if (style == null || style === "") return false;
  const s = style.toLowerCase();
  if (!s.includes("background") && !s.includes("highlight")) return false;
  if (/#fff59d|#ffff00|#ffeb3b|#ff0\b|#feff|yellow|lemonchiffon|lightyellow|lightgoldenrodyellow|khaki/i.test(s)) {
    return true;
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
      if (r > 235 && g > 215 && b < 130 && r + g > b + 200) return true;
      if (r > 250 && g > 240 && b < 120) return true;
    }
  }
  return false;
}

function styleIsRedForeground(style: string | null): boolean {
  if (style == null || style === "") return false;
  const fill = style.match(/(?:^|;)\s*-webkit-text-fill-color\s*:\s*([^;]+)/i);
  if (fill && colorLooksRedish(fill[1])) return true;
  const col = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  return Boolean(col && colorLooksRedish(col[1]));
}

function elementIsRedCorrection(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "font") {
    const c = el.getAttribute("color");
    return Boolean(c && colorLooksRedish(c));
  }
  return styleIsRedForeground(el.getAttribute("style"));
}

function mergeAdjacentComparisonSegs(segs: ComparisonSeg[]): ComparisonSeg[] {
  const out: ComparisonSeg[] = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === s.kind) {
      prev.text += s.text;
    } else {
      out.push({ kind: s.kind, text: s.text });
    }
  }
  return out;
}

/**
 * Remove glued wrong-original suffix before a red correction segment (plain + red without whitespace gap).
 * Peels trailing `\\S+` tokens (trimming spaces between peels) with bounded cost.
 */
export function stripAdjacentWrongSuffixForRichCorrection(buffer: string): string {
  const MAX_PEELS = 24;
  const MAX_CHARS = 200;
  let out = buffer;
  let removedSum = 0;
  let peels = 0;
  while (peels < MAX_PEELS && removedSum < MAX_CHARS) {
    const trimmed = out.replace(/\s+$/, "");
    if (!/\S/.test(trimmed)) break;
    const m = trimmed.match(/\S+$/);
    if (!m || !m[0].length) break;
    const word = m[0];
    if (removedSum + word.length > MAX_CHARS) break;
    out = trimmed.slice(0, trimmed.length - word.length).replace(/\s+$/, "");
    removedSum += word.length;
    peels++;
  }
  return out;
}

function normalizeComparisonPlainOutput(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectComparisonSegments(root: HTMLElement): ComparisonSeg[] {
  const out: ComparisonSeg[] = [];

  function emitRedSubtree(el: Element): void {
    for (const c of el.childNodes) {
      if (c.nodeType === Node.TEXT_NODE) {
        const t = c.textContent ?? "";
        if (t) out.push({ kind: "red", text: t });
        continue;
      }
      if (c.nodeType !== Node.ELEMENT_NODE) continue;
      const child = c as Element;
      const ct = child.tagName.toLowerCase();
      if (ct === "br") {
        out.push({ kind: "red", text: "\n" });
        continue;
      }
      if (ct === "script" || ct === "style") continue;
      if (ct === "mark") continue;
      if (ct === "s" || ct === "del" || ct === "strike") continue;
      if (styleIsYellowHighlight(child.getAttribute("style"))) continue;
      emitRedSubtree(child);
    }
  }

  function walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? "";
      if (t) out.push({ kind: "plain", text: t });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style") return;
    if (tag === "s" || tag === "del" || tag === "strike") return;
    if (tag === "mark") return;
    const st = el.getAttribute("style");
    if (styleIsYellowHighlight(st)) return;

    if (elementIsRedCorrection(el)) {
      emitRedSubtree(el);
      return;
    }

    if (tag === "br") {
      out.push({ kind: "plain", text: "\n" });
      return;
    }

    for (const c of el.childNodes) walk(c);
  }

  for (const c of root.childNodes) walk(c);
  return mergeAdjacentComparisonSegs(out);
}

function segmentsToComparisonPlain(segments: ComparisonSeg[]): string {
  let acc = "";
  for (const seg of segments) {
    const text = seg.text.replace(/\u00a0/g, " ");
    if (seg.kind === "red") {
      const glued =
        acc.length > 0 &&
        /\S$/.test(acc) &&
        text.length > 0 &&
        /^\S/.test(text);
      if (glued) {
        acc = stripAdjacentWrongSuffixForRichCorrection(acc);
      }
      acc += text;
    } else {
      acc += text;
    }
  }
  return normalizeComparisonPlainOutput(acc);
}

/**
 * Converts teacher rich-correction HTML into plain 「整理した比較文」:
 * drops yellow highlights / strike / mark, keeps red correction text, peels glued wrong originals before red.
 */
export function richCorrectionHtmlToComparisonPlainText(html: string): string {
  if (typeof html !== "string" || html.trim() === "") return "";
  if (typeof document === "undefined") {
    return htmlToPlainText(html);
  }
  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    const segments = collectComparisonSegments(div);
    return segmentsToComparisonPlain(segments);
  } catch {
    return htmlToPlainText(html);
  }
}

/** Plain text for 「整理した比較文」(정서문) — thin alias for {@link richCorrectionHtmlToComparisonPlainText}. */
export function extractComparisonPlainText(html: string): string {
  return richCorrectionHtmlToComparisonPlainText(html);
}

/** Strip tags for clipboard; prefer DOM innerText in the browser. */
export function htmlToPlainText(html: string): string {
  if (typeof html !== "string" || html === "") return "";
  if (typeof document !== "undefined") {
    const d = document.createElement("div");
    d.innerHTML = html;
    return normalizePlainFromDomFragment(d);
  }
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
