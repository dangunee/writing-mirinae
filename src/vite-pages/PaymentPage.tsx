import PaymentDesktop from '../components/payment/PaymentDesktop'
import PaymentMobile from '../components/payment/PaymentMobile'
import '../payment.css'

/**
 * 体験レッスン決済 — Stitch 参照 HTML をデスクトップ / モバイルで別レイアウト（lg 以上でデスクトップ）
 */
export default function PaymentPage() {
  return (
    <div className="payment-page-root">
      <div className="hidden lg:block">
        <PaymentDesktop />
      </div>
      <div className="lg:hidden">
        <PaymentMobile />
      </div>
    </div>
  )
}
