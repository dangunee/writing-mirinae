/**
 * Japanese copy for trial writing public error codes (GET session + POST submission).
 * Codes mirror server/lib/trialWritingPublicErrors.ts (keep in sync manually).
 */
export type TrialWritingPublicErrorCode =
  | "trial_session_missing"
  | "trial_session_stale"
  | "session_expired"
  | "session_already_submitted"
  | "session_missed"
  | "body_text_over_limit"
  | "complete_previous_sessions_first"
  | "all_sessions_completed"
  | "internal_error";

const MESSAGES: Record<TrialWritingPublicErrorCode, string> = {
  trial_session_missing:
    "体験用の課題セッションを準備できませんでした。時間をおいて再度読み込んでください。",
  trial_session_stale:
    "セッション情報が古くなっています。ページを更新してから再度お試しください。",
  session_expired: "提出期限を過ぎているため提出できません。",
  session_already_submitted: "この課題はすでに提出済みです。",
  session_missed: "提出期限を過ぎたため、この課題は提出できません。",
  body_text_over_limit: "文字数が500文字を超えています。500文字以内に収めてください。",
  complete_previous_sessions_first: "前の課題が完了していないため、まだ提出できません。",
  all_sessions_completed: "すべての課題が完了しました。",
  internal_error: "一時的なエラーが発生しました。時間をおいて再度お試しください。",
};

export function trialWritingErrorMessageJa(code: string): string {
  if (code in MESSAGES) {
    return MESSAGES[code as TrialWritingPublicErrorCode];
  }
  return MESSAGES.internal_error;
}

/** POST retry hint after server refreshed session (not a public error code). */
export const TRIAL_SESSION_REFRESH_NOTICE_JA =
  "セッション情報が更新されました。もう一度提出してください。";
