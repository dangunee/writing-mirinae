import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PaymentDesktop from '../components/payment/PaymentDesktop'
import PaymentMobile from '../components/payment/PaymentMobile'
import '../payment.css'
import { TRIAL_PAYMENT_DRAFT_KEY, type TrialPaymentCheckoutState } from '../types/trialPaymentCheckout'
import type { TrialPaymentCalendarState, TrialPaymentFormValues } from '../types/trialPaymentForm'
import { formatJpDate } from '../utils/trialPaymentCalendar'

const MOBILE_LEVEL_LABELS: Record<string, string> = {
  beginner: '未経験・入門',
  elementary: '初級',
  intermediate: '中級',
  advanced: '上級',
}

function isMobileLevelValue(v: string): boolean {
  return Object.prototype.hasOwnProperty.call(MOBILE_LEVEL_LABELS, v)
}

function parseDraft(raw: string): {
  form?: TrialPaymentFormValues
  desktopCal?: { view: string; selected: string }
  mobileCal?: { view: string; selected: string }
} | null {
  try {
    return JSON.parse(raw) as {
      form?: TrialPaymentFormValues
      desktopCal?: { view: string; selected: string }
      mobileCal?: { view: string; selected: string }
    }
  } catch {
    return null
  }
}

/**
 * 体験レッスン決済 — Stitch 参照 HTML をデスクトップ / モバイルで別レイアウト（lg 以上でデスクトップ）
 */
export default function PaymentPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState<TrialPaymentFormValues>({
    fullName: '',
    furigana: '',
    email: '',
    koreanLevel: '',
    inquiry: '',
  })

  const [desktopCal, setDesktopCal] = useState<TrialPaymentCalendarState>({
    view: new Date(2024, 10, 1),
    selected: new Date(2024, 10, 10),
  })

  const [mobileCal, setMobileCal] = useState<TrialPaymentCalendarState>({
    view: new Date(2024, 11, 1),
    selected: new Date(2024, 11, 11),
  })

  const [showValidationError, setShowValidationError] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(TRIAL_PAYMENT_DRAFT_KEY)
    if (!raw) return
    const d = parseDraft(raw)
    if (!d) return
    if (d.form) setForm(d.form)
    if (d.desktopCal) {
      setDesktopCal({
        view: new Date(d.desktopCal.view),
        selected: new Date(d.desktopCal.selected),
      })
    }
    if (d.mobileCal) {
      setMobileCal({
        view: new Date(d.mobileCal.view),
        selected: new Date(d.mobileCal.selected),
      })
    }
  }, [])

  const persistDraft = useCallback(
    (checkout: TrialPaymentCheckoutState) => {
      sessionStorage.setItem(
        TRIAL_PAYMENT_DRAFT_KEY,
        JSON.stringify({
          form,
          desktopCal: { view: desktopCal.view.toISOString(), selected: desktopCal.selected.toISOString() },
          mobileCal: { view: mobileCal.view.toISOString(), selected: mobileCal.selected.toISOString() },
          checkout,
        })
      )
    },
    [form, desktopCal, mobileCal]
  )

  const handleCardPay = useCallback(() => {
    const lg = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
    const cal = lg ? desktopCal : mobileCal
    const selected = cal.selected

    const emailOk = /\S+@\S+\.\S+/.test(form.email.trim())
    const levelOk = form.koreanLevel.trim().length > 0

    if (
      !form.fullName.trim() ||
      !form.furigana.trim() ||
      !emailOk ||
      !levelOk
    ) {
      setShowValidationError(true)
      return
    }

    setShowValidationError(false)

    const koreanLevelLabel = isMobileLevelValue(form.koreanLevel)
      ? MOBILE_LEVEL_LABELS[form.koreanLevel] ?? form.koreanLevel
      : form.koreanLevel.trim()

    const y = selected.getFullYear()
    const m = String(selected.getMonth() + 1).padStart(2, '0')
    const day = String(selected.getDate()).padStart(2, '0')
    const startDate = `${y}-${m}-${day}`

    const checkout: TrialPaymentCheckoutState = {
      startDate,
      startDateLabel: formatJpDate(selected),
      fullName: form.fullName.trim(),
      furigana: form.furigana.trim(),
      email: form.email.trim(),
      koreanLevel: koreanLevelLabel,
      inquiry: form.inquiry.trim() || undefined,
    }

    persistDraft(checkout)
    navigate('/writing/trial-payment/checkout', { state: checkout })
  }, [desktopCal, mobileCal, form, navigate, persistDraft])

  return (
    <div className="payment-page-root">
      <div className="hidden lg:block">
        <PaymentDesktop
          form={form}
          setForm={setForm}
          calendar={desktopCal}
          setCalendar={setDesktopCal}
          showValidationError={showValidationError}
          onCardPay={handleCardPay}
        />
      </div>
      <div className="lg:hidden">
        <PaymentMobile
          form={form}
          setForm={setForm}
          calendar={mobileCal}
          setCalendar={setMobileCal}
          showValidationError={showValidationError}
          onCardPay={handleCardPay}
        />
      </div>
    </div>
  )
}
