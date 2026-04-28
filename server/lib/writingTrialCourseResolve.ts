import type { Db } from "../db/client";
import { listActiveWritingCoursesWithTerm } from "../repositories/writingAdminRepository";

/** Term titles that identify the public trial course when WRITING_TRIAL_COURSE_ID is unset. */
export function writingTrialTermTitleLooksLikeTrial(termTitle: string | null | undefined): boolean {
  const t = String(termTitle ?? "").trim();
  if (!t) return false;
  if (t.includes("体験")) return true;
  if (t.includes("체험")) return true;
  return /\btrial\b/i.test(t);
}

/**
 * Trial mail-link flows may target a course that is still `pending_setup` while admins
 * register assignments; student-owned paid courses still use `active` only elsewhere.
 */
export function isWritingCourseOpenForTrialLearner(status: string): boolean {
  return status === "active" || status === "pending_setup";
}

/**
 * UUID for learner trial GET/submit: env WRITING_TRIAL_COURSE_ID first, else exactly one
 * active/pending_setup non-sandbox course whose term title looks like a trial course.
 */
export async function resolveWritingTrialCourseIdForLearner(db: Db): Promise<string | null> {
  const envId = process.env.WRITING_TRIAL_COURSE_ID?.trim();
  if (envId) return envId;

  const rows = await listActiveWritingCoursesWithTerm(db);
  const candidates = rows.filter(
    (r) =>
      !r.isAdminSandbox &&
      (r.status === "active" || r.status === "pending_setup") &&
      writingTrialTermTitleLooksLikeTrial(r.termTitle)
  );
  if (candidates.length === 1) {
    return candidates[0]!.id;
  }
  return null;
}

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
