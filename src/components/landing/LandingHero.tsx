import { Link } from 'react-router-dom'

const TRIAL_APPLY_PATH = '/writing/trial-payment'
const COURSE_INTRO_PATH = '/writing/intro'

function withBaseUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}${path.replace(/^\//, '')}`
}

function heroRightBackgroundSrc(): string {
  return withBaseUrl('writing/images/writing-hero-note.jpg')
}

export default function LandingHero() {
  const rightBgSrc = heroRightBackgroundSrc()

  return (
    <section className="pt-28 md:pt-32 pb-12 md:pb-16 px-6 md:px-8 max-w-7xl mx-auto">
      <div className="relative flex min-h-[min(100vh-12rem,520px)] flex-col overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(0,6,102,0.22)]">
        {/* Full-card teal / navy base */}
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-br from-[#0f766e] via-[#0c4a6e] to-[#000666]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-[#000666]/45 via-transparent to-[#0f766e]/20"
          aria-hidden
        />

        {/* Right half: full-height background image (desktop only) */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden w-[46%] overflow-hidden rounded-r-[28px] lg:block xl:w-[48%]"
          aria-hidden
        >
          <img
            src={rightBgSrc}
            alt=""
            className="h-full w-full object-cover object-center"
            width={1200}
            height={900}
            loading="eager"
            decoding="async"
          />
          {/* Blend image left edge into hero background */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#0f766e]/95 from-[8%] via-[#0a6f86]/72 via-[42%] to-transparent to-[100%]"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#000666]/35 via-transparent to-transparent"
            aria-hidden
          />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center px-6 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-12 md:px-10 md:pb-12 md:pt-14 lg:max-w-[54%] lg:pr-6 lg:pl-12">
          <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/35 bg-white/10 px-3 py-1.5 font-['Manrope'] text-[10px] font-bold uppercase tracking-[0.12em] text-white/95 sm:text-[11px]">
            メール添削コース ・ 10週間
          </span>

          <h1 className="headline-font mt-5 min-w-0 text-3xl font-extrabold leading-[1.2] tracking-tight text-white sm:mt-6 sm:text-4xl md:text-[clamp(1.65rem,3.2vw+1rem,3.25rem)] md:leading-[1.15] lg:text-[clamp(1.85rem,2.8vw+1.1rem,3.35rem)]">
            <span className="block">書くたびに、</span>
            <span className="mt-0.5 inline-block max-w-full overflow-x-auto whitespace-nowrap pb-1 sm:mt-1">
              韓国語が<span className="text-[#a7f3d0]">自分のもの</span>になる。
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/90 sm:text-base md:mt-6">
            300〜500字作文＋添削＋ネイティブ比較文＋模範文まで届く。
            <br className="hidden sm:block" />
            週1回のペースで、表現力を着実に積み上げます。
          </p>
          <p className="mt-3 text-xs font-semibold text-white/75 sm:text-sm">毎週テーマで作文チャレンジ。</p>

          <div className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center md:mt-10">
            <Link
              to={TRIAL_APPLY_PATH}
              className="landing-hero-cta-primary inline-flex items-center justify-center rounded-xl bg-white px-6 py-3.5 text-center font-['Manrope'] text-sm font-bold tracking-wide text-[#000666] shadow-md transition hover:bg-white/95 sm:min-w-[12rem] sm:px-8 sm:py-4"
            >
              体験申込（1,800円）
            </Link>
            <Link
              to={COURSE_INTRO_PATH}
              className="landing-hero-cta-secondary inline-flex items-center justify-center rounded-xl border-2 border-white/70 bg-white/5 px-6 py-3.5 text-center font-['Manrope'] text-sm font-bold tracking-wide text-white backdrop-blur-[2px] transition hover:bg-white/15 sm:min-w-[12rem] sm:px-8 sm:py-4"
            >
              講座詳細を見る
            </Link>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/15 bg-black/10 px-4 py-5 backdrop-blur-[2px] sm:px-6 md:px-10 lg:px-12">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[
              { label: '開講日', value: '7月4日（金）' },
              { label: '期間', value: '10週間' },
              { label: '募集期限', value: '〜7月2日（水）' },
              { label: '授業料', value: '23,980円（税込）' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 sm:px-4 sm:py-3.5"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70 sm:text-[11px]">
                  {item.label}
                </p>
                <p className="mt-1 font-['Manrope'] text-sm font-bold leading-snug text-white sm:text-base">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
