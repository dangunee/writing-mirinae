import { Link } from 'react-router-dom'

const HERO_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCz0vkrvNZpmvpb5pNQiaaghPAVw-cSCxKutjPSa-Te7r5Gut1lfeOrx60L6y9NgmcOjhRlZUzypIRGdYhq7miuXbOuK5aU56KgEfRf5HcFvv-fi3qx8jzhHJ2kSGMWl_Jh6IjxhtjPLD1XIwL7i9tHCWC2LZnPsMPg4cKYbCgYHI8dWICuPLxAt59gw_Moii3DlGt-5XXOjQecD3hFTXXSNnbbOIUV7l2zf1SV9o84T8S2AS6YMIPPdhJ_tfCZPup1vf4wTS66vy4'

export default function AtelierHero() {
  return (
    <>
      {/* Mobile */}
      <section className="overflow-hidden px-6 pb-16 pt-16 md:hidden">
        <div className="relative z-10">
          <label className="font-[family-name:var(--font-label)] mb-4 block text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            専門家による韓国語ライティング添削
          </label>
          <h2 className="font-[family-name:var(--font-headline)] mb-6 text-3xl font-extrabold leading-[1.2] tracking-tight text-primary">
            プロの添削で、あなたの
            <br />
            韓国語を一段上の
            <br />
            <span className="italic">レベルへ。</span>
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-on-surface/70">
            「通じる」表現から「心を動かす」洗練された表現へ。提出いただいた課題に対し、熟練の講師が深層まで掘り下げた緻密な言語的添削を行います。
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-white p-4 shadow-sm">
              <span className="material-symbols-outlined text-xl text-primary">payments</span>
              <span className="text-sm font-bold text-primary">1回レッスン：1,800円</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-white p-4 shadow-sm">
              <span className="material-symbols-outlined text-xl text-primary">edit_note</span>
              <span className="text-sm font-bold text-primary">課題提出あり</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-white p-4 shadow-sm">
              <span className="material-symbols-outlined text-xl text-primary">history_edu</span>
              <span className="text-sm font-bold text-primary">講師による添削</span>
            </div>
          </div>
          <Link
            className="mb-4 mt-4 block w-full rounded-xl bg-primary py-5 text-center font-[family-name:var(--font-headline)] font-bold text-on-primary shadow-xl transition-transform active:scale-95"
            to="/writing/course"
          >
            体験レッスン（1,800円）に申し込む
          </Link>
          <div className="text-center">
            <a
              className="font-[family-name:var(--font-headline)] border-b-2 border-primary/20 pb-1 text-sm font-bold text-primary transition-all hover:border-primary"
              href="#example"
            >
              添削例を見る
            </a>
          </div>
        </div>
        <div className="relative mt-8">
          <img
            alt="伝統的な筆と墨"
            className="aspect-[4/5] w-full rounded-3xl object-cover shadow-2xl"
            src={HERO_IMG}
          />
          <div className="absolute -bottom-6 -left-6 max-w-[240px] rounded-2xl bg-white p-6 shadow-xl">
            <p className="font-[family-name:var(--font-headline)] text-xs font-bold italic leading-relaxed text-primary">
              「3年間の独学よりも、わずか1週間の添削で文章のニュアンスが劇的に改善しました。」
            </p>
            <p className="mt-3 font-[family-name:var(--font-label)] text-[8px] uppercase tracking-widest opacity-50">
              — 上級クラス受講生
            </p>
          </div>
        </div>
      </section>

      {/* Desktop */}
      <header className="mx-auto hidden max-w-7xl px-8 pb-24 pt-40 md:block">
        <div className="grid items-center gap-20 lg:grid-cols-2">
          <div className="space-y-10">
            <div className="space-y-4">
              <span className="font-[family-name:var(--font-label)] text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
                専門家による韓国語ライティング添削
              </span>
              <h1 className="font-[family-name:var(--font-headline)] text-5xl font-extrabold leading-tight tracking-[-0.03em] text-primary md:text-6xl">
                プロの添削で、あなたの
                <br />
                韓国語を一段上の
                <br />
                レベルへ。
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-on-surface/70">
                「通じる」表現から「心を動かす」洗練された表現へ。提出いただいた課題に対し、熟練の講師が深層まで掘り下げた緻密な言語的添削を行います。
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-3 rounded-xl bg-surface-container-low px-5 py-3">
                <span className="material-symbols-outlined text-primary">payments</span>
                <span className="font-[family-name:var(--font-label)] text-sm font-bold text-primary">1回レッスン：1,800円</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-container-low px-5 py-3">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                <span className="font-[family-name:var(--font-label)] text-sm font-bold text-primary">課題提出あり</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-surface-container-low px-5 py-3">
                <span className="material-symbols-outlined text-primary">history_edu</span>
                <span className="font-[family-name:var(--font-label)] text-sm font-bold text-primary">講師による添削</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-6 pt-4 sm:flex-row">
              <Link
                className="w-full rounded-xl bg-primary px-10 py-5 text-center font-[family-name:var(--font-headline)] text-lg font-bold text-on-primary shadow-xl shadow-primary/10 transition-all hover:scale-[1.02] active:scale-100 sm:w-auto"
                to="/writing/course"
              >
                体験レッスン（1,800円）に申し込む
              </Link>
              <a
                className="font-[family-name:var(--font-headline)] border-b-2 border-primary/20 pb-1 font-bold text-primary transition-all hover:border-primary"
                href="#example"
              >
                添削例を見る
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-[2rem] shadow-2xl">
              <img alt="伝統的な筆と墨" className="h-full w-full object-cover" src={HERO_IMG} />
            </div>
            <div className="absolute -bottom-10 -left-10 hidden max-w-xs rounded-2xl bg-surface-container-lowest p-8 shadow-xl md:block">
              <p className="font-[family-name:var(--font-headline)] font-bold italic text-primary">
                「3年間の独学よりも、わずか1週間の添削で文章のニュアンスが劇的に改善しました。」
              </p>
              <p className="mt-4 font-[family-name:var(--font-label)] text-xs uppercase tracking-widest opacity-50">
                — 上級クラス受講生
              </p>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
