import { getDb } from "../db/client";
import { resolveWritingRoleFromDbOrEnv } from "./writingAuthRoles";
import { getSessionUserId } from "./supabaseServer";

export type AdminSessionResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 };

/**
 * Admin-only actions: identity from Supabase session only (never from client body).
 * Role from writing.user_roles when present, else ADMIN_USER_IDS env allowlist.
 */
export async function requireAdminSessionUserId(): Promise<AdminSessionResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false, status: 401 };
  }
  const db = getDb();
  const role = await resolveWritingRoleFromDbOrEnv(db, userId);
  if (role !== "admin") {
    return { ok: false, status: 403 };
  }
  return { ok: true, userId };
}
