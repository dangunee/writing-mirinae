import type { writingSessions, writingSubmissions } from "../../db/schema";
import { checkSessionEligibleForWriting } from "./writingSubmissionEligibility";

/** Trial progression: status completed/missed or runtime corrected/missed (aligned with writingStudentService). */
export function sessionIsTerminalForTrialCourse(s: typeof writingSessions.$inferSelect): boolean {
  if (s.status === "completed" || s.status === "missed") return true;
  const rt = s.runtimeStatus;
  return rt === "corrected" || rt === "missed";
}

export type TrialSubmitEligibilityPipeline = {
  session: typeof writingSessions.$inferSelect;
  submission: typeof writingSubmissions.$inferSelect;
} | null;

export type TrialSubmitEligibilityInput = {
  trialApplicationId: string;
  /** writing.sessions row after lazyUnlock refresh */
  session: typeof writingSessions.$inferSelect;
  /** Ordered trial runtime sessions for this application (same course). */
  sessionsOrdered: typeof writingSessions.$inferSelect[];
  pipeline: TrialSubmitEligibilityPipeline;
  /** Row for this session + trial when present */
  existingSubmission: typeof writingSubmissions.$inferSelect | null;
  now: Date;
};

/**
 * Single gate for trial GET canSubmit vs POST submit (excluding body length / upload validation).
 * Template rows (trial_application_id IS NULL) → trial_session_stale.
 */
export function evaluateTrialSubmitEligibility(
  input: TrialSubmitEligibilityInput
): { ok: true } | { ok: false; code: string } {
  const { trialApplicationId, session, sessionsOrdered, pipeline, existingSubmission, now } = input;

  if (session.trialApplicationId == null || session.trialApplicationId !== trialApplicationId) {
    return { ok: false, code: "trial_session_stale" };
  }
  if (!sessionsOrdered.some((x) => x.id === session.id)) {
    return { ok: false, code: "trial_session_stale" };
  }

  const elig = checkSessionEligibleForWriting(session, now);
  if (!elig.ok) {
    return elig;
  }

  const lower = sessionsOrdered.filter((x) => x.index < session.index);
  if (!lower.every((x) => sessionIsTerminalForTrialCourse(x))) {
    return { ok: false, code: "complete_previous_sessions_first" };
  }

  if (pipeline && pipeline.session.id !== session.id) {
    return { ok: false, code: "active_submission_on_other_session" };
  }

  if (existingSubmission && existingSubmission.status !== "draft") {
    return { ok: false, code: "submission_not_editable" };
  }

  return { ok: true };
}
