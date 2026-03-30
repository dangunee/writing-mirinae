import { floatingCard, softCard } from './landingCardClasses'

function CircularChart({ className = 'w-40 h-40' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg className={`circular-chart ${className}`} viewBox="0 0 36 36" aria-hidden>
        <path
          className="circle-bg"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className="circle text-[#000666]"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          stroke="currentColor"
          strokeDasharray="15, 100"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl md:text-3xl font-extrabold text-[#000666] headline-font">15%</span>
        <span className="text-[8px] md:text-[9px] font-bold opacity-40">平均添削率</span>
      </div>
    </div>
  )
}

export default function LandingDashboard() {
  return (
    <section className="py-24 bg-[#ECECEC] px-6 md:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-start gap-12 md:gap-16">
          <div className="lg:w-1/3 w-full">
            <h2 className="headline-font text-3xl md:text-4xl font-extrabold text-[#000666] mb-6 md:mb-8 tracking-tight">
              学びの軌跡を可視化する
            </h2>

            <p className="text-[#454652] text-sm md:text-lg leading-relaxed mb-8 md:mb-10">
              あなたの成長は「インクの線」となって刻まれます。ダッシュボードでは、提出状況、添削履歴、習得した語彙の統計を一目で確認できます。
            </p>

            <div className="grid grid-cols-1 gap-4 md:gap-6">
              <div className="bg-white/50 p-5 md:p-6 rounded-xl border border-[#c6c5d4]/10">
                <div className="text-xs font-bold uppercase tracking-widest text-[#1e1b13]/60 mb-2">累積執筆文字数</div>
                <div className="text-2xl font-extrabold text-[#000666] headline-font">12,450 자</div>
              </div>

              <div className="bg-white/50 p-5 md:p-6 rounded-xl border border-[#c6c5d4]/10">
                <div className="text-xs font-bold uppercase tracking-widest text-[#1e1b13]/60 mb-2">向上率</div>
                <div className="text-2xl font-extrabold text-[#000666] headline-font">+42%</div>
              </div>
            </div>
          </div>

          <div className="lg:w-2/3 grid md:grid-cols-2 gap-6 md:gap-8 w-full">
            <div className={`${floatingCard} p-8 md:p-10 relative z-10 flex flex-col`}>
              <div className="flex justify-between items-start mb-10">
                <div>
                  <h4 className="text-xl font-bold text-[#000666] headline-font mb-1">Student Dashboard</h4>
                  <p className="text-[11px] opacity-40 font-bold uppercase tracking-[0.2em]">ID: SCH-2024-882</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-[#d1d1d1]/50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#000666]/30">person</span>
                </div>
              </div>
              <div className="mb-10">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-60">TERM OVERVIEW</span>
                  <span className="text-3xl font-extrabold text-[#000666] headline-font">30%</span>
                </div>
                <div className="w-full h-2 bg-[#eeeeee] rounded-full overflow-hidden">
                  <div className="w-[30%] h-full bg-[#000666]" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-[#eeeeee]/50 p-6 rounded-xl border border-[#c6c5d4]/5">
                  <span className="text-[10px] font-bold uppercase opacity-40 block mb-3 tracking-widest">RECENT TASK</span>
                  <p className="font-bold text-base mb-4 text-[#000666]">韓国の食文化について</p>
                  <span className="text-[10px] font-bold text-[#000666] bg-[#000666]/10 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                    添削完了
                  </span>
                </div>
                <div className="bg-[#eeeeee]/50 p-6 rounded-xl border border-[#c6c5d4]/5">
                  <span className="text-[10px] font-bold uppercase opacity-40 block mb-3 tracking-widest">UPCOMING</span>
                  <p className="font-bold text-base mb-4 text-[#000666]">05: 社会的課題の論考</p>
                  <span className="text-[10px] font-bold text-[#454652] bg-[#d1d1d1] px-3 py-1.5 rounded-lg uppercase tracking-widest">
                    未着手
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className={`${softCard} p-8`}>
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-60 mb-6 text-center">添削率の推移</div>
                <div className="relative flex items-center justify-center">
                  <CircularChart />
                </div>
              </div>

              <div className={`${softCard} p-8 space-y-6`}>
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-60 mb-4">よく間違える文法</h5>
                  <div className="flex flex-wrap gap-2">
                    {['助詞の使い分け', '時制の一致', '謙譲語の形成', '接続詞の選択'].map((t) => (
                      <span key={t} className="bg-[#000666]/5 text-[#000666] text-[11px] px-3 py-1.5 rounded-lg font-bold">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-[#c6c5d4]/10">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-60 mb-4">よく間違える表現</h5>
                  <ul className="space-y-2">
                    {['直訳調の不自然な言い回し', '外来語のハングル表記ミス', '文末表現の不一致'].map((t) => (
                      <li key={t} className="flex items-center gap-2 text-xs font-bold text-[#1e1b13]/80">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#ba1a1a]" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
