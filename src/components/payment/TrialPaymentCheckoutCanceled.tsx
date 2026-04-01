import { Link } from 'react-router-dom'
import type { TrialPaymentCheckoutState } from '../../types/trialPaymentCheckout'

type Props = {
  data: TrialPaymentCheckoutState | null
  payLoading: boolean
  payError: string | null
  onRetryPay: () => void
}

export default function TrialPaymentCheckoutCanceled({ data, payLoading, payError, onRetryPay }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] text-[#2c2f32]">
      <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="font-['Plus_Jakarta_Sans'] text-xl font-bold tracking-tight text-indigo-700">
            ミリネ韓国語教室　作文トレーニング
          </div>
        </div>
      </nav>

      <main className="mx-auto flex max-w-lg flex-grow flex-col justify-center px-6 pb-16 pt-28">
        <div className="rounded-2xl border border-[#abadb0]/20 bg-white p-8 shadow-[0_12px_24px_rgba(44,47,50,0.06)]">
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">お支払いが完了していません</h1>
          <p className="mt-4 text-[#595c5e]">もう一度決済を行ってください。</p>
          {payError ? (
            <p className="mt-4 text-sm font-medium text-[#b41340]" role="alert">
              {payError}
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              disabled={payLoading || !data}
              onClick={onRetryPay}
              className="w-full rounded-full bg-[#4052b6] py-4 font-bold text-[#f3f1ff] shadow-lg transition-all hover:bg-[#3346a9] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {payLoading ? '処理中…' : 'もう一度決済する'}
            </button>
            <Link
              to="/writing/trial-payment"
              className="w-full rounded-full border border-[#abadb0]/40 py-4 text-center font-semibold text-[#4052b6] hover:bg-[#eef1f4]"
            >
              申し込み内容を修正する
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
