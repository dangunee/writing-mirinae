import type { Db } from "../db/client";
import { listActiveWritingCoursesWithTerm } from "../repositories/writingAdminRepository";

/**
 * UUID used for admin trial sandbox + labels: env WRITING_TRIAL_COURSE_ID first.
 * If unset, and exactly one active/pending_setup non-sandbox course has a term title
 * containing 「体験」, use that row — matches preview labels like 「体験 · 準備中」 without env.
 * If ambiguous (0 or 2+), returns null (admin must set env).
 */
export async function resolveWritingTrialCourseIdForAdmin(db: Db): Promise<string | null> {
  const envId = process.env.WRITING_TRIAL_COURSE_ID?.trim();
  if (envId) return envId;

  const rows = await listActiveWritingCoursesWithTerm(db);
  const candidates = rows.filter(
    (r) =>
      !r.isAdminSandbox &&
      (r.status === "active" || r.status === "pending_setup") &&
      Boolean(r.termTitle?.trim()) &&
      r.termTitle!.includes("体験")
  );
  if (candidates.length === 1) {
    return candidates[0]!.id;
  }
  return null;
}
