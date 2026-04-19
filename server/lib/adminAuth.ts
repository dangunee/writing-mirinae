import { getDb } from "../db/client";
import { resolveWritingRoleFromDbOrEnv } from "./writingAuthRoles";
import { getSessionUserId } from "./supabaseServer";

/** Strict admin only (not teacher). */
export async function requireAdminUserId(): Promise<
  { ok: true; userId: string } | { ok: false; reason: "unauthorized" | "forbidden" }
> {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false, reason: "unauthorized" };
  }
  const db = getDb();
  const role = await resolveWritingRoleFromDbOrEnv(db, userId);
  if (role === "admin") {
    return { ok: true, userId };
  }
  return { ok: false, reason: "forbidden" };
}
