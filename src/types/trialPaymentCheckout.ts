/** navigate state + sessionStorage 用 — 体験レッスン trial-payment → checkout */
export type TrialPaymentCheckoutState = {
  /** ISO YYYY-MM-DD */
  startDate: string
  /** 表示用 例: 2026年4月1日 */
  startDateLabel: string
  fullName: string
  furigana: string
  email: string
  /** 表示用ラベル（初級 等） */
  koreanLevel: string
  inquiry?: string
}

export const TRIAL_PAYMENT_DRAFT_KEY = 'writing-trial-payment-draft'

/** チェックアウトから「戻る」等で trial-payment に戻ったときだけ draft を復元する（新規表示・F5 では復元しない） */
export const TRIAL_PAYMENT_RESTORE_DRAFT_KEY = 'writing-trial-payment-restore-draft'
