import { trialWritingErrorMessageJa } from './trialWritingErrorsJa'

/** GET /sessions/current `reasonIfNot` + client-side gate codes → Japanese (writing app). */
export function writingSessionReasonIfNotJa(code: string | null | undefined): string {
  const c = typeof code === 'string' ? code.trim() : ''
  if (!c) {
    return '現在、この課題には提出できません。ページを更新して状態を確認してください。'
  }
  switch (c) {
    case 'session_missed':
      return '提出期限を過ぎたため、この課題は提出できません。'
    case 'session_expired':
      return '提出期限を過ぎているため提出できません。'
    case 'session_locked':
      return 'この課題は現在提出を受け付けていません。'
    case 'trial_session_missing':
      return '体験用の課題セッションを準備できませんでした。'
    case 'all_sessions_completed':
      return 'すべての課題が完了しています。'
    case 'complete_previous_sessions_first':
      return '前の課題が完了していないため、まだ提出できません。'
    case 'no_session':
      return '提出可能な課題セッションがありません。ページを更新して再度お試しください。'
    case 'body_text_over_limit':
      return '文字数が500文字を超えています。500文字以内に収めてください。'
    case 'fresh_runtime_not_available':
      return 'この課題は現在提出を受け付けていません。ページを更新して状態を確認してください。'
    case 'session_already_submitted':
      return 'この課題はすでに提出済みです。'
    default:
      return trialWritingErrorMessageJa(c)
  }
}
