import { getDb } from "../db/client";
import { resolveWritingRoleFromDbOrEnv } from "./writingAuthRoles";
import { getSessionUserId } from "./supabaseServer";

/**
 * Teacher or admin (DB writing.user_roles or TEACHER_USER_IDS / ADMIN_USER_IDS env).
 * Set TEACHER_ALLOW_ALL=true only for local dev — never in production.
 */
export async function requireTeacherUserId(): Promise<
  { ok: true; userId: string } | { ok: false; reason: "unauthorized" | "forbidden" }
> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false, reason: "unauthorized" };
  }

  if (process.env.TEACHER_ALLOW_ALL === "true") {
    return { ok: true, userId };
  }

  const db = getDb();
  const role = await resolveWritingRoleFromDbOrEnv(db, userId);
  if (role === "teacher" || role === "admin") {
    return { ok: true, userId };
  }
  return { ok: false, reason: "forbidden" };
}
