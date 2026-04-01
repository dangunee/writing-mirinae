import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import TrialPaymentCheckoutDesktop from '../components/payment/TrialPaymentCheckoutDesktop'
import TrialPaymentCheckoutMobile from '../components/payment/TrialPaymentCheckoutMobile'
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

  if (!data) {
    return null
  }

  return (
    <div className="trial-checkout-page-root">
      <div className="hidden lg:block">
        <TrialPaymentCheckoutDesktop data={data} />
      </div>
      <div className="lg:hidden">
        <TrialPaymentCheckoutMobile data={data} />
      </div>
    </div>
  )
}
