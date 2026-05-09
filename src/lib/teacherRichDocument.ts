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

/** Block-level siblings get `\n\n` between them (paragraph breaks). */
const COMPARISON_BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "ul",
]);

function isComparisonBlockTag(tagName: string): boolean {
  return COMPARISON_BLOCK_TAGS.has(tagName.toLowerCase());
}

/** Peels glued wrong-original suffix before a red correction segment (bounded cost). */
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

function styleHasLineThrough(style: string | null): boolean {
  if (style == null || style === "") return false;
  const s = style.toLowerCase();
  if (!s.includes("line-through")) return false;
  if (/text-decoration-line\s*:\s*[^;]*line-through/.test(s)) return true;
  if (/text-decoration\s*:\s*[^;]*line-through/.test(s)) return true;
  return false;
}

function textNodeUnderStrike(textNode: Text): boolean {
  let cur: Node | null = textNode.parentNode;
  while (cur != null) {
    if (cur.nodeType === Node.ELEMENT_NODE) {
      const el = cur as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "s" || tag === "strike" || tag === "del") return true;
      if (styleHasLineThrough(el.getAttribute("style"))) return true;
    }
    cur = cur.parentNode;
  }
  return false;
}

/** Highlighter yellows — only real background declarations (no gradients / tap-highlight noise). */
function backgroundValueLooksYellowHighlight(valRaw: string): boolean {
  const v = valRaw.trim().toLowerCase();
  if (!v || /linear-gradient|radial-gradient|repeating-linear-gradient|url\s*\(/i.test(v)) return false;
  if (/#fff59d|#ffff00|#ffeb3b|#ff0\b|#fef9c3|#fff9c4|#fef08a/i.test(v)) return true;
  if (/\byellow\b|\blemonchiffon\b|\blightyellow\b|\blightgoldenrodyellow\b|\bkhaki\b/i.test(v)) return true;
  const m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
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

function elementHasYellowHighlightBackground(el: Element): boolean {
  const bgAttr = el.getAttribute("bgcolor");
  if (bgAttr != null && bgAttr !== "" && backgroundValueLooksYellowHighlight(bgAttr)) return true;

  const style = el.getAttribute("style");
  if (style == null || style === "") return false;
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (prop !== "background-color" && prop !== "background") continue;
    if (backgroundValueLooksYellowHighlight(val)) return true;
  }
  return false;
}

function textNodeUnderYellowHighlight(textNode: Text): boolean {
  let cur: Node | null = textNode.parentNode;
  while (cur != null) {
    if (cur.nodeType === Node.ELEMENT_NODE) {
      const el = cur as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "mark") return true;
      if (elementHasYellowHighlightBackground(el)) return true;
    }
    cur = cur.parentNode;
  }
  return false;
}

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

function colorLooksBlueish(cssColor: string): boolean {
  const v = cssColor.trim().toLowerCase();
  if (!v || v.length > 120) return false;
  if (/(url|expression|behavior|javascript|@import)/i.test(v)) return false;
  if (v === "blue" || v === "navy" || v === "dodgerblue" || v === "royalblue" || v === "steelblue") return true;

  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && b > r + 35 && b > g + 15 && b > 90;
  }

  const rgb = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) {
    const r = Number(rgb[1]);
    const g = Number(rgb[2]);
    const b = Number(rgb[3]);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && b > r + 35 && b > g + 15 && b > 90;
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

function styleIsBlueForeground(style: string | null): boolean {
  if (style == null || style === "") return false;
  if (styleIsRedForeground(style)) return false;
  const col = style.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
  return Boolean(col && colorLooksBlueish(col[1]));
}

/** Innermost ancestor wins — closest element with explicit red / blue / plain default. */
function classifyComparisonColorKind(textNode: Text): "plain" | "red" | "blue" {
  let el: Element | null = textNode.parentElement;
  while (el != null) {
    const tag = el.tagName.toLowerCase();
    if (tag === "font") {
      const c = el.getAttribute("color");
      if (c && colorLooksRedish(c)) return "red";
      if (c && colorLooksBlueish(c)) return "blue";
    }
    const st = el.getAttribute("style");
    if (styleIsRedForeground(st)) return "red";
    if (styleIsBlueForeground(st)) return "blue";
    el = el.parentElement;
  }
  return "plain";
}

type ComparisonSegKind = "plain" | "red" | "blue";

type ComparisonSeg = { kind: ComparisonSegKind; text: string };

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

function segmentsToComparisonPlain(segments: ComparisonSeg[]): string {
  let acc = "";
  let lastKind: ComparisonSegKind | null = null;
  for (const seg of segments) {
    const text = seg.text.replace(/\u00a0/g, " ");
    if (seg.kind === "red") {
      const glued =
        lastKind === "plain" &&
        acc.length > 0 &&
        /\S$/.test(acc) &&
        text.length > 0 &&
        /^\S/.test(text);
      if (glued) {
        acc = stripAdjacentWrongSuffixForRichCorrection(acc);
      }
      acc += text;
      lastKind = "red";
    } else {
      acc += text;
      lastKind = seg.kind;
    }
  }
  return normalizeComparisonPlainOutput(acc);
}

function normalizeEmitText(raw: string): string {
  if (raw === "") return "";
  return raw.replace(/\u00a0/g, " ").replace(/[ \t\f\v]+/g, " ");
}

function pushComparisonSegment(segments: ComparisonSeg[], kind: ComparisonSegKind, text: string): void {
  const t = normalizeEmitText(text);
  if (t === "") return;
  segments.push({ kind, text: t });
}

function emitComparisonTextNode(textNode: Text, segments: ComparisonSeg[]): void {
  if (textNodeUnderStrike(textNode)) return;
  if (textNodeUnderYellowHighlight(textNode)) return;
  const kind = classifyComparisonColorKind(textNode);
  const raw = textNode.textContent ?? "";
  if (raw === "") return;
  pushComparisonSegment(segments, kind, raw);
}

function walkComparisonSegments(parent: Node, segments: ComparisonSeg[]): void {
  const children = parent.childNodes;
  let prevSiblingWasBlock = false;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType === Node.TEXT_NODE) {
      emitComparisonTextNode(child as Text, segments);
      prevSiblingWasBlock = false;
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style") continue;

    if (tag === "br") {
      pushComparisonSegment(segments, "plain", "\n");
      prevSiblingWasBlock = false;
      continue;
    }

    const blockHere = isComparisonBlockTag(tag);
    if (blockHere && prevSiblingWasBlock) {
      pushComparisonSegment(segments, "plain", "\n\n");
    }

    walkComparisonSegments(el, segments);

    prevSiblingWasBlock = blockHere;
  }
}

function normalizeComparisonPlainOutput(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * 「整理した比較文」: discard strike + yellow highlights; keep plain / red / blue;
 * peel glued plain suffix before red; preserve paragraph breaks (`\\n\\n` between blocks).
 */
export function richCorrectionHtmlToComparisonPlainText(html: string): string {
  if (typeof html !== "string" || html.trim() === "") return "";
  if (typeof document === "undefined") {
    return htmlToPlainText(html);
  }
  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    const segments: ComparisonSeg[] = [];
    walkComparisonSegments(div, segments);
    return segmentsToComparisonPlain(mergeAdjacentComparisonSegs(segments));
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
