import DOMPurify from "isomorphic-dompurify";

import { teacherCorrectionPurifyOptions } from "../../src/lib/teacherCorrectionPurifyOptions";
import { TEACHER_RICH_FORMAT_HTML_V1 } from "../../src/lib/teacherRichDocumentFormat";

/** Node/API-route sanitizer — mirrors browser policy for defense in depth on save. */
export function sanitizeTeacherCorrectionHtml(html: string): string {
  if (typeof html !== "string" || html.trim() === "") return "";
  return DOMPurify.sanitize(html, teacherCorrectionPurifyOptions);
}

/** Normalize html-v1 rich_document_json before persisting; pass-through other shapes. */
export function sanitizePersistedRichDocumentJson(json: unknown): unknown {
  if (json == null || typeof json !== "object") return json;
  const o = json as Record<string, unknown>;
  if (o.format === TEACHER_RICH_FORMAT_HTML_V1 && typeof o.html === "string") {
    return { ...o, html: sanitizeTeacherCorrectionHtml(o.html) };
  }
  return json;
}
