import { and, desc, eq, isNotNull, isNull, lte, ne } from "drizzle-orm";

import type { Db } from "../db/client";
import { trialApplications, writingSubmissions } from "../../db/schema";

/**
 * Logged-in user linked via POST /api/writing/account/link-trial-history (trial_applications.user_id).
 * Paid + ready + access window still open — full write path.
 */
export async function findActiveLinkedTrialApplicationForWritingSession(
  db: Db,
  userId: string
): Promise<{ id: string; accessExpiresAtIso: string | null } | null> {
  const now = new Date();
  const [row] = await db
    .select({
      id: trialApplications.id,
      accessExpiresAt: trialApplications.accessExpiresAt,
      paymentStatus: trialApplications.paymentStatus,
      accessStatus: trialApplications.accessStatus,
    })
    .from(trialApplications)
    .where(and(eq(trialApplications.userId, userId), isNull(trialApplications.trashedAt)))
    .orderBy(desc(trialApplications.createdAt))
    .limit(1);

  if (!row) return null;
  if (row.paymentStatus !== "paid") return null;
  if (row.accessStatus !== "ready") return null;
  const windowOk =
    row.accessExpiresAt == null ||
    (row.accessExpiresAt instanceof Date && row.accessExpiresAt > now);
  if (!windowOk) return null;

  return {
    id: row.id,
    accessExpiresAtIso: row.accessExpiresAt instanceof Date ? row.accessExpiresAt.toISOString() : null,
  };
}

/**
 * After access_expires_at: read-only continuation — non-draft submission must exist for this application.
 * Same ownership gate as active linked lookup (DB user_id on trial_applications only).
 */
export async function findLinkedTrialApplicationWithReadableSubmission(
  db: Db,
  userId: string
): Promise<{ id: string; accessExpiresAtIso: string | null } | null> {
  const [row] = await db
    .select({
      id: trialApplications.id,
      accessExpiresAt: trialApplications.accessExpiresAt,
    })
    .from(trialApplications)
    .innerJoin(
      writingSubmissions,
      and(
        eq(writingSubmissions.trialApplicationId, trialApplications.id),
        ne(writingSubmissions.status, "draft")
      )
    )
    .where(
      and(
        eq(trialApplications.userId, userId),
        eq(trialApplications.paymentStatus, "paid"),
        eq(trialApplications.accessStatus, "ready"),
        isNull(trialApplications.trashedAt)
      )
    )
    .orderBy(desc(writingSubmissions.updatedAt))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    accessExpiresAtIso: row.accessExpiresAt instanceof Date ? row.accessExpiresAt.toISOString() : null,
  };
}

/** Expired window + no prior branch matched — owner still gets /sessions/current shell for reissue UX. */
export async function findLatestExpiredLinkedTrialApplicationForShell(
  db: Db,
  userId: string
): Promise<{ id: string; accessExpiresAtIso: string | null } | null> {
  const now = new Date();
  const [row] = await db
    .select({
      id: trialApplications.id,
      accessExpiresAt: trialApplications.accessExpiresAt,
    })
    .from(trialApplications)
    .where(
      and(
        eq(trialApplications.userId, userId),
        eq(trialApplications.paymentStatus, "paid"),
        eq(trialApplications.accessStatus, "ready"),
        isNull(trialApplications.trashedAt),
        isNotNull(trialApplications.accessExpiresAt),
        lte(trialApplications.accessExpiresAt, now)
      )
    )
    .orderBy(desc(trialApplications.accessExpiresAt))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    accessExpiresAtIso: row.accessExpiresAt instanceof Date ? row.accessExpiresAt.toISOString() : null,
  };
}

/** Cookie-equivalent priority: in-window trial → expired/readable submission → expired shell for messaging. */
export async function resolveLinkedTrialApplicationForWritingSession(
  db: Db,
  userId: string
): Promise<{ id: string; accessExpiresAtIso: string | null } | null> {
  const open = await findActiveLinkedTrialApplicationForWritingSession(db, userId);
  if (open) return open;
  const readable = await findLinkedTrialApplicationWithReadableSubmission(db, userId);
  if (readable) return readable;
  return findLatestExpiredLinkedTrialApplicationForShell(db, userId);
}
