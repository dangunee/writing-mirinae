import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LandingNav from '../components/landing/LandingNav'
import PaymentDesktop from '../components/payment/PaymentDesktop'
import PaymentMobile from '../components/payment/PaymentMobile'
import '../landing.css'
import '../payment.css'
import {
  TRIAL_PAYMENT_DRAFT_KEY,
  TRIAL_PAYMENT_RESTORE_DRAFT_KEY,
  type BankTransferCompleteState,
  type TrialPaymentCheckoutState,
} from '../types/trialPaymentCheckout'
import type { TrialPaymentCalendarState, TrialPaymentFormValues } from '../types/trialPaymentForm'
import { apiUrl, logApiFetch } from '../lib/apiUrl'
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
  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

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
  const [bankTransferSubmitting, setBankTransferSubmitting] = useState(false)
  const [bankTransferError, setBankTransferError] = useState<string | null>(null)

  useEffect(() => {
    const shouldRestore = sessionStorage.getItem(TRIAL_PAYMENT_RESTORE_DRAFT_KEY) === '1'
    sessionStorage.removeItem(TRIAL_PAYMENT_RESTORE_DRAFT_KEY)

    if (!shouldRestore) {
      sessionStorage.removeItem(TRIAL_PAYMENT_DRAFT_KEY)
      return
    }

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

  const handleBankTransfer = useCallback(async () => {
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
    setBankTransferError(null)

    const koreanLevelLabel = isMobileLevelValue(form.koreanLevel)
      ? MOBILE_LEVEL_LABELS[form.koreanLevel] ?? form.koreanLevel
      : form.koreanLevel.trim()

    const y = selected.getFullYear()
    const m = String(selected.getMonth() + 1).padStart(2, '0')
    const day = String(selected.getDate()).padStart(2, '0')
    const startDate = `${y}-${m}-${day}`
    const startDateLabel = formatJpDate(selected)
    const inquiryTrim = form.inquiry.trim()

    const state: BankTransferCompleteState = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      koreanLevel: koreanLevelLabel,
      startDate,
      startDateLabel,
      ...(inquiryTrim ? { inquiry: inquiryTrim } : {}),
    }

    const path = '/api/writing/trial-payment/bank-transfer-notify'
    setBankTransferSubmitting(true)
    try {
      logApiFetch('POST', path)
      const res = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          furigana: form.furigana.trim(),
          email: form.email.trim(),
          koreanLevel: koreanLevelLabel,
          startDate,
          startDateLabel,
          ...(inquiryTrim ? { inquiry: inquiryTrim } : {}),
        }),
      })
      const text = await res.text()
      let json: { ok?: boolean; error?: string } = {}
      try {
        json = text ? (JSON.parse(text) as { ok?: boolean; error?: string }) : {}
      } catch {
        const looksLikeHtml = /^\s*</.test(text)
        setBankTransferError(
          looksLikeHtml
            ? '通知APIが応答していません（HTMLが返りました）。別オリジンの API を VITE_API_BASE_URL に指定し、再ビルドしてください。'
            : 'サーバーからの応答を読み取れませんでした。'
        )
        return
      }
      if (!res.ok || !json.ok) {
        setBankTransferError(
          'お申し込み通知の送信に失敗しました。しばらくしてから再度お試しください。'
        )
        return
      }
      navigate('/writing/bank-complete', { state })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      const looksLikeFetchFailed =
        e instanceof TypeError || /failed to fetch|load failed|networkerror/i.test(msg)
      setBankTransferError(
        looksLikeFetchFailed
          ? '接続に失敗しました（ネットワークまたはCORS）。VITE_API_BASE_URL とサーバー設定をご確認ください。'
          : 'お申し込み通知の送信に失敗しました。しばらくしてから再度お試しください。'
      )
    } finally {
      setBankTransferSubmitting(false)
    }
  }, [desktopCal, mobileCal, form, navigate])

  return (
    <div className="payment-page-root">
      <LandingNav goApp={goApp} anchorBase="/writing" />
      {bankTransferError ? (
        <div
          role="alert"
          className="mx-auto max-w-4xl px-4 py-3 text-center text-sm text-red-800 bg-red-50 border-b border-red-100"
        >
          {bankTransferError}
        </div>
      ) : null}
      <div className="hidden lg:block">
        <PaymentDesktop
          form={form}
          setForm={setForm}
          calendar={desktopCal}
          setCalendar={setDesktopCal}
          showValidationError={showValidationError}
          onCardPay={handleCardPay}
          onBankTransfer={handleBankTransfer}
          bankTransferSubmitting={bankTransferSubmitting}
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
          onBankTransfer={handleBankTransfer}
          bankTransferSubmitting={bankTransferSubmitting}
        />
      </div>
    </div>
  )
}
