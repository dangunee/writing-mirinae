import { useCallback, useMemo } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import LandingNav from '../components/landing/LandingNav'
import { parseBankTransferCompleteState } from '../lib/paymentCompleteState'
import '../landing.css'
import '../bank-transfer-complete.css'
import type { BankTransferCompleteState } from '../types/trialPaymentCheckout'

const CONTACT_HREF = import.meta.env.VITE_INQUIRY_URL ?? 'https://mirinae.jp'

function BankCompleteFallback({ goApp }: { goApp: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="bank-complete-root min-h-screen bg-[#f5f7fa] text-[#2c2f32]">
      <LandingNav goApp={goApp} />
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 pb-24 pt-28 text-center">
        <p className="text-base leading-relaxed text-[#595c5e]">
          お申し込み情報を確認できませんでした。
          <br />
          最初のページからやり直してください。
        </p>
        <button
          type="button"
          onClick={() => navigate('/writing/trial-payment')}
          className="mt-8 w-full max-w-sm rounded-full bg-[#4052b6] py-4 text-sm font-bold text-[#f3f1ff] shadow-lg shadow-[#4052b6]/25 transition hover:bg-[#3346a9]"
        >
          体験レッスンお申し込みへ戻る
        </button>
      </main>
    </div>
  )
}

function BankCompleteContent({ data, goApp }: { data: BankTransferCompleteState; goApp: () => void }) {
  const navigate = useNavigate()
  const inquiryBlock = useMemo(() => {
    if (!data.inquiry) return null
    return (
      <div className="space-y-1 md:col-span-3">
        <div className="text-xs font-bold uppercase tracking-wider text-[#595c5e]">お問い合わせ内容</div>
        <p className="whitespace-pre-wrap text-base font-medium leading-relaxed text-[#2c2f32]">{data.inquiry}</p>
      </div>
    )
  }, [data.inquiry])

  const onLanding = useCallback(() => {
    navigate('/writing')
  }, [navigate])

  return (
    <div className="bank-complete-root min-h-screen bg-[#f5f7fa] text-[#2c2f32]">
      <LandingNav goApp={goApp} />

      {/* Desktop */}
      <main className="hidden flex-grow pb-32 pt-24 lg:block">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-12 text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#5cfd80] text-[#005d22]">
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-[#2c2f32] md:text-4xl">
              お申し込みが完了しました
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#595c5e]">
              お申し込みありがとうございます。
              <br />
              ご入金確認後に体験レッスンのご案内をメールでお送りします。
              <br />
              確認まで1〜2営業日かかる場合があります。
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-[#abadb0]/20 bg-white p-8 shadow-sm">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#ff9727] px-4 py-1.5 text-sm font-bold text-[#4c2700]">
              <span className="material-symbols-outlined text-sm">schedule</span>
              現在のステータス：入金待ち
            </div>
            <div className="flex flex-col gap-4 rounded-lg border-l-4 border-[#ff9727] bg-[#eef1f4] p-5">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[#8a4c00]">info</span>
                <p className="text-sm font-medium text-[#2c2f32]">振込名義が異なる場合は、必ずお問い合わせください</p>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-[#abadb0]/20 bg-white p-8 shadow-sm">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
              <span className="material-symbols-outlined text-[#4052b6]">person</span>
              お申し込み内容
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[#595c5e]">お名前</div>
                <div className="text-lg font-medium">{data.fullName}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[#595c5e]">メールアドレス</div>
                <div className="break-all text-lg font-medium">{data.email}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[#595c5e]">韓国語レベル</div>
                <div className="text-lg font-medium">{data.koreanLevel}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[#595c5e]">開始日</div>
                <div className="text-lg font-medium">{data.startDateLabel}</div>
              </div>
              {inquiryBlock}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="md:col-span-2 rounded-xl border border-[#abadb0]/15 bg-white p-8 shadow-sm">
              <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-[#2c2f32]">
                <span className="material-symbols-outlined text-[#4052b6]">account_balance</span>
                振込先情報
              </h2>
              <div className="space-y-4 text-[15px] font-medium leading-relaxed text-[#2c2f32]">
                <p className="break-words">
                  三井住友銀行　日暮里支店　普通 7961777　（株）カオンヌリ
                </p>
                <p className="break-words">
                  ゆうちょ銀行　記号 10190　番号 90647671　カ）カオンヌリ
                </p>
                <div className="border-t border-[#abadb0]/30 pt-5">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <span className="font-bold text-[#595c5e]">振込合計金額</span>
                    <span className="text-3xl font-extrabold text-[#4052b6]">
                      ¥1,800 <span className="text-sm font-normal text-[#595c5e]">（税込）</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative flex min-h-[280px] items-end overflow-hidden rounded-xl bg-[#4052b6]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#4052b6] to-[#3346a9] opacity-95" />
              <div className="relative p-6 text-[#f3f1ff]">
                <div className="mb-2 text-sm font-bold uppercase tracking-widest opacity-80">Guidance</div>
                <p className="text-lg font-medium leading-snug">
                  学習の旅を、
                  <br />
                  ここから始めましょう。
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-stretch gap-4 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={onLanding}
              className="inline-flex min-w-[240px] items-center justify-center rounded-full bg-[#4052b6] px-8 py-4 text-base font-bold text-[#f3f1ff] shadow-lg shadow-[#4052b6]/25 transition hover:bg-[#3346a9] active:scale-[0.98]"
            >
              ランディングページに戻る
            </button>
            <a
              href={CONTACT_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-[240px] items-center justify-center rounded-full border-2 border-[#4052b6] bg-white px-8 py-4 text-base font-bold text-[#4052b6] transition hover:bg-[#eef1f4] active:scale-[0.98]"
            >
              お問い合わせはこちら
            </a>
          </div>
        </div>
      </main>

      {/* Mobile */}
      <main className="pb-28 pt-24 lg:hidden">
        <div className="mx-auto max-w-2xl px-6">
          <section className="mb-10 text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-[#5cfd80] text-[#005d22] shadow-sm">
              <span className="material-symbols-outlined text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <h2 className="bank-complete-headline mb-3 text-2xl font-bold tracking-tight text-[#2c2f32]">
              お申し込みが完了しました
            </h2>
            <p className="leading-relaxed text-[#595c5e]">
              お申し込みありがとうございます。
              <br />
              ご入金確認後に体験レッスンのご案内をメールでお送りします。
              <br />
              確認まで1〜2営業日かかる場合があります。
            </p>
          </section>

          <div className="mb-8 flex justify-center">
            <div className="flex items-center gap-2 rounded-full border border-[#8a4c00]/10 bg-[#ff9727]/15 px-5 py-3 text-[#8a4c00]">
              <span className="material-symbols-outlined text-xl">pending</span>
              <span className="text-xs font-bold uppercase tracking-widest">現在のステータス：入金待ち</span>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-[#ff9727]/30 bg-[#eef1f4] p-4">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined shrink-0 text-[#8a4c00] text-lg">info</span>
              <p className="text-xs font-medium leading-relaxed text-[#2c2f32]">
                振込名義が異なる場合は、必ずお問い合わせください
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-xl bg-white p-6 shadow-sm">
            <p className="mb-4 font-['Be_Vietnam_Pro'] text-[10px] font-bold uppercase tracking-widest text-[#4052b6]">
              お申し込み内容
            </p>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-[#595c5e]">お名前</span>
                <span className="text-lg font-bold">{data.fullName}</span>
              </div>
              <div>
                <span className="block text-xs text-[#595c5e]">メールアドレス</span>
                <span className="break-all text-sm font-medium">{data.email}</span>
              </div>
              <div>
                <span className="block text-xs text-[#595c5e]">韓国語レベル</span>
                <span className="inline-block rounded bg-[#4052b6]/10 px-2 py-0.5 text-xs font-bold text-[#4052b6]">
                  {data.koreanLevel}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#595c5e]">開始日</span>
                <span className="text-sm font-bold">{data.startDateLabel}</span>
              </div>
              {data.inquiry ? (
                <div>
                  <span className="block text-xs text-[#595c5e]">お問い合わせ内容</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed">{data.inquiry}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mb-6 flex flex-col justify-center rounded-xl bg-[#4052b6] p-6 text-center text-[#f3f1ff] shadow-md">
            <span className="material-symbols-outlined mb-2 text-3xl opacity-80">payments</span>
            <p className="mb-1 font-['Be_Vietnam_Pro'] text-[10px] font-bold uppercase tracking-widest opacity-80">
              お支払い合計金額
            </p>
            <span className="bank-complete-headline text-4xl font-extrabold tracking-tighter">¥1,800</span>
            <p className="mt-2 text-[10px] opacity-70">税込</p>
          </div>

          <section className="space-y-4">
            <div className="rounded-xl border border-[#abadb0]/20 bg-white p-5 shadow-sm [box-shadow:0_8px_16px_rgba(44,47,50,0.05)]">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4052b6]">account_balance</span>
                <h3 className="bank-complete-headline text-lg font-bold text-[#2c2f32]">振込先情報</h3>
              </div>
              <div className="space-y-3 text-sm font-medium leading-relaxed text-[#2c2f32]">
                <p className="break-words">
                  三井住友銀行　日暮里支店　普通 7961777　（株）カオンヌリ
                </p>
                <p className="break-words">
                  ゆうちょ銀行　記号 10190　番号 90647671　カ）カオンヌリ
                </p>
              </div>
            </div>
          </section>

          <div className="mt-10 flex flex-col gap-3">
            <button
              type="button"
              onClick={onLanding}
              className="w-full rounded-full bg-[#4052b6] py-4 font-['Plus_Jakarta_Sans'] text-base font-bold text-[#f3f1ff] shadow-lg shadow-[#4052b6]/20 transition hover:bg-[#3346a9] active:scale-[0.98]"
            >
              ランディングページに戻る
            </button>
            <a
              href={CONTACT_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-full border-2 border-[#4052b6] bg-white py-4 text-center font-['Plus_Jakarta_Sans'] text-base font-bold text-[#4052b6] transition hover:bg-[#eef1f4] active:scale-[0.98]"
            >
              お問い合わせはこちら
            </a>
          </div>
          <p className="mt-6 px-2 text-center text-[10px] leading-relaxed text-[#595c5e]">
            7日以内にご入金が確認できない場合、お申し込みは自動的にキャンセルされます。
          </p>
        </div>
      </main>
    </div>
  )
}

export default function BankTransferCompletePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

  const rawState = location.state
  const legacy = parseBankTransferCompleteState(rawState)
  if (
    legacy &&
    rawState &&
    typeof rawState === 'object' &&
    !('paymentMethod' in rawState)
  ) {
    return (
      <Navigate
        to="/writing/app/complete"
        replace
        state={{ paymentMethod: 'bank_transfer', formData: legacy }}
      />
    )
  }

  const data = parseBankTransferCompleteState(rawState)

  if (!data) {
    return <BankCompleteFallback goApp={goApp} />
  }

  return <BankCompleteContent data={data} goApp={goApp} />
}
