function CircularChart({ className = 'w-40 h-40' }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg className={`circular-chart ${className}`} viewBox="0 0 36 36" aria-hidden>
        <path
          className="circle-bg"
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          className="circle text-[#1b6d24]"
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
    <section className="py-20 md:py-24 bg-[#ECECEC] px-6 md:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Mobile layout */}
        <div className="lg:hidden">
          <div className="text-center mb-12">
            <h2 className="headline-font text-3xl font-extrabold text-[#000666] mb-4 tracking-tight">
              学びの軌跡を可視化する
            </h2>
            <p className="text-[#454652] text-sm leading-relaxed">あなたの成長は「インクの線」となって刻まれます。</p>
          </div>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-5 rounded-[2rem] border border-[#c6c5d4]/5 shadow-[0_20px_50px_rgba(0,0,0,0.04)] text-center">
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#1e1b13]/40 mb-1">累積執筆文字数</div>
                <div className="text-xl font-extrabold text-[#000666]">12,450 자</div>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-[#c6c5d4]/5 shadow-[0_20px_50px_rgba(0,0,0,0.04)] text-center">
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#1e1b13]/40 mb-1">向上率</div>
                <div className="text-xl font-extrabold text-[#1b6d24]">+42%</div>
              </div>
            </div>
            <div className="bg-white rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.08)] p-8 border border-[#c6c5d4]/5">
              <div className="flex justify-between items-center mb-8">
                <h4 className="font-bold text-[#000666] headline-font">Student Dashboard</h4>
                <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                  <span className="material-symbols-outlined text-black/20 text-sm">person</span>
                </div>
              </div>
              <div className="mb-8">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-[9px] font-bold uppercase opacity-40">OVERVIEW</span>
                  <span className="text-2xl font-extrabold text-[#1b6d24]">30%</span>
                </div>
                <div className="w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <div className="w-[30%] h-full bg-[#1b6d24]" />
                </div>
              </div>
              <div className="bg-black/[0.02] p-4 rounded-xl mb-4">
                <span className="text-[8px] font-bold uppercase opacity-30 block mb-1">RECENT TASK</span>
                <p className="font-bold text-sm text-[#000666]">韓国の食文化について</p>
                <span className="text-[8px] font-bold text-[#1b6d24] bg-[#1b6d24]/10 px-2 py-0.5 rounded-md uppercase mt-2 inline-block">
                  添削完了
                </span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2rem] border border-[#c6c5d4]/5 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-6 text-center">添削率の推移</div>
              <div className="relative flex items-center justify-center mb-8">
                <CircularChart className="w-32 h-32" />
              </div>
              <div className="space-y-4">
                <h5 className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-3">よく間違える文法</h5>
                <div className="flex flex-wrap gap-2">
                  {['助詞の使い分け', '時制の一致', '接続詞の選択'].map((t) => (
                    <span key={t} className="bg-[#000666]/5 text-[#000666] text-[10px] px-2.5 py-1.5 rounded-md font-bold">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop layout */}
        <div className="hidden lg:flex flex-col lg:flex-row items-start gap-16">
          <div className="lg:w-1/3">
            <h2 className="headline-font text-4xl font-extrabold text-[#000666] mb-8 tracking-tight">学びの軌跡を可視化する</h2>
            <p className="text-[#454652] text-lg leading-relaxed mb-10">
              あなたの成長は「インクの線」となって刻まれます。ダッシュボードでは、提出状況、添削履歴、習得した語彙の統計を一目で確認できます。
            </p>
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white/50 p-6 rounded-xl border border-[#c6c5d4]/10">
                <div className="flex items-center gap-3 mb-2 text-[#1b6d24]">
                  <span className="material-symbols-outlined">history_edu</span>
                  <div className="text-xs font-bold uppercase tracking-widest text-[#1e1b13]/60">累積執筆文字数</div>
                </div>
                <div className="text-2xl font-extrabold text-[#000666] headline-font">12,450 자</div>
              </div>
              <div className="bg-white/50 p-6 rounded-xl border border-[#c6c5d4]/10">
                <div className="flex items-center gap-3 mb-2 text-[#1b6d24]">
                  <span className="material-symbols-outlined">trending_up</span>
                  <div className="text-xs font-bold uppercase tracking-widest text-[#1e1b13]/60">向上率</div>
                </div>
                <div className="text-2xl font-extrabold text-[#000666] headline-font">+42%</div>
              </div>
            </div>
          </div>
          <div className="lg:w-2/3 grid md:grid-cols-2 gap-8 w-full">
            <div className="bg-white rounded-[2rem] shadow-[0_40px_100px_rgba(0,0,0,0.08)] p-10 border border-[#c6c5d4]/5 relative z-10 flex flex-col">
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
                  <span className="text-3xl font-extrabold text-[#1b6d24] headline-font">30%</span>
                </div>
                <div className="w-full h-2 bg-[#eeeeee] rounded-full overflow-hidden">
                  <div className="w-[30%] h-full bg-[#1b6d24]" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-[#eeeeee]/50 p-6 rounded-xl border border-[#c6c5d4]/5">
                  <span className="text-[10px] font-bold uppercase opacity-40 block mb-3 tracking-widest">RECENT TASK</span>
                  <p className="font-bold text-base mb-4 text-[#000666]">韓国の食文化について</p>
                  <span className="text-[10px] font-bold text-[#1b6d24] bg-[#1b6d24]/10 px-3 py-1.5 rounded-lg uppercase tracking-widest">
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
              <div className="bg-white p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-[#c6c5d4]/5">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-60 mb-6 text-center">添削率の推移</div>
                <div className="relative flex items-center justify-center">
                  <CircularChart />
                </div>
              </div>
              <div className="bg-white p-8 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-[#c6c5d4]/5 space-y-6">
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
