import { Link } from 'react-router-dom'

const HERO_FALLBACK =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDSPB8kESuXgxSqxjzgcP2yiBmNzrj_OrHsKJ7T28RmRzN4Cgap9LM_ZfB1-JMSj_OZDndIPDOYWkJkLp1kGGyuH7r9nQtJ9v4DZbteHf46Rai4S-babLp9ho2-x_ei2kjLTRQdkVPFbXclZsmbzDc6w1_jDuPQ0HLuWqywOEhzm_aAtBBEW2d6exLxjor1U-aahJZiArqSNfe5gkbleXtruuKgLDeQJ5i4npEM2o1ALwEOpqgPYx4vLUgY_blLiSIM5tusDBdeP4M'

function heroImageSrc(): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}writing/images/hero-study.jpg`
}

export default function LandingHero() {
  const src = heroImageSrc()

  return (
    <section className="pt-28 md:pt-32 pb-16 md:pb-20 px-6 md:px-8 max-w-7xl mx-auto overflow-hidden">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="z-10">
          <span className="font-['Manrope'] text-[10px] md:text-xs tracking-[0.2em] uppercase text-[#000666] mb-4 md:mb-6 block font-bold">
            The Modern Calligrapher&apos;s Method
          </span>
          <h1 className="headline-font text-4xl md:text-5xl lg:text-7xl font-extrabold text-[#000666] leading-[1.1] md:leading-[1.1] tracking-tight mb-6 md:mb-8">
            書くたびに、
            <br />
            韓国語<span className="text-[#000666]">が</span> <br />
            自身のものになる。
          </h1>
          <p className="text-base md:text-lg text-[#454652] max-w-md mb-8 md:mb-10 leading-relaxed">
            単なる学習を超え、魂を込めて綴る。韓国語の深淵に触れる、日本で唯一のライティング専門アトリエ。
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/writing/intro"
              className="ink-gradient inline-flex items-center justify-center rounded-lg px-8 py-4 font-['Manrope'] text-xs font-bold uppercase tracking-widest text-white shadow-[0_12px_30px_rgba(0,6,102,0.24)] transition-all hover:opacity-90 md:px-10 md:py-5 md:text-sm"
            >
              Trial Class
            </Link>

            <a
              href="https://mirinae.jp"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center border-b-2 border-[#000666]/20 text-[#000666] px-8 md:px-10 py-4 md:py-5 font-['Manrope'] font-bold tracking-widest uppercase text-xs md:text-sm hover:border-[#000666] transition-all"
            >
              Course Details
            </a>
          </div>
        </div>

        <div className="relative mt-4 lg:mt-0">
          <div className="absolute -top-8 md:-top-10 -right-6 md:-right-10 w-40 h-40 md:w-64 md:h-64 bg-[#000666]/15 rounded-full blur-3xl -z-10" />

          <div className="rounded-xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.12)] rotate-[1deg]">
            <img
              alt="Study space"
              className="w-full h-[240px] md:h-[520px] object-cover"
              src={src}
              width={1200}
              height={520}
              onError={(e) => {
                const el = e.currentTarget
                if (el.src !== HERO_FALLBACK) el.src = HERO_FALLBACK
              }}
            />
          </div>

          <div className="absolute -bottom-4 md:-bottom-6 left-4 md:-left-6 bg-white px-4 py-3 md:p-6 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.1)] border border-[#c6c5d4]/15 max-w-[180px] md:max-w-[240px]">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#000666]" />
              <span className="text-[9px] md:text-[10px] font-bold tracking-widest uppercase opacity-60">Status</span>
            </div>
            <p className="text-[11px] md:text-sm font-bold leading-tight italic text-[#1e1b13]">
              &quot;言葉は、その人の品格を映し出す鏡である。&quot;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
