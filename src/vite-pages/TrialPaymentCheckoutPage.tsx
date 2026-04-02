import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import LandingNav from '../components/landing/LandingNav'
import TrialPaymentCheckoutCanceled from '../components/payment/TrialPaymentCheckoutCanceled'
import TrialPaymentCheckoutDesktop from '../components/payment/TrialPaymentCheckoutDesktop'
import TrialPaymentCheckoutMobile from '../components/payment/TrialPaymentCheckoutMobile'
import { apiUrl, isApiBaseConfigured, logApiFetch } from '../lib/apiUrl'
import { parseTrialPaymentCheckoutState } from '../lib/paymentCompleteState'
import '../landing.css'
import '../trial-payment-checkout.css'
import {
  TRIAL_PAYMENT_DRAFT_KEY,
  TRIAL_PAYMENT_RESTORE_DRAFT_KEY,
  type TrialPaymentCheckoutState,
} from '../types/trialPaymentCheckout'

function loadCheckoutFromStorage(): TrialPaymentCheckoutState | null {
  try {
    const raw = sessionStorage.getItem(TRIAL_PAYMENT_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { checkout?: unknown }
    return parseTrialPaymentCheckoutState(parsed.checkout)
  } catch {
    return null
  }
}

function parsePaymentResultStudent(raw: unknown): TrialPaymentCheckoutState | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  return parseTrialPaymentCheckoutState({
    startDate: s.startDate,
    startDateLabel: s.startDateLabel,
    fullName: s.fullName,
    furigana: s.furigana,
    email: s.email,
    koreanLevel: s.koreanLevel,
    inquiry: s.inquiry,
  })
}

export default function TrialPaymentCheckoutPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])
  const [searchParams] = useSearchParams()

  const success = searchParams.get('success') === 'true'
  const canceled = searchParams.get('canceled') === 'true'
  const sessionId = searchParams.get('session_id')?.trim() ?? ''

  const [data, setData] = useState<TrialPaymentCheckoutState | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [successResolved, setSuccessResolved] = useState<TrialPaymentCheckoutState | null>(null)
  const [successResolveLoading, setSuccessResolveLoading] = useState(() => success && !!sessionId)

  useEffect(() => {
    const fromNav = parseTrialPaymentCheckoutState(location.state)
    if (fromNav) {
      setData(fromNav)
      setHydrated(true)
      return
    }
    const fromStorage = loadCheckoutFromStorage()
    if (fromStorage) {
      setData(fromStorage)
      setHydrated(true)
      return
    }
    setHydrated(true)
  }, [location.state])

  useEffect(() => {
    if (!hydrated) return
    if (success || canceled) return
    if (!data) {
      navigate('/writing/trial-payment', { replace: true })
    }
  }, [hydrated, success, canceled, data, navigate])

  useEffect(() => {
    if (!success || !sessionId) {
      setSuccessResolveLoading(false)
      return
    }
    let cancelled = false
    setSuccessResolveLoading(true)

    const fallback = (): TrialPaymentCheckoutState | null =>
      loadCheckoutFromStorage() || parseTrialPaymentCheckoutState(location.state)

    ;(async () => {
      try {
        if (!isApiBaseConfigured()) {
          if (!cancelled) {
            setSuccessResolved(fallback())
            setSuccessResolveLoading(false)
          }
          return
        }
        const path = `/api/writing/trial-payment/payment-result?session_id=${encodeURIComponent(sessionId)}`
        logApiFetch('GET', path)
        const res = await fetch(apiUrl(path))
        const text = await res.text()
        let json: { ok?: boolean; student?: unknown } = {}
        try {
          json = text ? (JSON.parse(text) as { ok?: boolean; student?: unknown }) : {}
        } catch {
          if (!cancelled) {
            setSuccessResolved(fallback())
            setSuccessResolveLoading(false)
          }
          return
        }
        if (!cancelled) {
          const parsed = res.ok && json.ok ? parsePaymentResultStudent(json.student) : null
          setSuccessResolved(parsed ?? fallback())
          setSuccessResolveLoading(false)
        }
      } catch {
        if (!cancelled) {
          setSuccessResolved(fallback())
          setSuccessResolveLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [success, sessionId, location.state])

  const startStripeCheckout = useCallback(async () => {
    if (!data) return
    setPayError(null)
    setPayLoading(true)
    const checkoutPath = '/api/writing/trial-payment/create-checkout-session'
    try {
      if (!isApiBaseConfigured()) {
        setPayError(
          'API の接続先が設定されていません。VITE_API_BASE_URL を設定して再ビルド・再デプロイしてください。'
        )
        setPayLoading(false)
        return
      }
      const origin = window.location.origin
      const successUrl = `${origin}/writing/trial-payment/checkout?success=true&session_id={CHECKOUT_SESSION_ID}`
      const cancelUrl = `${origin}/writing/trial-payment/checkout?canceled=true`
      logApiFetch('POST', checkoutPath)
      const res = await fetch(apiUrl(checkoutPath), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          successUrl,
          cancelUrl,
        }),
      })
      const text = await res.text()
      let json: { checkoutUrl?: string; error?: string } = {}
      try {
        json = text ? (JSON.parse(text) as { checkoutUrl?: string; error?: string }) : {}
      } catch {
        const looksLikeHtml = /^\s*</.test(text)
        setPayError(
          looksLikeHtml
            ? '決済APIが応答していません（HTMLが返りました）。別オリジンの API を VITE_API_BASE_URL に指定し、再ビルドしてください。'
            : 'サーバーからの応答を読み取れませんでした。'
        )
        setPayLoading(false)
        return
      }
      if (!res.ok) {
        setPayError(
          json.error === 'invalid_redirect_urls'
            ? 'リダイレクトURLが許可されていません。CHECKOUT_REDIRECT_ALLOWLIST をご確認ください。'
            : '決済の開始に失敗しました。しばらくしてから再度お試しください。'
        )
        setPayLoading(false)
        return
      }
      if (json.checkoutUrl) {
        window.location.assign(json.checkoutUrl)
        return
      }
      setPayError('決済URLを取得できませんでした。')
      setPayLoading(false)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('VITE_API_BASE_URL')) {
        setPayError(
          'API の接続先が設定されていません。VITE_API_BASE_URL を設定して再ビルド・再デプロイしてください。'
        )
        setPayLoading(false)
        return
      }
      const looksLikeFetchFailed =
        e instanceof TypeError || /failed to fetch|load failed|networkerror/i.test(msg)
      setPayError(
        looksLikeFetchFailed
          ? '接続に失敗しました（ネットワークまたはCORS）。VITE_API_BASE_URL とサーバー設定をご確認ください。'
          : '決済の開始に失敗しました。しばらくしてから再度お試しください。'
      )
      setPayLoading(false)
    }
  }, [data])

  if (!hydrated) {
    return null
  }

  if (success) {
    if (sessionId && successResolveLoading) {
      return (
        <>
          <LandingNav goApp={goApp} anchorBase="/writing" />
          <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7fa] px-6 pt-16 text-[#595c5e] md:pt-20">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-[#4052b6] border-t-transparent"
              aria-hidden
            />
            <p className="mt-4 text-sm font-medium">お申し込み内容を確認しています…</p>
          </div>
        </>
      )
    }
    const checkoutData: TrialPaymentCheckoutState | null = sessionId ? successResolved : data
    if (!checkoutData) {
      return (
        <>
          <LandingNav goApp={goApp} anchorBase="/writing" />
          <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7fa] px-6 pt-16 text-center text-[#595c5e] md:pt-20">
            <p className="trial-checkout-font-headline text-lg font-medium">
              申し込み情報を読み込めませんでした。体験レッスンお申し込みページからお進みください。
            </p>
            <button
              type="button"
              className="mt-6 rounded-full bg-[#4052b6] px-6 py-3 font-bold text-white"
              onClick={() => navigate('/writing/trial-payment')}
            >
              戻る
            </button>
          </div>
        </>
      )
    }
    sessionStorage.removeItem(TRIAL_PAYMENT_RESTORE_DRAFT_KEY)
    sessionStorage.removeItem(TRIAL_PAYMENT_DRAFT_KEY)
    return (
      <Navigate
        to="/writing/app/complete"
        replace
        state={{ paymentMethod: 'card', formData: checkoutData }}
      />
    )
  }

  if (canceled) {
    return (
      <>
        <LandingNav goApp={goApp} anchorBase="/writing" />
        <TrialPaymentCheckoutCanceled
          data={data}
          payLoading={payLoading}
          payError={payError}
          onRetryPay={startStripeCheckout}
        />
      </>
    )
  }

  if (!data) {
    return null
  }

  return (
    <>
      <LandingNav goApp={goApp} anchorBase="/writing" />
      <div className="trial-checkout-page-root">
        <div className="hidden lg:block">
          <TrialPaymentCheckoutDesktop
            data={data}
            payLoading={payLoading}
            payError={payError}
            onPayClick={startStripeCheckout}
          />
        </div>
        <div className="lg:hidden">
          <TrialPaymentCheckoutMobile
            data={data}
            payLoading={payLoading}
            payError={payError}
            onPayClick={startStripeCheckout}
          />
        </div>
      </div>
    </>
  )
}
