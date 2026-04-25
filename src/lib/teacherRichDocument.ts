/**
 * Rich correction payload for writing.corrections.rich_document_json (jsonb).
 * No DB schema change: stored as a small JSON object.
 */
export const TEACHER_RICH_FORMAT_HTML_V1 = "html-v1" as const;

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
  return { format: TEACHER_RICH_FORMAT_HTML_V1, html };
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
    return fromRich;
  }
  const plain = (polishedSentence != null && polishedSentence !== ""
    ? polishedSentence
    : bodyText) ?? "";
  if (plain === "") {
    return "<p><br></p>";
  }
  return `<p>${escapeHtml(plain).replace(/\n/g, "<br>")}</p>`;
}

/** True if the HTML has visible text (ignores tags). */
export function isHtmlVisiblyNonEmpty(html: string): boolean {
  if (typeof html !== "string") return false;
  const t = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > 0;
}
