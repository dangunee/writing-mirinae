import { Link } from 'react-router-dom'

const TRIAL_APPLY_PATH = '/writing/trial-payment'
const COURSE_DETAIL_HREF = '#learning-system'

function heroNoteImageSrc(): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}writing/images/writing-hero-note.svg`
}

export default function LandingHero() {
  const noteSrc = heroNoteImageSrc()

  return (
    <section className="pt-28 md:pt-32 pb-12 md:pb-16 px-6 md:px-8 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(0,6,102,0.22)]">
        {/* Right visual + depth */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <img
            src={noteSrc}
            alt=""
            className="absolute -right-4 bottom-0 h-[min(52%,220px)] w-auto max-w-[85%] object-contain object-right opacity-[0.22] sm:h-[min(48%,260px)] sm:opacity-25 md:right-0 md:top-1/2 md:h-[min(92%,480px)] md:max-w-[58%] md:-translate-y-1/2 md:opacity-[0.38] lg:opacity-45"
            width={480}
            height={520}
            loading="eager"
            decoding="async"
          />
          <div
            className="absolute inset-0 bg-gradient-to-br from-[#0f766e]/95 via-[#0c4a6e]/92 to-[#000666]/96 md:bg-gradient-to-r md:from-[#0f766e]/97 md:via-[#0a3558]/88 md:to-[#000666]/75"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#000666]/55 via-transparent to-[#0f766e]/25 md:bg-gradient-to-l md:from-transparent md:via-transparent md:to-[#022c22]/50"
            aria-hidden
          />
        </div>

        <div className="relative z-10 flex flex-col lg:min-h-[min(100vh-12rem,520px)] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-10">
          <div className="order-1 px-6 pb-8 pt-10 sm:px-8 sm:pb-10 sm:pt-12 md:px-10 md:pb-12 md:pt-14 lg:pr-4 lg:pl-12">
            <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/35 bg-white/10 px-3 py-1.5 font-['Manrope'] text-[10px] font-bold uppercase tracking-[0.12em] text-white/95 sm:text-[11px]">
              メール添削コース ・ 10週間
            </span>

            <h1 className="headline-font mt-5 text-3xl font-extrabold leading-[1.2] tracking-tight text-white sm:mt-6 sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.15] xl:text-[3.5rem]">
              書くたびに、
              <br />
              韓国語が
              <span className="text-[#a7f3d0]">自分のもの</span>
              になる。
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
              <a
                href={COURSE_DETAIL_HREF}
                className="landing-hero-cta-secondary inline-flex items-center justify-center rounded-xl border-2 border-white/70 bg-white/5 px-6 py-3.5 text-center font-['Manrope'] text-sm font-bold tracking-wide text-white backdrop-blur-[2px] transition hover:bg-white/15 sm:min-w-[12rem] sm:px-8 sm:py-4"
              >
                講座詳細を見る
              </a>
            </div>
          </div>

          {/* Desktop: reserves space so text column does not overlap the visual */}
          <div className="order-3 hidden min-h-[200px] lg:order-2 lg:block" aria-hidden />
        </div>

        {/* Info strip */}
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
