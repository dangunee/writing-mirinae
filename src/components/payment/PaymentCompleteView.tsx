import { Link } from 'react-router-dom'
import type { BankTransferCompleteState, TrialPaymentCheckoutState } from '../../types/trialPaymentCheckout'

const HERO_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCxjqNfsVMm6O-CbvJXMYkxS9t2g1lFz2gLoCEjUFjoPqKH9BBhj4i5ousg7bOVoZ_TzwI4UQrv4WVq_jplz7gDDrCVt005HDAxUf5WzvR-3JhvqL3AmyEjI6LYudex2Y2koCVjWNNUKtE4-TlCUCfboF6Ypwd6zRKoSP3ADHlL2-FS3NWbs5libgbmLGScDGAykru7DnMfBxdz9hnK-m97IEvcDmBTu2-dF429eN_MRceiZnuHbkWA0UB3Iw8u-rceP-s3ty5QWzo'

type Props = {
  paymentMethod: 'card' | 'bank_transfer'
  data: TrialPaymentCheckoutState | BankTransferCompleteState
}

function displayInquiry(data: TrialPaymentCheckoutState | BankTransferCompleteState): string | undefined {
  return data.inquiry?.trim() ? data.inquiry.trim() : undefined
}

/** 体験レッスン決済完了 — Stitch 参照（カード / 銀行振込 UI 分岐） */
export default function PaymentCompleteView({ paymentMethod, data }: Props) {
  const isCard = paymentMethod === 'card'
  const inquiry = displayInquiry(data)

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
            {/* 学習者情報（読み取り専用） */}
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
              {isCard ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#5cfd80] px-3 py-1 text-xs font-bold tracking-wider text-[#005d22]">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                    check_circle
                  </span>
                  PAYMENT SUCCESSFUL
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full bg-[#ff9727]/20 px-3 py-1 text-xs font-bold tracking-wider text-[#8a4c00]">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  入金待ち
                </div>
              )}
              <h1 className="font-['Plus_Jakarta_Sans'] text-4xl font-extrabold leading-tight tracking-tight text-[#2c2f32] md:text-5xl">
                {isCard ? '決済が完了しました' : 'お申し込みが完了しました'}
              </h1>
              <p className="max-w-md text-lg leading-relaxed text-[#595c5e]">
                {isCard ? (
                  <>
                    体験レッスンのご案内をメールでお送りしました。
                    <br />
                    すぐに課題作成を開始できます。
                  </>
                ) : (
                  <>
                    ご入金確認後、体験レッスンのご案内をメールでお送りします。
                    <br />
                    確認まで1～2営業日かかる場合があります。
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border-l-4 border-[#000666] bg-[#eef1f4] p-5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">Status</p>
                <p className="font-bold text-[#000666]">{isCard ? 'Active' : '入金待ち'}</p>
              </div>
              <div className="rounded-xl bg-[#eef1f4] p-5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#595c5e]">Method</p>
                <p className="font-bold text-[#2c2f32]">{isCard ? 'Credit Card' : 'Bank Transfer'}</p>
              </div>
            </div>

            {isCard ? (
              <div className="flex flex-col gap-4 pt-2 sm:flex-row">
                <Link
                  to="/writing/app"
                  className="group flex flex-1 items-center justify-center gap-2 rounded-full bg-[#ff9727] px-8 py-4 font-bold text-[#4c2700] [box-shadow:0_12px_24px_rgba(44,47,50,0.06)] transition-transform active:scale-95"
                >
                  <span>課題を作成する</span>
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span>
                </Link>
                <Link
                  to="/writing/app/mypage"
                  className="flex flex-1 items-center justify-center rounded-full bg-[#dfe3e7] px-8 py-4 font-semibold text-[#2c2f32] transition-colors hover:bg-[#d9dde1]"
                >
                  ダッシュボードへ
                </Link>
              </div>
            ) : null}

            <div className="flex items-start gap-3 rounded-xl bg-[#4052b6]/5 p-4">
              <span className="material-symbols-outlined text-[#4052b6]">mail</span>
              <div className="text-sm text-[#595c5e]">
                {isCard ? (
                  <>
                    <span className="font-bold text-[#2c2f32]">登録メールに案内を送信済み:</span>
                    ご登録いただいたメールアドレスに、詳細な手順を記載した確認メールを送信しました。
                  </>
                ) : (
                  <>
                    <span className="font-bold text-[#2c2f32]">ご入金確認後、メールでご案内をお送りします</span>
                  </>
                )}
              </div>
            </div>

            {!isCard ? (
              <div className="rounded-xl border border-[#abadb0]/20 bg-white p-6 shadow-sm [box-shadow:0_12px_24px_rgba(44,47,50,0.06)]">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-[#2c2f32]">
                  <span className="material-symbols-outlined text-[#4052b6]">account_balance</span>
                  振込先情報
                </h2>
                <div className="space-y-6 text-sm leading-relaxed text-[#2c2f32]">
                  <div>
                    <p className="font-bold text-[#4052b6]">三井住友銀行</p>
                    <p>日暮里支店</p>
                    <p>普通 7961777</p>
                    <p>（株）カオンヌリ</p>
                  </div>
                  <div>
                    <p className="font-bold text-[#006a28]">ゆうちょ銀行</p>
                    <p>記号 10190</p>
                    <p>番号 90647671</p>
                    <p>カ）カオンヌリ</p>
                  </div>
                  <div className="border-t border-[#abadb0]/30 pt-4">
                    <p className="font-bold text-[#595c5e]">振込金額</p>
                    <p className="text-2xl font-extrabold text-[#4052b6]">
                      ¥1,800<span className="ml-1 text-sm font-normal text-[#595c5e]">（税込）</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!isCard ? (
              <div className="pt-2">
                <Link
                  to="/writing"
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#4052b6] px-8 py-4 font-bold text-[#f3f1ff] [box-shadow:0_12px_24px_rgba(64,82,182,0.25)] transition-transform active:scale-95 sm:w-auto"
                >
                  ホームに戻る
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <footer className="py-8 text-center text-xs font-medium uppercase tracking-widest text-[#595c5e]/60">
        © ミリネ韓国語教室　作文トレーニング • Excellence in Education
      </footer>
    </div>
  )
}
