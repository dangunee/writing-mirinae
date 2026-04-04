import { useState } from 'react'
import { Link } from 'react-router-dom'
import { trialPaymentApiUrl } from '../../lib/apiUrl'
import type {
  BankTransferCompleteState,
  TrialPaymentCheckoutState,
  TrialPaymentCheckoutTrialFlow,
} from '../../types/trialPaymentCheckout'

type TrialStartLinkResponse =
  | { ok: true; redirectTo: string }
  | { ok: false; code: 'NOT_FOUND' | 'NOT_PAID' | 'EXPIRED' | 'REQUEST_FAILED' }

const HERO_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCxjqNfsVMm6O-CbvJXMYkxS9t2g1lFz2gLoCEjUFjoPqKH9BBhj4i5ousg7bOVoZ_TzwI4UQrv4WVq_jplz7gDDrCVt005HDAxUf5WzvR-3JhvqL3AmyEjI6LYudex2Y2koCVjWNNUKtE4-TlCUCfboF6Ypwd6zRKoSP3ADHlL2-FS3NWbs5libgbmLGScDGAykru7DnMfBxdz9hnK-m97IEvcDmBTu2-dF429eN_MRceiZnuHbkWA0UB3Iw8u-rceP-s3ty5QWzo'

type Props = {
  paymentMethod: 'card' | 'bank_transfer'
  data: TrialPaymentCheckoutState | BankTransferCompleteState
  /** カード決済かつ API が返したとき。entitlement はメールの /writing/trial/start リンクが本体 */
  trialFlow?: TrialPaymentCheckoutTrialFlow
  /** Stripe Checkout Session ID（体験開始リンク API 用。カード entitlement のみ） */
  stripeSessionId?: string
}

function displayInquiry(data: TrialPaymentCheckoutState | BankTransferCompleteState): string | undefined {
  return data.inquiry?.trim() ? data.inquiry.trim() : undefined
}

function trialStartLinkErrorMessage(
  code: Extract<TrialStartLinkResponse, { ok: false }>['code']
): string {
  const messages: Record<typeof code, string> = {
    NOT_FOUND: 'リンクを発行できませんでした。時間をおいて再度お試しください。',
    NOT_PAID: '決済の反映を待っています。しばらくしてから再度お試しください。',
    EXPIRED: '体験の有効期限が切れています。サポートへお問い合わせください。',
    REQUEST_FAILED: '接続に失敗しました。時間をおいて再度お試しください。',
  }
  return messages[code]
}

/** 体験レッスン決済完了 — Stitch 参照（カード / 銀行振込 UI 分岐） */
export default function PaymentCompleteView({ paymentMethod, data, trialFlow, stripeSessionId }: Props) {
  const isCard = paymentMethod === 'card'
  const isEntitlementCard = isCard && trialFlow === 'entitlement'
  const inquiry = displayInquiry(data)
  const [trialStartLoading, setTrialStartLoading] = useState(false)
  const [trialStartError, setTrialStartError] = useState<string | null>(null)

  const showTrialStartCta = Boolean(isEntitlementCard && stripeSessionId?.trim())

  async function requestTrialStartLink() {
    const sid = stripeSessionId?.trim()
    if (!sid) return
    setTrialStartError(null)
    setTrialStartLoading(true)
    try {
      const res = await fetch(trialPaymentApiUrl('/api/writing/trial/start-link'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid }),
      })
      let json: TrialStartLinkResponse = { ok: false, code: 'REQUEST_FAILED' }
      try {
        const text = await res.text()
        json = text ? (JSON.parse(text) as TrialStartLinkResponse) : json
      } catch {
        setTrialStartError(trialStartLinkErrorMessage('REQUEST_FAILED'))
        return
      }
      if (!json.ok || !('redirectTo' in json) || !json.redirectTo) {
        const code = json.ok === false ? json.code : 'REQUEST_FAILED'
        setTrialStartError(trialStartLinkErrorMessage(code))
        return
      }
      const dest = json.redirectTo
      window.location.href = dest.startsWith('http')
        ? dest
        : new URL(dest, window.location.origin).href
    } catch {
      setTrialStartError(trialStartLinkErrorMessage('REQUEST_FAILED'))
    } finally {
      setTrialStartLoading(false)
    }
  }

  if (isCard) {
    return (
      <div className="flex min-h-screen flex-col bg-[#f5f7fa] font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32] antialiased">
        <main className="flex flex-grow flex-col items-center justify-center px-4 pb-12 pt-24 md:px-6">
          <div className="grid w-full max-w-4xl grid-cols-1 items-center gap-8 md:grid-cols-12">
            <div className="relative order-2 h-64 overflow-hidden rounded-xl md:order-1 md:col-span-5 md:h-[450px] [box-shadow:0_12px_24px_rgba(44,47,50,0.06)]">
              <img alt="" className="h-full w-full object-cover" src={HERO_IMG} />
              <div className="absolute inset-0 bg-gradient-to-tr from-[#000666]/40 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">SCHOLARLY • EXPERIENCE</p>
                <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold">Your journey begins.</h3>
              </div>
            </div>

            <div className="order-1 space-y-8 md:order-2 md:col-span-7">
              <div className="space-y-3">
                <div className="rounded-xl bg-[#eef1f4] p-4">
                  <p className="mb-1 text-xs font-medium text-[#595c5e]">お名前</p>
                  <p className="font-medium text-[#2c2f32]">{data.fullName}</p>
                </div>
                <div className="rounded-xl bg-[#eef1f4] p-4">
                  <p className="mb-1 text-xs font-medium text-[#595c5e]">メールアドレス</p>
                  <p className="font-medium text-[#2c2f32]">{data.email}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-[#eef1f4] p-4">
                    <p className="mb-1 text-xs font-medium text-[#595c5e]">韓国語レベル</p>
                    <p className="font-medium text-[#2c2f32]">{data.koreanLevel}</p>
                  </div>
                  <div className="rounded-xl bg-[#eef1f4] p-4">
                    <p className="mb-1 text-xs font-medium text-[#595c5e]">開始日</p>
                    <p className="font-medium text-[#2c2f32]">{data.startDateLabel}</p>
                  </div>
                </div>
                {inquiry ? (
                  <div className="rounded-xl bg-[#eef1f4] p-4">
                    <p className="mb-1 text-xs font-medium text-[#595c5e]">お問い合わせ内容</p>
                    <p className="whitespace-pre-wrap font-medium text-[#2c2f32]">{inquiry}</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#5cfd80] px-3 py-1 text-xs font-bold tracking-wider text-[#005d22]">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                  PAYMENT SUCCESSFUL
                </div>
                <h1 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold leading-tight tracking-tight text-[#2c2f32] md:text-5xl">
                  決済が完了しました
                </h1>
                <p className="max-w-md text-lg leading-relaxed text-[#595c5e]">
                  {isEntitlementCard ? (
                    <>
                      下のボタンから体験を開始できます（決済後7日間、いつでも再発行可能です）。
                      <br />
                      <span className="text-base text-[#595c5e]/90">
                        メールのリンクは15分で切れます。切れた場合は
                        <Link to="/writing/trial/reissue" className="font-medium text-[#4052b6] underline">
                          再発行ページ
                        </Link>
                        からお受け取りください。
                      </span>
                    </>
                  ) : (
                    <>
                      体験レッスンのご案内をメールでお送りしました。
                      <br />
                      すぐに課題作成を開始できます。
                    </>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border-l-4 border-[#000666] bg-[#eef1f4] p-5">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">Status</p>
                  <p className="font-bold text-[#000666]">Active</p>
                </div>
                <div className="rounded-xl bg-[#eef1f4] p-5">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">Method</p>
                  <p className="font-bold text-[#2c2f32]">Credit Card</p>
                </div>
              </div>

              {showTrialStartCta ? (
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    disabled={trialStartLoading}
                    onClick={() => void requestTrialStartLink()}
                    className="group flex w-full items-center justify-center gap-2 rounded-full bg-[#ff9727] px-8 py-4 font-bold text-[#4c2700] [box-shadow:0_12px_24px_rgba(44,47,50,0.06)] transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <span>{trialStartLoading ? '準備中…' : '体験を開始する'}</span>
                    {!trialStartLoading ? (
                      <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                        arrow_forward
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    disabled={trialStartLoading}
                    onClick={() => void requestTrialStartLink()}
                    className="flex w-full items-center justify-center rounded-full border-2 border-[#4052b6] bg-white px-8 py-3.5 text-sm font-bold text-[#4052b6] transition-colors hover:bg-[#4052b6]/5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {trialStartLoading ? '準備中…' : '体験リンクを再発行する'}
                  </button>
                  {trialStartError ? (
                    <p className="mt-1 text-center text-sm font-medium text-[#b42318]" role="alert">
                      {trialStartError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-4 pt-2 sm:flex-row">
                <Link
                  to={isEntitlementCard ? '/writing/course' : '/writing/app'}
                  className={
                    isEntitlementCard && showTrialStartCta
                      ? 'group flex flex-1 items-center justify-center gap-2 rounded-full bg-[#dfe3e7] px-8 py-4 font-semibold text-[#2c2f32] transition-colors hover:bg-[#d9dde1]'
                      : 'group flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff9727] px-8 py-4 font-bold text-[#4c2700] [box-shadow:0_12px_24px_rgba(44,47,50,0.06)] transition-transform active:scale-95'
                  }
                >
                  <span>{isEntitlementCard ? 'コース・体験の流れを見る' : '課題を作成する'}</span>
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </Link>
                <Link
                  to="/writing/app/mypage"
                  className="flex flex-1 items-center justify-center rounded-full bg-[#dfe3e7] px-8 py-4 font-semibold text-[#2c2f32] transition-colors hover:bg-[#d9dde1]"
                >
                  ダッシュボードへ
                </Link>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-[#4052b6]/5 p-4">
                <span className="material-symbols-outlined text-[#4052b6]">mail</span>
                <div className="text-sm text-[#595c5e]">
                  <span className="font-bold text-[#2c2f32]">確認メール:</span>
                  ご登録のメールアドレスにもリンクをお送りしています（15分有効）。ページを閉じた場合やリンク切れのときは
                  <Link to="/writing/trial/reissue" className="font-medium text-[#4052b6] underline">
                    再発行ページ
                  </Link>
                  から再取得できます。
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="py-8 text-center text-xs font-medium uppercase tracking-widest text-[#595c5e]/60">
          © ミリネ韓国語教室　作文トレーニング • Excellence in Education
        </footer>
      </div>
    )
  }

  /* bank_transfer — 単一カラム・画像なし・振込先は独立カード */
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32] antialiased">
      <main className="flex flex-grow flex-col px-4 pb-8 pt-16 md:px-6">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          <div className="space-y-2">
            <div className="rounded-xl bg-[#eef1f4] p-3">
              <p className="mb-0.5 text-xs font-medium text-[#595c5e]">お名前</p>
              <p className="font-medium text-[#2c2f32]">{data.fullName}</p>
            </div>
            <div className="rounded-xl bg-[#eef1f4] p-3">
              <p className="mb-0.5 text-xs font-medium text-[#595c5e]">メールアドレス</p>
              <p className="font-medium text-[#2c2f32]">{data.email}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-[#eef1f4] p-3">
                <p className="mb-0.5 text-xs font-medium text-[#595c5e]">韓国語レベル</p>
                <p className="font-medium text-[#2c2f32]">{data.koreanLevel}</p>
              </div>
              <div className="rounded-xl bg-[#eef1f4] p-3">
                <p className="mb-0.5 text-xs font-medium text-[#595c5e]">開始日</p>
                <p className="font-medium text-[#2c2f32]">{data.startDateLabel}</p>
              </div>
            </div>
            {inquiry ? (
              <div className="rounded-xl bg-[#eef1f4] p-3">
                <p className="mb-0.5 text-xs font-medium text-[#595c5e]">お問い合わせ内容</p>
                <p className="whitespace-pre-wrap font-medium text-[#2c2f32]">{inquiry}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#ff9727]/20 px-3 py-1 text-xs font-bold tracking-wider text-[#8a4c00]">
              <span className="material-symbols-outlined text-sm">schedule</span>
              入金待ち
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-3xl font-extrabold leading-tight tracking-tight text-[#2c2f32] md:text-4xl">
              お申し込みが完了しました
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#595c5e]">
              ご入金確認後、体験レッスンのご案内をメールでお送りします。
              <br />
              確認まで1～2営業日かかる場合があります。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-l-4 border-[#000666] bg-[#eef1f4] p-4">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">Status</p>
              <p className="font-bold text-[#000666]">入金待ち</p>
            </div>
            <div className="rounded-xl bg-[#eef1f4] p-4">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">Method</p>
              <p className="font-bold text-[#2c2f32]">Bank Transfer</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-[#4052b6]/5 p-3">
            <span className="material-symbols-outlined shrink-0 text-[#4052b6]">mail</span>
            <div className="text-sm text-[#595c5e]">
              <span className="font-bold text-[#2c2f32]">ご入金確認後、メールでご案内をお送りします</span>
            </div>
          </div>

          <div className="w-full space-y-3 pt-1">
            <h2 className="flex items-center gap-2 text-base font-bold text-[#2c2f32]">
              <span className="material-symbols-outlined text-[#4052b6]">account_balance</span>
              振込先情報
            </h2>
            <div className="w-full rounded-xl border border-[#abadb0]/20 bg-white p-4 shadow-sm [box-shadow:0_8px_16px_rgba(44,47,50,0.05)]">
              <div className="space-y-3 text-sm leading-relaxed text-[#2c2f32]">
                <p className="break-words text-[15px] font-medium">
                  三井住友銀行　日暮里支店　普通 7961777　（株）カオンヌリ
                </p>
                <p className="break-words text-[15px] font-medium">
                  ゆうちょ銀行　記号 10190　番号 90647671　カ）カオンヌリ
                </p>
                <div className="border-t border-[#abadb0]/25 pt-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <span className="text-sm font-bold text-[#595c5e]">振込金額</span>
                    <span className="text-xl font-extrabold text-[#4052b6]">
                      ¥1,800<span className="ml-1 text-xs font-normal text-[#595c5e]">（税込）</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <Link
              to="/writing"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#4052b6] px-8 py-3.5 text-sm font-bold text-[#f3f1ff] [box-shadow:0_8px_16px_rgba(64,82,182,0.2)] transition-transform active:scale-95"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs font-medium uppercase tracking-widest text-[#595c5e]/60">
        © ミリネ韓国語教室　作文トレーニング • Excellence in Education
      </footer>
    </div>
  )
}
