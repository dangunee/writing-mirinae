export default function LandingTestimonials() {
  const items = [
    {
      quote:
        '「TOPIK 6級に合格したものの、自分の言葉で文章を書くことに自信が持てませんでした。ここでの添削は、ただの間違い直しではなく、より洗練された表現への『昇華』でした。」',
      tag: 'TOPIK 6급 합격',
      name: 'K. Tanaka (会社員)',
      avatar: 'bg-[#000666]/10',
    },
    {
      quote:
        '「個人に合わせた個別指導が魅力です。私の癖をすぐに見抜き、どう直せば韓国人らしい自然なリズムになるかを丁寧に教えていただきました。感謝しています。」',
      tag: '개인 맞춤형 지도',
      name: 'S. Yamamoto (大学生)',
      avatar: 'bg-[#1b6d24]/10',
    },
    {
      quote:
        '「ただ文法を学ぶのではなく、背景にある思考回路まで学べる稀有な場所です。書くことがこれほどまでに深い対話だとは思いませんでした。」',
      tag: '思考の深まり',
      name: 'M. Sato (翻訳者)',
      avatar: 'bg-[#1a237e]/10',
    },
  ]

  return (
    <section id="reviews" className="py-20 md:py-24 px-6 md:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-12 md:mb-16">
        <h2 className="headline-font text-3xl md:text-4xl font-extrabold text-[#000666] mb-3 md:mb-4 tracking-tight">
          受講生の声
        </h2>
        <p className="text-[#454652] text-sm md:text-base hidden md:block">
          筆を執ることで人生が変わった、ある学徒たちの記録。
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {items.map((item, i) => (
          <div
            key={item.name}
            className={`bg-white p-8 md:p-10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-[#c6c5d4]/10 relative flex flex-col justify-between h-full ${
              i === 2 ? 'hidden lg:flex' : ''
            }`}
          >
            <div>
              <span className="material-symbols-outlined text-[#000666]/20 text-4xl mb-6">format_quote</span>
              <p className="text-[#1e1b13] italic mb-6 md:mb-8 leading-relaxed text-sm md:text-base">{item.quote}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full ${item.avatar}`} />
              <div>
                <div className="font-bold text-sm">{item.tag}</div>
                <div className="text-[10px] opacity-50">{item.name}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
