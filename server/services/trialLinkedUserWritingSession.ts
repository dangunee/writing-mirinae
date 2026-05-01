import { and, desc, eq, isNull } from "drizzle-orm";

import type { Db } from "../db/client";
import { trialApplications } from "../../db/schema";

/**
 * Logged-in user linked via POST /api/writing/account/link-trial-history (trial_applications.user_id).
 * Same eligibility gates as mirinae-api cookie session (paid, ready, access window).
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
    .where(
      and(eq(trialApplications.userId, userId), isNull(trialApplications.trashedAt))
    )
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
