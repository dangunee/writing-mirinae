/** React Router location.state — /writing/bank-complete（URL に個人情報を載せない） */
export type BankTransferCompleteState = {
  fullName: string
  email: string
  koreanLevel: string
  /** ISO YYYY-MM-DD */
  startDate: string
  /** 表示用 例: 2026年4月1日 */
  startDateLabel: string
  /** 入力がある場合のみ */
  inquiry?: string
}

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

/** カード決済の Stripe metadata 由来（payment-result API） */
export type TrialPaymentCheckoutTrialFlow = 'entitlement' | 'trial_lesson'

/** React Router location.state — /writing/app/complete（カード・銀行振込共通） */
export type PaymentCompleteNavigateState = {
  paymentMethod: 'card' | 'bank_transfer'
  formData: TrialPaymentCheckoutState | BankTransferCompleteState
  /** カードのみ。entitlement のときはメールのトークンリンクが正規ルートのため /writing/app へ誘導しない */
  trialFlow?: TrialPaymentCheckoutTrialFlow
}

export const TRIAL_PAYMENT_DRAFT_KEY = 'writing-trial-payment-draft'

/** チェックアウトから「戻る」等で trial-payment に戻ったときだけ draft を復元する（新規表示・F5 では復元しない） */
export const TRIAL_PAYMENT_RESTORE_DRAFT_KEY = 'writing-trial-payment-restore-draft'
