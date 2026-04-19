import { parseSubmissionMode } from "./writingSubmissionMode";
import type { PreparedAttachment } from "../services/writingSubmissionInternal";

export type ParsedWritingSubmissionPost = {
  ok: true;
  action: "save" | "submit";
  bodyText: string | null;
  attachments: PreparedAttachment[];
  submissionMode: ReturnType<typeof parseSubmissionMode> | null;
};

export type ParsedWritingSubmissionPostErr = { ok: false; status: number; error: string };

/**
 * Shared POST body parser for /api/writing/sessions/:id/submission (read-once).
 */
export async function parseWritingSubmissionPost(
  req: Request
): Promise<ParsedWritingSubmissionPost | ParsedWritingSubmissionPostErr> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const forbiddenFormKeys = [
      "userId",
      "user_id",
      "status",
      "courseId",
      "course_id",
      "sessionId",
      "session_id",
      "grantId",
      "grant_id",
      "trialApplicationId",
      "trial_application_id",
    ];
    for (const k of forbiddenFormKeys) {
      if (form.has(k)) {
        return { ok: false, status: 400, error: "forbidden_fields" };
      }
    }
    const act = form.get("action");
    const action = act === "submit" ? "submit" : "save";
    const bt = form.get("bodyText");
    const bodyText = typeof bt === "string" ? bt : null;
    const sm = form.get("submissionMode");
    const submissionMode = typeof sm === "string" ? parseSubmissionMode(sm) : null;
    const attachments: PreparedAttachment[] = [];
    const legacyImage = form.get("image");
    if (legacyImage instanceof File && legacyImage.size > 0) {
      attachments.push({
        buffer: Buffer.from(await legacyImage.arrayBuffer()),
        mimeType: legacyImage.type || "application/octet-stream",
        originalFilename: legacyImage.name || "image",
      });
    }
    for (const entry of form.getAll("files")) {
      if (entry instanceof File && entry.size > 0) {
        attachments.push({
          buffer: Buffer.from(await entry.arrayBuffer()),
          mimeType: entry.type || "application/octet-stream",
          originalFilename: entry.name || "file",
        });
      }
    }
    return { ok: true, action, bodyText, attachments, submissionMode };
  }

  if (contentType.includes("application/json")) {
    let json: Record<string, unknown>;
    try {
      json = (await req.json()) as Record<string, unknown>;
    } catch {
      return { ok: false, status: 400, error: "invalid_json" };
    }
    const forbiddenJsonKeys = [
      "userId",
      "user_id",
      "status",
      "courseId",
      "course_id",
      "sessionId",
      "session_id",
      "grantId",
      "grant_id",
      "trialApplicationId",
      "trial_application_id",
    ];
    for (const k of forbiddenJsonKeys) {
      if (k in json) {
        return { ok: false, status: 400, error: "forbidden_fields" };
      }
    }
    const action = json.action === "submit" ? "submit" : "save";
    const bodyText = typeof json.bodyText === "string" ? json.bodyText : null;
    const submissionMode =
      typeof json.submissionMode === "string" ? parseSubmissionMode(json.submissionMode) : null;
    return { ok: true, action, bodyText, attachments: [], submissionMode };
  }

  return { ok: false, status: 415, error: "unsupported_content_type" };
}
