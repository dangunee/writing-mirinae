import type { Db } from "../db/client";
import type { AuthRole } from "./authMe";
import { resolveWritingRoleFromDbOrEnv } from "./writingAuthRoles";
import { getSessionUserId } from "./supabaseServer";

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 };

/**
 * Supabase cookie session only — never accept user id from request body/query.
 */
export async function requireAuthenticatedUser(): Promise<AuthResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false, status: 401 };
  }
  return { ok: true, userId };
}

/**
 * Authenticated user; use with ownership checks on writing resources.
 * (Named for parity with teacher/admin guards; does not assert a DB "student" row.)
 */
export async function requireStudentSession(): Promise<AuthResult> {
  return requireAuthenticatedUser();
}

export async function requireRole(
  db: Db,
  userId: string,
  allowed: readonly AuthRole[]
): Promise<AuthResult> {
  const role = await resolveWritingRoleFromDbOrEnv(db, userId);
  if (!allowed.includes(role)) {
    return { ok: false, status: 403 };
  }
  return { ok: true, userId };
}

export async function requireAdmin(db: Db): Promise<AuthResult> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return auth;
  }
  return requireRole(db, auth.userId, ["admin"]);
}

export async function requireTeacher(db: Db): Promise<AuthResult> {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) {
    return auth;
  }
  return requireRole(db, auth.userId, ["teacher", "admin"]);
}
