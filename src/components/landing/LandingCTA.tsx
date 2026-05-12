import { Link } from 'react-router-dom'

export default function LandingCTA() {
  return (
    <section id="cta-apply" className="py-24 bg-[#000666] text-white">
      <div className="max-w-4xl mx-auto px-6 md:px-8 text-center">
        <h2 className="headline-font text-3xl md:text-5xl font-extrabold mb-6 md:mb-8 tracking-tight">
          アトリエであなたの旅を始めましょう
        </h2>

        <p className="opacity-70 text-sm md:text-lg mb-10 md:mb-12 leading-relaxed">
          扉はいつでも開かれています。あなたの言葉が、あなただけの筆跡で、韓国語の海へと漕ぎ出すために。
        </p>

        <div className="bg-white/5 p-5 md:p-8 rounded-2xl backdrop-blur-sm border border-white/10 text-left">
          <div className="grid md:grid-cols-2 gap-5 md:gap-6 mb-6 md:mb-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-wide opacity-60">氏名</label>
              <input
                name="dummy-name"
                autoComplete="name"
                className="w-full bg-white/10 border-transparent rounded-lg p-4 text-sm text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/40 focus:border-white/30 transition-all"
                placeholder="お名前"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-wide opacity-60">メールアドレス</label>
              <input
                name="dummy-email"
                autoComplete="email"
                className="w-full bg-white/10 border-transparent rounded-lg p-4 text-sm text-white placeholder:text-white/20 focus:ring-2 focus:ring-white/40 focus:border-white/30 transition-all"
                placeholder="メールアドレスを入力"
                type="email"
              />
            </div>
          </div>

          <Link
            to="/writing/course"
            className="w-full inline-flex items-center justify-center bg-[#000666] text-white py-4 md:py-5 rounded-lg font-['Manrope'] font-bold tracking-wide hover:bg-[#000666]/90 transition-all text-xs md:text-sm"
          >
            受講を申し込む
          </Link>
        </div>
      </div>
    </section>
  )
}
