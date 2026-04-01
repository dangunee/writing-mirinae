import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TrialPaymentCheckoutDesktop from '../components/payment/TrialPaymentCheckoutDesktop'
import TrialPaymentCheckoutMobile from '../components/payment/TrialPaymentCheckoutMobile'
import { apiUrl } from '../lib/apiUrl'
import '../trial-payment-checkout.css'
import { TRIAL_PAYMENT_DRAFT_KEY, type TrialPaymentCheckoutState } from '../types/trialPaymentCheckout'

function parseCheckoutState(raw: unknown): TrialPaymentCheckoutState | null {
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

export default function TrialPaymentCheckoutPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [data, setData] = useState<TrialPaymentCheckoutState | null>(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  useEffect(() => {
    const fromNav = parseCheckoutState(location.state)
    if (fromNav) {
      setData(fromNav)
      return
    }
    try {
      const raw = sessionStorage.getItem(TRIAL_PAYMENT_DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { checkout?: unknown }
        const co = parseCheckoutState(parsed.checkout)
        if (co) {
          setData(co)
          return
        }
      }
    } catch {
      /* ignore */
    }
    navigate('/writing/trial-payment', { replace: true })
  }, [location.state, navigate])

  const startStripeCheckout = useCallback(async () => {
    if (!data) return
    setPayError(null)
    setPayLoading(true)
    try {
      const origin = window.location.origin
      const successUrl = `${origin}/writing/trial-payment?checkout=success`
      const cancelUrl = `${origin}/writing/trial-payment/checkout`
      const res = await fetch(apiUrl('/api/writing/trial-payment/create-checkout-session'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          successUrl,
          cancelUrl,
        }),
      })
      const json = (await res.json()) as { checkoutUrl?: string; error?: string }
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
    } catch {
      setPayError('ネットワークエラーが発生しました。')
      setPayLoading(false)
    }
  }, [data])

  if (!data) {
    return null
  }

  return (
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
  )
}
