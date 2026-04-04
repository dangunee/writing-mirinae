import type {
  BankTransferCompleteState,
  PaymentCompleteNavigateState,
  TrialPaymentCheckoutState,
} from '../types/trialPaymentCheckout'

export function parseTrialPaymentCheckoutState(raw: unknown): TrialPaymentCheckoutState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (
    typeof o.startDate !== 'string' ||
    typeof o.startDateLabel !== 'string' ||
    typeof o.fullName !== 'string' ||
    typeof o.furigana !== 'string' ||
    typeof o.email !== 'string' ||
    typeof o.koreanLevel !== 'string'
  ) {
    return null
  }
  return {
    startDate: o.startDate,
    startDateLabel: o.startDateLabel,
    fullName: o.fullName,
    furigana: o.furigana,
    email: o.email,
    koreanLevel: o.koreanLevel,
    inquiry: typeof o.inquiry === 'string' ? o.inquiry : undefined,
  }
}

export function parseBankTransferCompleteState(raw: unknown): BankTransferCompleteState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const fullName = typeof o.fullName === 'string' ? o.fullName.trim() : ''
  const email = typeof o.email === 'string' ? o.email.trim() : ''
  const koreanLevel = typeof o.koreanLevel === 'string' ? o.koreanLevel.trim() : ''
  const startDate = typeof o.startDate === 'string' ? o.startDate.trim() : ''
  const startDateLabel = typeof o.startDateLabel === 'string' ? o.startDateLabel.trim() : ''
  const inquiryRaw = o.inquiry
  const inquiry =
    typeof inquiryRaw === 'string' && inquiryRaw.trim().length > 0 ? inquiryRaw.trim() : undefined

  if (!fullName || !email || !koreanLevel || !startDate || !startDateLabel) return null
  return { fullName, email, koreanLevel, startDate, startDateLabel, inquiry }
}

export function parsePaymentCompleteNavigateState(raw: unknown): PaymentCompleteNavigateState | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const pm = o.paymentMethod
  if (pm !== 'card' && pm !== 'bank_transfer') return null
  const formData = o.formData
  const tf = o.trialFlow
  const trialFlow =
    tf === 'entitlement' || tf === 'trial_lesson' ? tf : undefined
  const stripeSessionId =
    typeof o.stripeSessionId === 'string' && o.stripeSessionId.trim().length > 0
      ? o.stripeSessionId.trim()
      : undefined
  if (pm === 'card') {
    const parsed = parseTrialPaymentCheckoutState(formData)
    return parsed ? { paymentMethod: 'card', formData: parsed, trialFlow, stripeSessionId } : null
  }
  const parsed = parseBankTransferCompleteState(formData)
  return parsed ? { paymentMethod: 'bank_transfer', formData: parsed } : null
}
