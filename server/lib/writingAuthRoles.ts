import { eq } from "drizzle-orm";

import { writingUserRoles } from "../../db/schema";
import type { Db } from "../db/client";
import type { AuthRole } from "./authMe";
import { resolveRoleFromEnv } from "./authMe";

/**
 * DB-backed app role for writing BFF; falls back to ADMIN_USER_IDS / TEACHER_USER_IDS when no row.
 * Never trust client-supplied role.
 */
export async function resolveWritingRoleFromDbOrEnv(db: Db, userId: string): Promise<AuthRole> {
  const rows = await db
    .select({ role: writingUserRoles.role })
    .from(writingUserRoles)
    .where(eq(writingUserRoles.userId, userId))
    .limit(1);
  const r = rows[0]?.role;
  if (r === "admin" || r === "teacher" || r === "student") {
    return r;
  }
  return resolveRoleFromEnv(userId);
}
