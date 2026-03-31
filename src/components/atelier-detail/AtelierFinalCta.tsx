import { Link } from 'react-router-dom'

export default function AtelierFinalCta() {
  return (
    <>
      <section className="bg-white px-6 pb-6 pt-20 text-center md:hidden">
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="space-y-6">
            <h2 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold leading-tight tracking-tight text-primary">
              学びの美学を、その手元に.
            </h2>
            <p className="text-sm leading-relaxed text-on-surface/60">
              「良い文章」と「卓越した文章」の違いは、たった一度の正確な添削から始まります。
            </p>
          </div>
          <div className="flex flex-col items-center gap-6">
            <Link
              className="w-full max-w-sm rounded-2xl bg-primary px-8 py-6 text-center font-[family-name:var(--font-headline)] text-lg font-extrabold text-on-primary shadow-2xl transition-all active:scale-95"
              to="/writing/trial-checkout"
            >
              体験レッスンを申し込む
            </Link>
            <div className="flex items-center gap-2 font-[family-name:var(--font-label)] text-[10px] uppercase tracking-widest text-on-surface/40">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Stripeによる安全な決済 • 即時に担当講師を割り当て
            </div>
          </div>
        </div>
      </section>

      <section className="hidden bg-surface px-8 pt-24 pb-10 text-center md:block">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="space-y-4">
            <h2 className="font-[family-name:var(--font-headline)] text-5xl font-extrabold tracking-tight text-primary">
              学びの美学を、その手元に。
            </h2>
            <p className="text-lg text-on-surface/60">
              「良い文章」と「卓越した文章」の違いは、たった一度の正確な添削から始まります。
            </p>
          </div>
          <div className="flex flex-col items-center gap-6">
            <Link
              className="rounded-xl bg-primary px-12 py-6 font-[family-name:var(--font-headline)] text-xl font-extrabold text-on-primary shadow-2xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
              to="/writing/trial-checkout"
            >
              1,800円で開始する
            </Link>
            <div className="flex items-center gap-2 font-[family-name:var(--font-label)] text-xs uppercase tracking-widest text-on-surface/40">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              Stripeによる安全な決済 • 即時に担当講師を割り当て
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
