import { eq } from "drizzle-orm";

import { writingUserRoles } from "../../db/schema";
import type { Db } from "../db/client";
import type { AuthRole } from "./authMe";
import { resolveRoleFromEnv } from "./authMe";

/**
 * Same rules as DB lookup + env fallback; use when `writing.user_roles` row is already known (batch lists).
 */
export function resolveWritingRoleFromDbRowAndEnv(
  userId: string,
  dbRole: string | null | undefined
): AuthRole {
  if (dbRole === "admin" || dbRole === "teacher" || dbRole === "student") {
    return dbRole;
  }
  return resolveRoleFromEnv(userId);
}

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
  return resolveWritingRoleFromDbRowAndEnv(userId, rows[0]?.role);
}
