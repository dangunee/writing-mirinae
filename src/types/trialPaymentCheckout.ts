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
