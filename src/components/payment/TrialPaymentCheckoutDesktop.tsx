import { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { TRIAL_PAYMENT_RESTORE_DRAFT_KEY, type TrialPaymentCheckoutState } from '../../types/trialPaymentCheckout'

const TRIAL_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCVVFoIR1x3Mf18Yf3U5K1VhhJag6dPbxxOBSEqIRnHj07hL3wSeWZihNGXNuTuvypMCmse_eK-pzXIq1meZHppg9hGqM-jJTQ3ADzO9Q8DQ2fAl5Xo69mbYyGkt-ZqmsXTXhlLbluSVw2qzKSy8MOF7JtrF2mwtH-g-gTr68G0CXUlws50ehFcRNpk0LNeFcCYR5eJg25hr1YzL-79V03Wn1UDlwtLv1ZJzpF1mzfR6Jvb-2hZh2gIDj6JPHSEUCV7TPFgBwpK0oU'

type Props = {
  data: TrialPaymentCheckoutState
  payLoading: boolean
  payError: string | null
  onPayClick: () => void
}

/** Stripe Hosted Checkout へ送る前の確認画面（カード入力 UI なし） */
export default function TrialPaymentCheckoutDesktop({ data, payLoading, payError, onPayClick }: Props) {
  const navigate = useNavigate()

  const goBack = () => {
    sessionStorage.setItem(TRIAL_PAYMENT_RESTORE_DRAFT_KEY, '1')
    navigate('/writing/trial-payment')
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!payLoading) onPayClick()
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] text-[#2c2f32]">
      <main className="flex flex-grow items-center justify-center px-4 pb-12 pt-24">
        <div className="grid w-full max-w-5xl grid-cols-1 items-start gap-12 md:grid-cols-2">
          <div className="space-y-8">
            <div className="space-y-2">
              <button
                type="button"
                onClick={goBack}
                className="group inline-flex items-center gap-2 text-sm font-medium text-[#4052b6]"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                戻る
              </button>
              <h1 className="trial-checkout-font-headline mt-4 text-4xl font-extrabold tracking-tight text-[#2c2f32]">
                お支払い手続き
              </h1>
              <p className="text-lg leading-relaxed text-[#595c5e]">
                次の画面で Stripe の安全な決済ページが開きます。カード情報の入力は Stripe 上で行われます。
              </p>
            </div>

            <div className="space-y-6 rounded-xl bg-[#eef1f4] p-8">
              <div className="flex items-center gap-6">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-[#8899ff]">
                  <img alt="Trial Lesson" className="h-full w-full object-cover" src={TRIAL_IMG} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[#4052b6]">KOREAN LESSON</p>
                  <h3 className="trial-checkout-font-headline text-xl font-bold text-[#2c2f32]">体験レッスン</h3>
                  <p className="text-sm text-[#595c5e]">個別カウンセリング付き</p>
                </div>
              </div>
              <div className="space-y-3 border-t border-[#abadb0]/20 pt-6">
                <div className="flex justify-between text-[#595c5e]">
                  <span>小計</span>
                  <span>¥1,800</span>
                </div>
                <div className="flex justify-between text-[#595c5e]">
                  <span>消費税 (10%)</span>
                  <span>¥0 (税込表記)</span>
                </div>
                <div className="flex items-center justify-between pt-3 text-[#2c2f32]">
                  <span className="text-lg font-bold">合計</span>
                  <span className="text-3xl font-extrabold tracking-tighter text-[#4052b6]">¥1,800</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#abadb0]/10 bg-white p-8 shadow-2xl md:p-10">
            <form className="space-y-8" onSubmit={onSubmit}>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#595c5e]">お名前</span>
                  <input
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border-none bg-[#eef1f4] px-4 py-3 text-[#2c2f32]"
                    type="text"
                    value={data.fullName}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#595c5e]">メールアドレス</span>
                  <input
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border-none bg-[#eef1f4] px-4 py-3 text-[#2c2f32]"
                    type="email"
                    value={data.email}
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#595c5e]">韓国語レベル</span>
                    <input
                      readOnly
                      className="w-full cursor-not-allowed rounded-lg border-none bg-[#eef1f4] px-4 py-3 text-[#2c2f32]"
                      type="text"
                      value={data.koreanLevel}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#595c5e]">開始日</span>
                    <input
                      readOnly
                      className="w-full cursor-not-allowed rounded-lg border-none bg-[#eef1f4] px-4 py-3 text-[#2c2f32]"
                      type="text"
                      value={data.startDateLabel}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-6">
                <button
                  type="submit"
                  disabled={payLoading}
                  className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#4052b6] py-5 font-bold text-[#f3f1ff] shadow-lg shadow-[#4052b6]/20 transition-all hover:bg-[#3346a9] active:scale-[0.98] disabled:cursor-wait disabled:opacity-90"
                >
                  <span>{payLoading ? 'Stripeのお支払い画面へ移動しています…' : '¥1,800を支払う'}</span>
                  {!payLoading ? (
                    <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                  ) : null}
                </button>
                {payError ? (
                  <p className="px-2 text-center text-xs font-medium text-[#b41340]" role="alert">
                    {payError}
                  </p>
                ) : null}
                <p className="px-4 text-center text-xs leading-relaxed text-[#595c5e]">
                  「支払う」をクリックすることで、当教室の
                  <a className="underline" href="#">
                    利用規約
                  </a>
                  および
                  <a className="underline" href="#">
                    返金ポリシー
                  </a>
                  に同意したものとみなされます。
                </p>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
