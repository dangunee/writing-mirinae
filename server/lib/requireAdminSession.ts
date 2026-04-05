import { resolveRoleFromEnv } from "./authMe";
import { getSessionUserId } from "./supabaseServer";

export type AdminSessionResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 };

/**
 * Admin-only actions: identity from Supabase session only (never from client body).
 */
export async function requireAdminSessionUserId(): Promise<AdminSessionResult> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false, status: 401 };
  }
  if (resolveRoleFromEnv(userId) !== "admin") {
    return { ok: false, status: 403 };
  }
  return { ok: true, userId };
}
