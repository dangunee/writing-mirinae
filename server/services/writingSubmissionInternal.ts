import type { writingSubmissions } from "../../db/schema";
import type { Db } from "../db/client";
import { isPostgresUniqueViolation } from "../lib/postgresErrorGuards";
import { getServiceRoleClient } from "../lib/supabaseServiceRole";
import {
  buildStorageObjectKey,
  isImageMime,
  normalizeMime,
  validateSubmissionFileUpload,
} from "../lib/writingUploads";
import {
  inferSubmissionMode,
  validateSubmissionModeForSubmit,
  type SubmissionMode,
} from "../lib/writingSubmissionMode";
import { grammarCheckFromSessionSnapshot } from "../lib/writingAssignmentSnapshot";
import * as repo from "../repositories/writingStudentRepository";

const BUCKET = process.env.WRITING_UPLOADS_BUCKET ?? "writing-submissions";

export type PreparedAttachment = { buffer: Buffer; mimeType: string; originalFilename: string };

export type SubmissionWriteIdentity =
  | { type: "user"; userId: string }
  | { type: "grant"; grantId: string }
  | { type: "trial"; trialApplicationId: string };

export type SubmissionWriteResult =
  | { ok: true; submissionId: string; status: string }
  | { ok: false; status: number; code: string };

function safeOriginalFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "").slice(0, 255);
  return base || "file";
}

function insertDraft(
  tx: Db,
  identity: SubmissionWriteIdentity,
  sessionId: string,
  courseId: string,
  bodyText: string | null,
  submissionMode: string | null
) {
  const common = {
    sessionId,
    courseId,
    status: "draft" as const,
    bodyText,
    imageStorageKey: null as string | null,
    imageMimeType: null as string | null,
    submissionMode,
    submittedAt: null as Date | null,
  };
  switch (identity.type) {
    case "user":
      return repo.insertSubmission(tx, {
        ...common,
        userId: identity.userId,
        regularAccessGrantId: null,
        trialApplicationId: null,
      });
    case "grant":
      return repo.insertSubmission(tx, {
        ...common,
        userId: null,
        regularAccessGrantId: identity.grantId,
        trialApplicationId: null,
      });
    case "trial":
      return repo.insertSubmission(tx, {
        ...common,
        userId: null,
        regularAccessGrantId: null,
        trialApplicationId: identity.trialApplicationId,
      });
  }
}

async function updateDraftUnified(
  tx: Db,
  identity: SubmissionWriteIdentity,
  submissionId: string,
  patch: {
    bodyText: string | null;
    imageStorageKey: string | null;
    imageMimeType: string | null;
    submissionMode?: string | null;
  }
) {
  switch (identity.type) {
    case "user":
      return repo.updateSubmissionDraft(tx, submissionId, patch);
    case "grant":
      return repo.updateSubmissionDraftForGrant(tx, submissionId, identity.grantId, patch);
    case "trial":
      return repo.updateSubmissionDraftForTrial(tx, submissionId, identity.trialApplicationId, patch);
  }
}

async function submitFinalUnified(tx: Db, identity: SubmissionWriteIdentity, submissionId: string) {
  switch (identity.type) {
    case "user":
      return repo.submitSubmissionFinal(tx, submissionId, identity.userId);
    case "grant":
      return repo.submitSubmissionFinalForGrant(tx, submissionId, identity.grantId);
    case "trial":
      return repo.submitSubmissionFinalForTrial(tx, submissionId, identity.trialApplicationId);
  }
}

async function getSubmissionUnified(tx: Db, identity: SubmissionWriteIdentity, submissionId: string) {
  switch (identity.type) {
    case "user":
      return repo.getSubmissionByIdForUser(tx, submissionId, identity.userId);
    case "grant":
      return repo.getSubmissionByIdForGrant(tx, submissionId, identity.grantId);
    case "trial":
      return repo.getSubmissionByIdForTrial(tx, submissionId, identity.trialApplicationId);
  }
}

function buildKeyParams(identity: SubmissionWriteIdentity, submissionId: string, mimeType: string) {
  switch (identity.type) {
    case "user":
      return { userId: identity.userId, submissionId, mimeType };
    case "grant":
      return { regularAccessGrantId: identity.grantId, submissionId, mimeType };
    case "trial":
      return { trialApplicationId: identity.trialApplicationId, submissionId, mimeType };
  }
}

export async function executeSubmissionWrite(
  db: Db,
  input: {
    courseId: string;
    sessionId: string;
    action: "save" | "submit";
    submissionMode: SubmissionMode | null;
    bodyText: string | null;
    attachments: PreparedAttachment[];
    replaceAttachmentFiles: boolean;
    existing: typeof writingSubmissions.$inferSelect | null;
    identity: SubmissionWriteIdentity;
  }
): Promise<SubmissionWriteResult> {
  const {
    courseId,
    sessionId,
    action,
    submissionMode: modeInput,
    bodyText,
    attachments,
    replaceAttachmentFiles,
    existing,
    identity,
  } = input;

  try {
    return await db.transaction(async (tx) => {
      let submissionId = existing?.id ?? null;

      if (!submissionId) {
        try {
          const ins = await insertDraft(tx, identity, sessionId, courseId, bodyText, modeInput);
          submissionId = ins.id;
        } catch (e) {
          if (isPostgresUniqueViolation(e)) {
            return { ok: false, status: 409, code: "active_submission_conflict" };
          }
          throw e;
        }
      }

      if (replaceAttachmentFiles && submissionId) {
        await repo.deleteSubmissionAttachmentsBySubmissionId(tx, submissionId);
      }

      let legacyImageKey: string | null = null;
      let legacyImageMime: string | null = null;

      if (replaceAttachmentFiles) {
        const supabase = getServiceRoleClient();
        for (let i = 0; i < attachments.length; i++) {
          const a = attachments[i];
          const v = validateSubmissionFileUpload({ mimeType: a.mimeType, byteLength: a.buffer.length });
          if (!v.ok) {
            return { ok: false, status: 400, code: v.reason };
          }
          const { storageKey } = buildStorageObjectKey(buildKeyParams(identity, submissionId!, a.mimeType));
          const up = await supabase.storage.from(BUCKET).upload(storageKey, a.buffer, {
            contentType: normalizeMime(a.mimeType),
            upsert: false,
          });
          if (up.error) {
            console.error("storage_upload_failed", up.error.message);
            return { ok: false, status: 500, code: "storage_upload_failed" };
          }
          await repo.insertSubmissionAttachmentRow(tx, {
            submissionId: submissionId!,
            storageBucket: BUCKET,
            storageKey,
            mimeType: normalizeMime(a.mimeType),
            byteSize: a.buffer.length,
            originalFilename: safeOriginalFilename(a.originalFilename),
            pageCount: null,
            sortOrder: i,
          });
          if (!legacyImageKey && isImageMime(a.mimeType)) {
            legacyImageKey = storageKey;
            legacyImageMime = normalizeMime(a.mimeType);
          }
        }
      } else {
        legacyImageKey = existing?.imageStorageKey ?? null;
        legacyImageMime = existing?.imageMimeType ?? null;
      }

      let submissionModeForRow: string | null = modeInput;

      if (action === "submit") {
        const rows = await repo.listSubmissionAttachmentsBySubmissionId(tx, submissionId!);
        const metas = rows.map((r) => ({ mimeType: r.mimeType }));
        const resolvedMode = modeInput ?? inferSubmissionMode(bodyText, metas);
        if (!resolvedMode) {
          return { ok: false, status: 422, code: "submission_mode_required" };
        }
        const mv = validateSubmissionModeForSubmit(resolvedMode, bodyText, metas);
        if (!mv.ok) {
          return { ok: false, status: 422, code: mv.code };
        }
        submissionModeForRow = resolvedMode;
      }

      const updated = await updateDraftUnified(tx, identity, submissionId!, {
        bodyText,
        imageStorageKey: legacyImageKey,
        imageMimeType: legacyImageMime,
        submissionMode: submissionModeForRow,
      });
      if (!updated) {
        return { ok: false, status: 409, code: "submission_not_editable" };
      }

      if (action === "submit") {
        const fin = await submitFinalUnified(tx, identity, submissionId!);
        if (!fin) {
          return { ok: false, status: 409, code: "submit_failed" };
        }
        const sessionRow = await repo.getSessionById(tx, sessionId);
        const grammar = grammarCheckFromSessionSnapshot(sessionRow?.themeSnapshot ?? null, bodyText);
        await repo.updateSubmissionGrammarCheckResult(
          tx,
          fin.id,
          grammar as unknown as Record<string, unknown>
        );
        return { ok: true, submissionId: fin.id, status: fin.status };
      }

      const sub = await getSubmissionUnified(tx, identity, submissionId!);
      if (!sub) {
        return { ok: false, status: 500, code: "submission_missing" };
      }
      return { ok: true, submissionId: sub.id, status: sub.status };
    });
  } catch (e) {
    if (isPostgresUniqueViolation(e)) {
      return { ok: false, status: 409, code: "active_submission_conflict" };
    }
    throw e;
  }
}
