import { Link } from 'react-router-dom'
import type { TrialPaymentCheckoutState } from '../../types/trialPaymentCheckout'

const HERO_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCxjqNfsVMm6O-CbvJXMYkxS9t2g1lFz2gLoCEjUFjoPqKH9BBhj4i5ousg7bOVoZ_TzwI4UQrv4WVq_jplz7gDDrCVt005HDAxUf5WzvR-3JhvqL3AmyEjI6LYudex2Y2koCVjWNNUKtE4-TlCUCfboF6Ypwd6zRKoSP3ADHlL2-FS3NWbs5libgbmLGScDGAykru7DnMfBxdz9hnK-m97IEvcDmBTu2-dF429eN_MRceiZnuHbkWA0UB3Iw8u-rceP-s3ty5QWzo'

type Props = {
  data: TrialPaymentCheckoutState
}

/** 決済完了 — Stitch 参照レイアウト（カード入力なし） */
export default function TrialPaymentCheckoutSuccess({ data }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32] antialiased">
      <nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="font-['Plus_Jakarta_Sans'] text-xl font-bold tracking-tight text-[#000666]">
            ミリネ韓国語教室　作文トレーニング
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span className="material-symbols-outlined">help</span>
            <span className="material-symbols-outlined">account_circle</span>
          </div>
        </div>
        <div className="h-px w-full bg-slate-100/50" />
      </nav>

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
                体験レッスンのご案内をメールでお送りしました。
                <br />
                すぐに課題作成を開始できます。
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

            <div className="flex items-start gap-3 rounded-xl bg-[#4052b6]/5 p-4">
              <span className="material-symbols-outlined text-[#4052b6]">mail</span>
              <div className="text-sm text-[#595c5e]">
                <span className="font-bold text-[#2c2f32]">登録メールに案内を送信済み:</span>
                ご登録いただいたメールアドレスに、詳細な手順を記載した確認メールを送信しました。
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
