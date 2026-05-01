/**
 * Stable, client-safe error codes for trial writing session + submission flows.
 * Internal / verbose codes are mapped here at API boundaries; full detail stays in logs only.
 */
export const TRIAL_WRITING_PUBLIC_ERROR_CODES = [
  "trial_session_missing",
  "trial_session_stale",
  "session_expired",
  "session_already_submitted",
  "session_missed",
  "body_text_over_limit",
  "complete_previous_sessions_first",
  /** Trial/student completion state for mode `all_done` (not a failure). */
  "all_sessions_completed",
  "internal_error",
] as const;

export type TrialWritingPublicErrorCode = (typeof TRIAL_WRITING_PUBLIC_ERROR_CODES)[number];

export function isTrialWritingPublicErrorCode(s: string): s is TrialWritingPublicErrorCode {
  return (TRIAL_WRITING_PUBLIC_ERROR_CODES as readonly string[]).includes(s);
}

/** Map internal service / eligibility codes to a small public set for JSON bodies. */
export function mapTrialWritingErrorToPublic(internal: string): TrialWritingPublicErrorCode {
  switch (internal) {
    case "trial_session_missing":
    case "trial_session_stale":
    case "session_expired":
    case "session_already_submitted":
    case "session_missed":
    case "body_text_over_limit":
    case "complete_previous_sessions_first":
    case "all_sessions_completed":
    case "internal_error":
      return internal;
    case "session_completed":
    case "submission_not_editable":
    case "pipeline_in_review_wait_for_result":
      return "session_already_submitted";
    case "trial_session_pending":
    case "session_locked":
    case "session_not_unlocked_yet":
    case "session_not_found":
    case "course_not_active":
    case "trial_course_not_configured":
    case "active_submission_on_other_session":
    default:
      return "internal_error";
  }
}
