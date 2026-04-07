import { isImageMime, isPdfMime } from "./writingUploads";

export type SubmissionMode = "text" | "image" | "pdf" | "mixed";

export function parseSubmissionMode(raw: unknown): SubmissionMode | null {
  if (typeof raw !== "string") {
    return null;
  }
  const s = raw.trim().toLowerCase();
  if (s === "text" || s === "image" || s === "pdf" || s === "mixed") {
    return s;
  }
  return null;
}

export function inferSubmissionMode(
  bodyText: string | null,
  files: { mimeType: string }[]
): SubmissionMode | null {
  const hasText = (bodyText?.trim() ?? "").length > 0;
  const hasFiles = files.length > 0;
  if (!hasFiles && hasText) {
    return "text";
  }
  if (!hasFiles && !hasText) {
    return null;
  }
  if (hasFiles && !hasText) {
    const allImg = files.every((f) => isImageMime(f.mimeType));
    const allPdf = files.every((f) => isPdfMime(f.mimeType));
    if (allImg) {
      return "image";
    }
    if (allPdf) {
      return "pdf";
    }
    return null;
  }
  return "mixed";
}

export function validateSubmissionModeForSubmit(
  mode: SubmissionMode,
  bodyText: string | null,
  files: { mimeType: string }[]
): { ok: true } | { ok: false; code: string } {
  const hasText = (bodyText?.trim() ?? "").length > 0;
  const hasFiles = files.length > 0;
  const allPdf = hasFiles && files.every((f) => isPdfMime(f.mimeType));
  const allImg = hasFiles && files.every((f) => isImageMime(f.mimeType));
  const hasPdf = files.some((f) => isPdfMime(f.mimeType));
  const hasImg = files.some((f) => isImageMime(f.mimeType));

  switch (mode) {
    case "text":
      if (!hasText) {
        return { ok: false, code: "text_required" };
      }
      if (hasFiles) {
        return { ok: false, code: "text_mode_no_attachments" };
      }
      return { ok: true };
    case "image":
      if (!hasFiles || !allImg) {
        return { ok: false, code: "image_attachment_required" };
      }
      if (hasPdf) {
        return { ok: false, code: "invalid_attachment_type" };
      }
      return { ok: true };
    case "pdf":
      if (!hasFiles || !allPdf) {
        return { ok: false, code: "pdf_attachment_required" };
      }
      if (hasImg) {
        return { ok: false, code: "invalid_attachment_type" };
      }
      return { ok: true };
    case "mixed":
      if (!hasText) {
        return { ok: false, code: "mixed_text_required" };
      }
      if (!hasFiles) {
        return { ok: false, code: "mixed_attachment_required" };
      }
      return { ok: true };
    default:
      return { ok: false, code: "invalid_submission_mode" };
  }
}
