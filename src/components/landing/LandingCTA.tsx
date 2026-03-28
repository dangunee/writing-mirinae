import type { FormEvent } from 'react'

type Props = {
  goApp: () => void
}

export default function LandingCTA({ goApp }: Props) {
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    goApp()
  }

  return (
    <section id="cta-apply" className="py-20 md:py-24 bg-[#000666] text-white">
      <div className="max-w-4xl mx-auto px-6 md:px-8 text-center">
        <h2 className="headline-font text-3xl md:text-4xl lg:text-5xl font-extrabold mb-6 md:mb-8 tracking-tight">
          アトリエであなたの旅を始めましょう
        </h2>
        <p className="opacity-70 text-sm md:text-lg mb-10 md:mb-12 leading-relaxed">
          扉はいつでも開かれています。あなたの言葉が、あなただけの筆跡で、韓国語の海へと漕ぎ出すために。
        </p>
        <form
          onSubmit={onSubmit}
          className="bg-white/5 p-6 md:p-8 rounded-2xl backdrop-blur-sm border border-white/10 text-left"
        >
          <div className="grid md:grid-cols-2 gap-6 mb-6 md:mb-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">氏名</label>
              <input
                name="dummy-name"
                autoComplete="name"
                className="w-full bg-white/10 border-transparent rounded-lg p-4 focus:ring-2 focus:ring-[#1b6d24] focus:border-[#1b6d24] transition-all placeholder:text-white/20 text-white"
                placeholder="姓名"
                type="text"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-60">メールアドレス</label>
              <input
                name="dummy-email"
                autoComplete="email"
                className="w-full bg-white/10 border-transparent rounded-lg p-4 focus:ring-2 focus:ring-[#1b6d24] focus:border-[#1b6d24] transition-all placeholder:text-white/20 text-white"
                placeholder="example@mirinae.jp"
                type="email"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-[#1b6d24] text-white py-5 rounded-lg font-['Manrope'] font-bold tracking-widest uppercase hover:bg-[#1b6d24]/90 transition-all text-xs md:text-sm"
          >
            受講を申し込む
          </button>
        </form>
      </div>
    </section>
  )
}
