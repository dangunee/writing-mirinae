import { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { TrialPaymentCheckoutState } from '../../types/trialPaymentCheckout'

type Props = {
  data: TrialPaymentCheckoutState
  payLoading: boolean
  payError: string | null
  onPayClick: () => void
}

export default function TrialPaymentCheckoutMobile({ data, payLoading, payError, onPayClick }: Props) {
  const navigate = useNavigate()

  const goBack = () => {
    navigate('/writing/trial-payment')
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!payLoading) onPayClick()
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f7fa] text-[#2c2f32] selection:bg-[#4052b6]/20">
      <header className="fixed top-0 z-50 w-full bg-[#f5f7fa]/80 shadow-sm backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="material-symbols-outlined cursor-pointer text-indigo-700 transition-transform duration-200 active:scale-95 dark:text-indigo-400"
              aria-label="戻る"
            >
              arrow_back
            </button>
            <h1 className="trial-checkout-font-headline max-w-[min(100%,220px)] truncate text-base font-bold tracking-tight text-indigo-800 dark:text-indigo-300 sm:text-lg">
              ミリネ韓国語教室　作文トレーニング
            </h1>
          </div>
          <div className="w-8" />
        </div>
      </header>

      <main className="trial-checkout-mobile-main mx-auto max-w-[390px] space-y-6 px-5 pb-32 pt-24">
        <section className="mb-8">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.2em] text-[#4052b6]/60">CHECKOUT</span>
          <h2 className="trial-checkout-font-headline text-3xl font-extrabold tracking-tight text-[#2c2f32]">お支払い手続き</h2>
        </section>

        <div className="relative overflow-hidden rounded-xl bg-white p-6 shadow-[0_12px_24px_rgba(44,47,50,0.04)]">
          <div className="absolute -right-12 -top-12 h-24 w-24 rounded-full bg-[#4052b6]/5" />
          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-[#4052b6]">person</span>
            <h3 className="trial-checkout-font-headline font-bold text-[#2c2f32]">お申し込み内容</h3>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#74777a]">お名前</span>
              <p className="font-medium text-[#2c2f32]">{data.fullName} 様</p>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#74777a]">メールアドレス</span>
              <p className="font-medium text-[#2c2f32]">{data.email}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#74777a]">韓国語レベル</span>
                <p className="font-medium text-[#2c2f32]">{data.koreanLevel}</p>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#74777a]">開始日</span>
                <p className="font-medium text-[#2c2f32]">{data.startDateLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/50 bg-[#eef1f4] p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#4052b6]/10">
                <span className="material-symbols-outlined text-[#4052b6]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  school
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#2c2f32]">体験レッスン</p>
                <p className="text-xs text-[#595c5e]">オンライン 60分</p>
              </div>
            </div>
            <div className="text-right">
              <p className="trial-checkout-font-headline text-xl font-extrabold text-[#2c2f32]">¥1,800</p>
              <p className="text-[10px] font-medium text-[#abadb0]">(税込)</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 rounded-xl bg-white p-6 shadow-[0_12px_24px_rgba(44,47,50,0.04)]">
          <div className="mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-xl text-[#4052b6]">payments</span>
            <h3 className="trial-checkout-font-headline font-bold text-[#2c2f32]">カード情報の入力</h3>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-[#74777a]">カード番号</label>
              <div className="relative">
                <input
                  className="w-full rounded-lg border-none bg-[#eef1f4] px-4 py-3.5 text-[#2c2f32] outline-none transition-all placeholder:text-[#abadb0]/60 focus:ring-2 focus:ring-[#4052b6]/20"
                  placeholder="0000 0000 0000 0000"
                  type="text"
                  autoComplete="off"
                />
                <div className="absolute right-3 top-1/2 flex -translate-y-1/2 gap-1">
                  <div className="h-5 w-8 rounded-sm bg-[#d9dde1]" />
                  <div className="h-5 w-8 rounded-sm bg-[#d9dde1]" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-[#74777a]">有効期限 (MM/YY)</label>
                <input
                  className="w-full rounded-lg border-none bg-[#eef1f4] px-4 py-3.5 text-[#2c2f32] outline-none transition-all placeholder:text-[#abadb0]/60 focus:ring-2 focus:ring-[#4052b6]/20"
                  placeholder="MM / YY"
                  type="text"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label className="ml-1 text-[11px] font-bold uppercase tracking-wider text-[#74777a]">CVC</label>
                <div className="relative">
                  <input
                    className="w-full rounded-lg border-none bg-[#eef1f4] px-4 py-3.5 text-[#2c2f32] outline-none transition-all placeholder:text-[#abadb0]/60 focus:ring-2 focus:ring-[#4052b6]/20"
                    placeholder="123"
                    type="password"
                    autoComplete="off"
                  />
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-lg text-[#abadb0]">
                    help
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <button
                type="submit"
                disabled={payLoading}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#000666] py-4 text-base font-bold text-white shadow-lg transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-90"
              >
                <span>{payLoading ? 'Stripeのお支払い画面へ…' : '¥1,800を支払う'}</span>
                {!payLoading ? <span className="material-symbols-outlined text-lg">arrow_forward</span> : null}
              </button>
              {payError ? (
                <p className="text-center text-xs font-medium text-[#b41340]" role="alert">
                  {payError}
                </p>
              ) : null}
              <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-[#74777a]">
                <span className="material-symbols-outlined text-sm">info</span>※ 決済後の返金はできません
              </p>
            </div>
          </form>
        </div>

        <footer className="pb-8 pt-12 text-center">
          <p className="trial-checkout-font-headline text-sm font-bold uppercase tracking-widest text-[#74777a]/40">
            ミリネ韓国語教室　作文トレーニング
          </p>
          <div className="mt-4 flex justify-center gap-4 text-[#74777a]/30">
            <span className="material-symbols-outlined text-lg">language</span>
            <span className="material-symbols-outlined text-lg">shield_lock</span>
            <span className="material-symbols-outlined text-lg">verified_user</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
