import { sql } from "drizzle-orm";

import type { Db } from "../db/client";

export type AdminUserTrialRow = {
  userId: string;
  email: string | null;
  trialLinkedCount: number;
  hasTrialHistory: boolean;
};

const LIST_LIMIT = 500;

/**
 * auth.users + trial link counts (writing.trial_applications.user_id). Server-only; admin session enforced in route.
 */
export async function listAdminUsersWithTrialLinkage(db: Db): Promise<AdminUserTrialRow[]> {
  const rowList = await db.execute<{
    user_id: string;
    email: string | null;
    trial_linked_count: string;
  }>(sql`
    SELECT
      u.id::text AS user_id,
      u.email::text AS email,
      COALESCE(
        (SELECT COUNT(*)::text
         FROM writing.trial_applications ta
         WHERE ta.user_id = u.id),
        '0'
      ) AS trial_linked_count
    FROM auth.users u
    ORDER BY u.created_at DESC
    LIMIT ${LIST_LIMIT}
  `);

  const raw = Array.from(
    rowList as unknown as {
      user_id: string;
      email: string | null;
      trial_linked_count: string;
    }[]
  );
  return raw.map((r) => {
    const n = parseInt(r.trial_linked_count, 10);
    const trialLinkedCount = Number.isFinite(n) ? n : 0;
    return {
      userId: r.user_id,
      email: r.email,
      trialLinkedCount,
      hasTrialHistory: trialLinkedCount > 0,
    };
  });
}
