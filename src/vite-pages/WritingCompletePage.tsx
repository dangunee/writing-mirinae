import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PaymentCompleteView from '../components/payment/PaymentCompleteView'
import { apiUrl } from '../lib/apiUrl'
import { parsePaymentCompleteNavigateState } from '../lib/paymentCompleteState'

const POLL_MS = 2000
const MAX_WAIT_MS = 60_000

type UiState = 'pending' | 'unauthorized' | 'timeout'

export default function WritingCompletePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const payment = parsePaymentCompleteNavigateState(location.state)

  const [ui, setUi] = useState<UiState>('pending')
  const doneRef = useRef(false)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (payment) return

    const intervalId = window.setInterval(() => {
      void poll()
    }, POLL_MS)

    const timeoutId = window.setTimeout(() => {
      if (doneRef.current) return
      doneRef.current = true
      window.clearInterval(intervalId)
      setUi('timeout')
    }, MAX_WAIT_MS)

    async function poll() {
      if (doneRef.current || inFlightRef.current) return
      inFlightRef.current = true
      try {
        const res = await fetch(apiUrl('/api/writing/sessions/current'), {
          credentials: 'include',
        })
        if (doneRef.current) return
        if (res.status === 401) {
          doneRef.current = true
          window.clearInterval(intervalId)
          window.clearTimeout(timeoutId)
          setUi('unauthorized')
          return
        }
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean }
          if (data?.ok === true) {
            doneRef.current = true
            window.clearInterval(intervalId)
            window.clearTimeout(timeoutId)
            navigate('/writing/app', { replace: true })
            return
          }
        }
      } catch {
        /* 다음 간격에 재시도 */
      } finally {
        inFlightRef.current = false
      }
    }

    void poll()

    return () => {
      if (!doneRef.current) {
        doneRef.current = true
      }
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [navigate, payment])

  if (payment) {
    return <PaymentCompleteView paymentMethod={payment.paymentMethod} data={payment.formData} />
  }

  return (
    <div className="writing-page">
      <p className="status pending">
        {ui === 'pending' && '확인 중…'}
        {ui === 'unauthorized' && '로그인이 필요합니다.'}
        {ui === 'timeout' && '잠시 후 새로고침해 주세요.'}
      </p>
    </div>
  )
}
