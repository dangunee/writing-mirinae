export default function LandingCurriculum() {
  return (
    <section id="curriculum" className="py-20 md:py-24 bg-[#eeeeee] px-6 md:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 md:mb-16 gap-4">
          <div>
            <h2 className="headline-font text-3xl md:text-4xl font-extrabold text-[#000666] mb-2 md:mb-4 tracking-tight">
              8段階構成のカリキュラム
            </h2>
            <p className="text-[#454652] text-sm md:text-base">
              基礎から芸術的な表現まで、80回のセッションで完成させる。
            </p>
          </div>
          <div className="text-right">
            <span className="font-['Manrope'] text-2xl md:text-4xl font-light text-[#000666]/20">01 / 08</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          <div className="md:col-span-2 md:row-span-2 bg-[#1a237e] p-8 md:p-10 rounded-xl flex flex-col justify-between text-white group hover:bg-[#000666] transition-all duration-500 shadow-xl">
            <div>
              <span className="bg-white/15 text-white text-[9px] md:text-[10px] px-2 md:px-3 py-0.5 md:py-1 rounded-full font-bold uppercase tracking-widest mb-4 md:mb-6 inline-block">
                Flagship Course
              </span>
              <h3 className="text-2xl md:text-3xl font-extrabold headline-font mb-3 md:mb-4">Advanced Korean Composition</h3>
              <p className="opacity-70 leading-relaxed text-sm md:text-base">
                最上級の韓国語表現を磨く、当校の象徴的なコース。論理的思考と情緒豊かな表現の両立を目指します。
              </p>
            </div>
            <div className="flex justify-between items-end mt-8 md:mt-12">
              <div className="text-5xl font-extrabold opacity-20">04</div>
              <span className="material-symbols-outlined text-4xl group-hover:translate-x-2 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-xl border border-[#c6c5d4]/10 shadow-sm hover:shadow-md transition-all">
            <h4 className="font-bold headline-font text-lg md:text-xl mb-2">Basic Syntax</h4>
            <p className="text-sm text-[#454652]">正確な文章構成の基礎</p>
            <div className="mt-6 md:mt-8 text-[#000666] font-bold text-xs tracking-widest uppercase">Term 01</div>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-xl border border-[#c6c5d4]/10 shadow-sm hover:shadow-md transition-all">
            <h4 className="font-bold headline-font text-lg md:text-xl mb-2">Daily Narratives</h4>
            <p className="text-sm text-[#454652]">日常を綴る感性の育成</p>
            <div className="mt-6 md:mt-8 text-[#000666] font-bold text-xs tracking-widest uppercase">Term 02</div>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-xl border border-[#c6c5d4]/10 shadow-sm hover:shadow-md transition-all">
            <h4 className="font-bold headline-font text-lg md:text-xl mb-2">Social Discourse</h4>
            <p className="text-sm text-[#454652]">論理的な意見表明</p>
            <div className="mt-6 md:mt-8 text-[#000666] font-bold text-xs tracking-widest uppercase">Term 03</div>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-xl border border-[#c6c5d4]/10 shadow-sm hover:shadow-md transition-all">
            <h4 className="font-bold headline-font text-lg md:text-xl mb-2">Literary Arts</h4>
            <p className="text-sm text-[#454652]">文学的なニュアンス</p>
            <div className="mt-6 md:mt-8 text-[#000666] font-bold text-xs tracking-widest uppercase">Term 05-08</div>
          </div>
        </div>
      </div>
    </section>
  )
}
