import DOMPurify from "dompurify";

import { teacherCorrectionPurifyOptions } from "./teacherCorrectionPurifyOptions";
import { isSafeColorAttrValue, sanitizeInlineStyleAllowlist } from "./teacherInlineStyleSanitize";

/**
 * After DOMPurify: normalize inline styles (allowlist) and Gmail `<font color>` → `<span style="color:…">`.
 * Runs only in the browser (same surfaces as DOMPurify).
 */
function rewriteStylesAndFontsInSanitizedHtml(html: string): string {
  if (typeof document === "undefined") return html;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;

  tpl.content.querySelectorAll("[style]").forEach((el) => {
    const s = el.getAttribute("style");
    if (s == null || !s.trim()) return;
    const cleaned = sanitizeInlineStyleAllowlist(s);
    if (cleaned) el.setAttribute("style", cleaned);
    else el.removeAttribute("style");
  });

  tpl.content.querySelectorAll("font").forEach((el) => {
    const span = document.createElement("span");
    const colorAttr = el.getAttribute("color");
    const existingStyle = el.getAttribute("style");
    const chunks: string[] = [];
    if (colorAttr != null && colorAttr.trim() && isSafeColorAttrValue(colorAttr)) {
      chunks.push(`color:${colorAttr.trim()}`);
    }
    if (existingStyle != null && existingStyle.trim()) {
      chunks.push(existingStyle);
    }
    const merged = chunks.join(";");
    const sty = sanitizeInlineStyleAllowlist(merged);
    if (sty) span.setAttribute("style", sty);
    while (el.firstChild) span.appendChild(el.firstChild);
    el.parentNode?.replaceChild(span, el);
  });

  return tpl.innerHTML;
}

/** Browser-only sanitizer for teacher correction HTML (editor paste + client-side persist helpers). */
export function sanitizeTeacherCorrectionHtml(html: string): string {
  if (typeof html !== "string" || html.trim() === "") return "";
  const phase1 = DOMPurify.sanitize(html, teacherCorrectionPurifyOptions);
  return rewriteStylesAndFontsInSanitizedHtml(phase1);
}
