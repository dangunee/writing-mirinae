import { and, isNull, sql } from "drizzle-orm";

import { trialApplications } from "../../db/schema";
import type { Db } from "../db/client";

export type LinkTrialApplicationsResult = {
  matchedCount: number;
  linkedCount: number;
};

/**
 * Idempotent: only updates rows with user_id IS NULL and applicant_email matching (case-insensitive).
 * Never overwrites an existing user_id.
 */
export async function linkTrialApplicationsToUserByEmail(
  db: Db,
  userId: string,
  email: string
): Promise<LinkTrialApplicationsResult> {
  const normalized = email.trim().toLowerCase();
  // Single UPDATE with RETURNING — matchedCount === linkedCount for linked rows.
  const updated = await db
    .update(trialApplications)
    .set({ userId })
    .where(
      and(
        isNull(trialApplications.userId),
        isNull(trialApplications.trashedAt),
        sql`lower(trim(${trialApplications.applicantEmail})) = ${normalized}`
      )
    )
    .returning({ id: trialApplications.id });

  const n = updated.length;
  return { matchedCount: n, linkedCount: n };
}
