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

/**
 * Only «canonical» yellow used for strippable highlights (problem/old text).
 * Does not treat pastel/toolbar creams as yellow — avoids wiping most of the document.
 */
function cssBackgroundValueIsStripYellow(valRaw: string): boolean {
  const v = valRaw.trim().toLowerCase();
  if (!v || /linear-gradient|radial-gradient|repeating-linear-gradient|url\s*\(/i.test(v)) return false;
  if (v === "yellow") return true;
  if (v === "#ffff00" || v === "#ff0") return true;
  const m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) {
    const r = Math.round(Number(m[1]));
    const g = Math.round(Number(m[2]));
    const b = Math.round(Number(m[3]));
    return r === 255 && g === 255 && b === 0;
  }
  return false;
}

function elementDeclaresStripYellowBackground(el: Element): boolean {
  const bgAttr = el.getAttribute("bgcolor");
  if (bgAttr != null && bgAttr !== "" && cssBackgroundValueIsStripYellow(bgAttr)) return true;

  const style = el.getAttribute("style");
  if (style == null || style === "") return false;
  for (const part of style.split(";")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const prop = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (prop !== "background-color" && prop !== "background") continue;
    if (cssBackgroundValueIsStripYellow(val)) return true;
  }
  return false;
}

/** Skip text under any ancestor that declares strip-yellow background. */
function comparisonTextNodeUnderStripYellow(textNode: Text): boolean {
  let cur: Node | null = textNode.parentNode;
  while (cur != null) {
    if (cur.nodeType === Node.ELEMENT_NODE && elementDeclaresStripYellowBackground(cur as Element)) {
      return true;
    }
    cur = cur.parentNode;
  }
  return false;
}

function emitComparisonTextNode(textNode: Text, parts: string[]): void {
  if (comparisonTextNodeUnderStripYellow(textNode)) return;
  let t = textNode.textContent ?? "";
  if (t === "") return;
  t = t.replace(/\u00a0/g, " ").replace(/[ \t\f\v]+/g, " ");
  parts.push(t);
}

function walkComparisonDom(parent: Node, parts: string[]): void {
  const children = parent.childNodes;
  let prevSiblingWasBlock = false;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (child.nodeType === Node.TEXT_NODE) {
      emitComparisonTextNode(child as Text, parts);
      prevSiblingWasBlock = false;
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (tag === "script" || tag === "style") continue;

    if (tag === "br") {
      parts.push("\n");
      prevSiblingWasBlock = false;
      continue;
    }

    const blockHere = isComparisonBlockTag(tag);
    if (blockHere && prevSiblingWasBlock) parts.push("\n\n");

    walkComparisonDom(el, parts);

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
 * 「整理した比較文」 plain text: depth-first text nodes; omit only canonical yellow backgrounds
 * (#ffff00 / rgb(255,255,0) / yellow); keep normal / red / blue text and line breaks.
 */
export function richCorrectionHtmlToComparisonPlainText(html: string): string {
  if (typeof html !== "string" || html.trim() === "") return "";
  if (typeof document === "undefined") {
    return htmlToPlainText(html);
  }
  try {
    const div = document.createElement("div");
    div.innerHTML = html;
    const parts: string[] = [];
    walkComparisonDom(div, parts);
    return normalizeComparisonPlainOutput(parts.join(""));
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
