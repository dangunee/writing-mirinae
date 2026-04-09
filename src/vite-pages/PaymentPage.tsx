import { useCallback, useEffect, useRef, useState } from 'react'
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
import { createTodayCalendarState, formatJpDate } from '../utils/trialPaymentCalendar'

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

  const [desktopCal, setDesktopCal] = useState<TrialPaymentCalendarState>(() => createTodayCalendarState())

  const [mobileCal, setMobileCal] = useState<TrialPaymentCalendarState>(() => createTodayCalendarState())

  const [showValidationError, setShowValidationError] = useState(false)
  const [bankTransferSubmitting, setBankTransferSubmitting] = useState(false)
  const [bankTransferError, setBankTransferError] = useState<string | null>(null)
  const bankTransferErrorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (bankTransferError && bankTransferErrorRef.current) {
      bankTransferErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [bankTransferError])

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
    /** ブラウザ「戻る」で trial-payment に戻ったときも下書きを復元できるようにする（戻るボタンと同じキー） */
    sessionStorage.setItem(TRIAL_PAYMENT_RESTORE_DRAFT_KEY, '1')
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

    setBankTransferSubmitting(true)
    const controller = new AbortController()
    const timeoutMs = 15000
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
      const fullUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/api/bank-transfer-notify` : ''
      console.log('[bank-transfer] import.meta.env.VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL)
      console.log('[bank-transfer] fetch URL:', fullUrl)
      if (!fullUrl) {
        console.error('[bank-transfer] VITE_API_BASE_URL is empty; absolute API URL required')
        return
      }
      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
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
      console.log('[bank-transfer] response status:', res.status)
      console.log('[bank-transfer] response content-type:', res.headers.get('content-type'))
      console.log('[bank-transfer] response body (text):', text)
      let json: { ok?: boolean; error?: string; applicationId?: string } = {}
      try {
        json = text ? (JSON.parse(text) as { ok?: boolean; error?: string; applicationId?: string }) : {}
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
      if (json.applicationId) {
        console.info('[bank-transfer] trial_application_id', json.applicationId)
      }
      navigate('/writing/app/complete', { state: { paymentMethod: 'bank_transfer', formData: state } })
    } catch (e: unknown) {
      const aborted =
        (e instanceof Error || e instanceof DOMException) && (e as { name?: string }).name === 'AbortError'
      if (aborted) {
        setBankTransferError(
          `サーバー応答が${timeoutMs / 1000}秒以内にありませんでした。時間をおいて再度お試しください。`
        )
      } else {
        const msg = e instanceof Error ? e.message : ''
        const looksLikeFetchFailed =
          e instanceof TypeError || /failed to fetch|load failed|networkerror/i.test(msg)
        setBankTransferError(
          looksLikeFetchFailed
            ? '接続に失敗しました（ネットワークまたはCORS）。VITE_API_BASE_URL とサーバー設定をご確認ください。'
            : 'お申し込み通知の送信に失敗しました。しばらくしてから再度お試しください。'
        )
      }
    } finally {
      window.clearTimeout(timeoutId)
      setBankTransferSubmitting(false)
    }
  }, [desktopCal, mobileCal, form, navigate])

  return (
    <div className="payment-page-root">
      <LandingNav goApp={goApp} />
      {bankTransferError ? (
        <div
          ref={bankTransferErrorRef}
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
