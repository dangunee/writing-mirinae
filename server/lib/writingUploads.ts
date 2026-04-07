import { randomBytes } from "node:crypto";

/** Allowlisted MIME types for writing submission images (server-enforced). */
export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const ALLOWED_PDF_MIME = new Set(["application/pdf"]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export function normalizeMime(mime: string): string {
  return mime.toLowerCase().split(";")[0]?.trim() ?? "";
}

export function isImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIME.has(normalizeMime(mime));
}

export function isPdfMime(mime: string): boolean {
  return ALLOWED_PDF_MIME.has(normalizeMime(mime));
}

/**
 * Reject unknown MIME; storage key extension is derived from MIME only (never from filename).
 */
export function validateSubmissionFileUpload(params: {
  mimeType: string;
  byteLength: number;
}): { ok: true; kind: "image" | "pdf" } | { ok: false; reason: string } {
  const n = normalizeMime(params.mimeType);
  if (ALLOWED_IMAGE_MIME.has(n)) {
    const img = validateImageUpload({ mimeType: params.mimeType, byteLength: params.byteLength });
    if (!img.ok) {
      return img;
    }
    return { ok: true, kind: "image" };
  }
  if (ALLOWED_PDF_MIME.has(n)) {
    return validatePdfUpload(params);
  }
  return { ok: false, reason: "invalid_file_mime" };
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MiB

export function getMaxUploadBytes(): number {
  const raw = process.env.WRITING_UPLOAD_MAX_BYTES;
  if (!raw) return DEFAULT_MAX_BYTES;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_BYTES;
}

/**
 * Security: reject unknown MIME, oversize files, and path-like filenames (storage key is server-generated).
 */
export function validateImageUpload(params: {
  mimeType: string;
  byteLength: number;
}): { ok: true } | { ok: false; reason: string } {
  const normalized = params.mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!ALLOWED_IMAGE_MIME.has(normalized)) {
    return { ok: false, reason: "invalid_image_mime" };
  }
  if (params.byteLength <= 0) {
    return { ok: false, reason: "empty_file" };
  }
  if (params.byteLength > getMaxUploadBytes()) {
    return { ok: false, reason: "file_too_large" };
  }
  return { ok: true };
}

export function validatePdfUpload(params: {
  mimeType: string;
  byteLength: number;
}): { ok: true; kind: "pdf" } | { ok: false; reason: string } {
  const normalized = normalizeMime(params.mimeType);
  if (!ALLOWED_PDF_MIME.has(normalized)) {
    return { ok: false, reason: "invalid_pdf_mime" };
  }
  if (params.byteLength <= 0) {
    return { ok: false, reason: "empty_file" };
  }
  if (params.byteLength > getMaxUploadBytes()) {
    return { ok: false, reason: "file_too_large" };
  }
  return { ok: true, kind: "pdf" };
}

/** Safe object path under bucket; no user-controlled path segments except opaque ids. */
export function buildStorageObjectKey(params: {
  userId?: string;
  regularAccessGrantId?: string;
  trialApplicationId?: string;
  submissionId: string;
  mimeType: string;
}): { storageKey: string; extension: string } {
  const normalized = normalizeMime(params.mimeType);
  const ext = EXT_BY_MIME[normalized];
  if (!ext) {
    throw new Error("invalid mime for storage key");
  }
  const rand = randomBytes(8).toString("hex");
  const prefix =
    params.userId != null
      ? params.userId
      : params.regularAccessGrantId != null
        ? `regular-grants/${params.regularAccessGrantId}`
        : params.trialApplicationId != null
          ? `trial-apps/${params.trialApplicationId}`
          : null;
  if (!prefix) {
    throw new Error("storage owner required");
  }
  const storageKey = `${prefix}/${params.submissionId}/${rand}.${ext}`;
  return { storageKey, extension: ext };
}
