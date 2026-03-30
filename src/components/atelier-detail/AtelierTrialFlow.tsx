import { Link } from 'react-router-dom'

export default function AtelierTrialFlow() {
  return (
    <section className="overflow-hidden bg-primary px-6 py-16 text-on-primary md:px-8 md:py-24">
      <div className="mx-auto max-w-7xl">
        {/* Mobile */}
        <div className="md:hidden">
          <div className="mb-12 text-center">
            <h3 className="font-[family-name:var(--font-headline)] text-3xl font-bold tracking-tight">体験レッスンの流れ</h3>
          </div>
          <div className="mb-16 flex flex-col gap-8">
            <div className="flex items-start gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-on-primary/10">
                <span className="material-symbols-outlined text-2xl">upload_file</span>
              </div>
              <div className="space-y-1 pt-1">
                <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold">
                  <span className="mr-2 text-sm font-normal opacity-60">STEP 1</span>課題の提出
                </h4>
                <p className="text-sm leading-relaxed text-on-primary/60">
                  カリキュラムに基づいたプロンプトに沿って、渾身の一作（最大800文字）を提出してください。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-on-primary/10">
                <span className="material-symbols-outlined text-2xl">ink_pen</span>
              </div>
              <div className="space-y-1 pt-1">
                <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold">
                  <span className="mr-2 text-sm font-normal opacity-60">STEP 2</span>添削
                </h4>
                <p className="text-sm leading-relaxed text-on-primary/60">
                  文体や文法に関する詳細なフィードバックを、48時間以内に返却します。
                </p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-on-primary/10">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <div className="space-y-1 pt-1">
                <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold">
                  <span className="mr-2 text-sm font-normal opacity-60">STEP 3</span>フィードバック確認
                </h4>
                <p className="text-sm leading-relaxed text-on-primary/60">
                  第1期・第1レッスンの全コンテンツとサポート教材へのアクセスが可能です。
                </p>
              </div>
            </div>
          </div>
          <div className="relative space-y-6 rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl">
            <div className="flex items-start justify-between">
              <span className="font-[family-name:var(--font-label)] text-[10px] uppercase tracking-widest text-on-primary/40">
                お支払い明細のプレビュー
              </span>
              <div className="text-right">
                <p className="font-[family-name:var(--font-headline)] text-2xl font-bold">¥1,800</p>
                <p className="font-[family-name:var(--font-label)] text-[10px] uppercase text-on-primary/40">税込価格</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-white/10 py-2 text-sm">
                <span>体験レッスンパック</span>
                <span>¥1,800</span>
              </div>
              <div className="flex justify-between border-b border-white/10 py-2 text-sm">
                <span>プロフェッショナル添削</span>
                <span className="text-secondary-fixed">込み</span>
              </div>
              <div className="flex justify-between border-b border-white/10 py-2 text-sm">
                <span>教材費</span>
                <span className="text-secondary-fixed">込み</span>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden md:grid md:grid-cols-2 md:items-center md:gap-20">
          <div className="space-y-12">
            <div className="space-y-6">
              <h2 className="font-[family-name:var(--font-headline)] text-4xl font-bold tracking-tight md:text-5xl">
                体験レッスンの流れ
              </h2>
            </div>
            <div className="space-y-10">
              <div className="group flex gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-on-primary/10 transition-transform group-hover:scale-110 md:h-20 md:w-20">
                  <span className="material-symbols-outlined text-3xl md:text-4xl">upload_file</span>
                </div>
                <div className="space-y-1">
                  <span className="font-[family-name:var(--font-label)] text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary/40">
                    STEP 1
                  </span>
                  <h4 className="font-[family-name:var(--font-headline)] text-xl font-bold md:text-2xl">課題提出</h4>
                  <p className="text-sm text-on-primary/60 md:text-base">カリキュラムに基づいた課題を作成し提出します。</p>
                </div>
              </div>
              <div className="group flex gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-on-primary/10 transition-transform group-hover:scale-110 md:h-20 md:w-20">
                  <span className="material-symbols-outlined text-3xl md:text-4xl">ink_pen</span>
                </div>
                <div className="space-y-1">
                  <span className="font-[family-name:var(--font-label)] text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary/40">
                    STEP 2
                  </span>
                  <h4 className="font-[family-name:var(--font-headline)] text-xl font-bold md:text-2xl">添削</h4>
                  <p className="text-sm text-on-primary/60 md:text-base">プロの講師があなたの文章を丁寧に添削します。</p>
                </div>
              </div>
              <div className="group flex gap-6">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-on-primary/10 transition-transform group-hover:scale-110 md:h-20 md:w-20">
                  <span className="material-symbols-outlined text-3xl md:text-4xl">school</span>
                </div>
                <div className="space-y-1">
                  <span className="font-[family-name:var(--font-label)] text-[10px] font-bold uppercase tracking-[0.2em] text-on-primary/40">
                    STEP 3
                  </span>
                  <h4 className="font-[family-name:var(--font-headline)] text-xl font-bold md:text-2xl">フィードバック確認</h4>
                  <p className="text-sm text-on-primary/60 md:text-base">添削結果と模範解答、講師のメッセージを確認します。</p>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute -inset-4 rounded-full bg-on-primary/5 blur-3xl transition-all group-hover:bg-on-primary/10" />
            <div className="relative space-y-8 rounded-[2.5rem] border border-on-primary/20 bg-on-primary/10 p-8 backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <span className="font-[family-name:var(--font-label)] text-xs uppercase tracking-widest text-on-primary/40">
                  お支払い明細のプレビュー
                </span>
                <div className="text-right">
                  <p className="font-[family-name:var(--font-headline)] text-2xl font-bold">¥1,800</p>
                  <p className="font-[family-name:var(--font-label)] text-[10px] uppercase text-on-primary/40">税込価格</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between border-b border-on-primary/10 py-2 text-sm">
                  <span>体験レッスンパック</span>
                  <span>¥1,800</span>
                </div>
                <div className="flex justify-between border-b border-on-primary/10 py-2 text-sm">
                  <span>プロフェッショナル添削</span>
                  <span className="text-secondary-fixed">込み</span>
                </div>
                <div className="flex justify-between border-b border-on-primary/10 py-2 text-sm">
                  <span>教材費</span>
                  <span className="text-secondary-fixed">込み</span>
                </div>
              </div>
              <Link
                className="block w-full rounded-xl bg-on-primary py-4 text-center font-[family-name:var(--font-headline)] font-bold text-primary transition-colors hover:bg-primary-fixed"
                to="/writing/app"
              >
                お支払いへ進む
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
