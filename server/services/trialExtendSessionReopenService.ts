import { eq } from "drizzle-orm";

import { trialApplications, trialExtendSessionReopenLog, writingSessions } from "../../db/schema";
import type { Db } from "../db/client";
import * as repo from "../repositories/writingStudentRepository";

/** Matches markMissedWhereDue — reopen only when learner never entered post-draft pipeline. */
const FINAL_TRIAL_SUBMISSION = new Set<string>(["submitted", "in_review", "corrected", "published"]);

export type TrialExtendReopenResult = {
  reopenedCount: number;
  reopenedSessionIdPrefixes: string[];
  skippedNotMissed: number;
  skippedFinalSubmission: number;
  skippedNoExpiry: boolean;
};

export function extractAccessExpiresIsoFromJson(text: string): string | null {
  try {
    const j = JSON.parse(text) as unknown;
    return extractAccessExpiresFromUnknown(j);
  } catch {
    return null;
  }
}

function extractAccessExpiresFromUnknown(j: unknown): string | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const direct = o.accessExpiresAt ?? o.access_expires_at;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  for (const key of ["application", "trial_application", "data", "trialApplication"] as const) {
    const nested = o[key];
    if (nested && typeof nested === "object") {
      const n = nested as Record<string, unknown>;
      const v = n.accessExpiresAt ?? n.access_expires_at;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

/**
 * Call after successful upstream extend-access. Re-opens missed trial runtime rows for this application only.
 */
export async function reopenMissedTrialSessionsAfterExtend(
  db: Db,
  args: {
    applicationId: string;
    actorUserId: string;
    /** New window end — sets writing.sessions.due_at */
    accessExpiresAt: Date | null;
    upstreamExtendResponseBody?: string | null;
  }
): Promise<TrialExtendReopenResult> {
  const applicationId = args.applicationId.trim();
  const result: TrialExtendReopenResult = {
    reopenedCount: 0,
    reopenedSessionIdPrefixes: [],
    skippedNotMissed: 0,
    skippedFinalSubmission: 0,
    skippedNoExpiry: false,
  };

  if (!applicationId) return result;

  let exp = args.accessExpiresAt;
  if ((!exp || Number.isNaN(exp.getTime())) && args.upstreamExtendResponseBody) {
    const iso = extractAccessExpiresIsoFromJson(args.upstreamExtendResponseBody);
    if (iso) exp = new Date(iso);
  }
  if (!exp || Number.isNaN(exp.getTime())) {
    const [ta] = await db
      .select({ accessExpiresAt: trialApplications.accessExpiresAt })
      .from(trialApplications)
      .where(eq(trialApplications.id, applicationId))
      .limit(1);
    exp = ta?.accessExpiresAt ?? null;
  }

  const now = new Date();
  if (!exp || Number.isNaN(exp.getTime())) {
    result.skippedNoExpiry = true;
    console.warn("trial_extend_reopen_skip_no_expiry", {
      applicationIdPrefix: applicationId.slice(0, 8),
    });
    return result;
  }

  const [taRow] = await db
    .select({ id: trialApplications.id })
    .from(trialApplications)
    .where(eq(trialApplications.id, applicationId))
    .limit(1);
  if (!taRow) {
    console.warn("trial_extend_reopen_application_missing", {
      applicationIdPrefix: applicationId.slice(0, 8),
    });
    return result;
  }

  const sessions = await db
    .select()
    .from(writingSessions)
    .where(eq(writingSessions.trialApplicationId, applicationId));

  const toReopen: (typeof writingSessions.$inferSelect)[] = [];
  for (const session of sessions) {
    const isMissed = session.status === "missed" || session.runtimeStatus === "missed";
    if (!isMissed) {
      result.skippedNotMissed += 1;
      continue;
    }

    const sub = await repo.getSubmissionBySessionIdForTrial(db, session.id, applicationId);
    if (sub && FINAL_TRIAL_SUBMISSION.has(sub.status)) {
      result.skippedFinalSubmission += 1;
      continue;
    }

    toReopen.push(session);
  }

  if (toReopen.length === 0) {
    return result;
  }

  await db.transaction(async (tx) => {
    for (const session of toReopen) {
      await tx
        .update(writingSessions)
        .set({
          status: "unlocked",
          runtimeStatus: "available",
          missedAt: null,
          dueAt: exp,
          updatedAt: now,
        })
        .where(eq(writingSessions.id, session.id));

      await tx.insert(trialExtendSessionReopenLog).values({
        applicationId,
        actorUserId: args.actorUserId,
        sessionId: session.id,
        previousStatus: session.status,
        previousRuntimeStatus: session.runtimeStatus ?? null,
        newDueAt: exp,
      });

      result.reopenedCount += 1;
      result.reopenedSessionIdPrefixes.push(session.id.slice(0, 8));
    }
  });

  console.info("trial_extend_reopen_done", {
    applicationIdPrefix: applicationId.slice(0, 8),
    reopenedCount: result.reopenedCount,
    newDueAtPrefix: exp.toISOString().slice(0, 16),
  });

  return result;
}
