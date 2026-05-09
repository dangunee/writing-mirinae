import DOMPurify from "dompurify";

import { teacherCorrectionPurifyOptions } from "./teacherCorrectionPurifyOptions";

/** Browser-only sanitizer for teacher correction HTML (editor paste + client-side persist helpers). */
export function sanitizeTeacherCorrectionHtml(html: string): string {
  if (typeof html !== "string" || html.trim() === "") return "";
  return DOMPurify.sanitize(html, teacherCorrectionPurifyOptions);
}
