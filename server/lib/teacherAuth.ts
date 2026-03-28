import { getSessionUserId } from "./supabaseServer";

/**
 * Teacher-only access (v1): session user id must appear in TEACHER_USER_IDS (comma-separated UUIDs).
 * Set TEACHER_ALLOW_ALL=true only for local dev — never in production.
 * Future: role table or course.teacher_id; audit logs should record teacherUserId on mutations.
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

  const raw = process.env.TEACHER_USER_IDS ?? "";
  const allowed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (allowed.length === 0) {
    return { ok: false, reason: "forbidden" };
  }

  if (!allowed.includes(userId)) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, userId };
}
