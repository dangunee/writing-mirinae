import type { Config } from "dompurify";

/**
 * Shared DOMPurify policy for teacher corrections (paste, save, student render).
 * Whitelist inline formatting only — no scripts, handlers, iframes, or arbitrary URLs.
 */
export const teacherCorrectionPurifyOptions: Config = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "div",
    "span",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "s",
    "strike",
    "del",
    "mark",
    "ul",
    "ol",
    "li",
    "blockquote",
  ],
  ALLOWED_ATTR: ["style"],
  ALLOW_DATA_ATTR: false,
  KEEP_CONTENT: true,
};
