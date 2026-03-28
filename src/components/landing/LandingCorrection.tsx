import { smallInfoCard } from './landingCardClasses'

type Props = {
  goApp: () => void
}

export default function LandingCorrection({ goApp }: Props) {
  return (
    <section className="py-24 bg-[#ECECEC] px-6 md:px-8 border-y border-[#c6c5d4]/10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14 md:mb-16">
          <span className="font-['Manrope'] text-[10px] md:text-xs tracking-[0.2em] uppercase text-[#1b6d24] mb-3 md:mb-4 block font-bold">
            Feedback System
          </span>
          <h2 className="headline-font text-3xl md:text-4xl font-extrabold text-[#000666] tracking-tight">
            プロによる丁寧な添削指導
          </h2>
          <p className="text-[#454652] mt-3 md:mt-4 text-sm md:text-base">
            単なる誤字脱字の修正に留まらない、表現の深化を目指すフィードバック。
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 md:gap-12">
          <div className="lg:col-span-2">
            <div className="bg-white p-6 md:p-12 rounded-[2rem] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-[#c6c5d4]/10 relative">
              <div className="flex items-center justify-between mb-6 md:mb-8 pb-3 md:pb-4 border-b border-[#c6c5d4]/20">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#000666]">edit_note</span>
                  <h3 className="font-bold headline-font text-base md:text-lg text-[#000666]">実際の添削例</h3>
                </div>
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-40 hidden sm:inline">
                  Topic: Lifestyle &amp; Culture
                </span>
              </div>
              <div className="space-y-4 md:space-y-6 leading-relaxed text-base md:text-lg text-[#1e1b13]/80">
                <p>
                  나는 어렸을 때부터 옷을 좋아해서 어머니와 함께 쇼핑을 가서 옷을 고르는 것이 즐거움이었다. 중학생{' '}
                  <span className="correction-red">까지는</span> <span className="correction-blue">중학생때까지는</span>{' '}
                  항상 어머니가 고른 옷을 <span className="correction-red">고르신 옷을</span> 입고 있었다.{' '}
                  <span className="correction-red">입었다.</span> 고등학생 때는 옷은 친구와 함께 사러 가게되었다.{' '}
                  <span className="correction-blue">가게 되었다.</span>
                </p>
                <p className="hidden lg:block">
                  당시 마추다 세이고 씨가 <span className="correction-red">마쓰다 세이코 씨가</span> 인기가 있어서 그녀를 흉내내서
                  예쁜 옷을 고르고 입고 있었다. <span className="correction-red">골라서 입었다.</span> 이십 대는
                  &quot;보디콘&quot; 으로 불리는 몸의 선이 나온 옷이{' '}
                  <span className="correction-blue">몸의 선이 드러나는 옷이</span> 인기가 있었고 나도 좋아해서 입고 있었다.
                </p>
              </div>
              <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-dashed border-[#c6c5d4]/30">
                <div className="flex items-center gap-4 mb-3 md:mb-4">
                  <span className="bg-[#1b6d24]/10 text-[#1b6d24] text-[9px] md:text-[10px] px-2 md:px-3 py-0.5 md:py-1 rounded-full font-bold uppercase tracking-widest">
                    Polished Version
                  </span>
                </div>
                <p className="text-[#000666] font-medium italic leading-relaxed text-sm md:text-base">
                  &quot;나는 어렸을 때부터 옷을 좋아해서 어머니와 함께 쇼핑하며 옷을 고르는 것이 큰 즐거움이었다. 중학생 때까지는 늘
                  어머니가 골라주신 옷을 입곤 했다...&quot;
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 md:space-y-6">
            <div
              className={`${smallInfoCard} p-5 md:p-6 border-l-4 border-[#000666]`}
            >
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <span className="material-symbols-outlined text-[#000666] text-lg md:text-xl">spellcheck</span>
                <h4 className="font-bold text-[11px] md:text-sm text-[#000666] uppercase tracking-tight">
                  Grammar &amp; Syntax
                </h4>
              </div>
              <p className="text-xs md:text-sm text-[#454652] leading-relaxed">
                「~까지는」を「~때까지는」に修正。期間を明確にすることで、文脈がよりスムーズになります。助詞の微細な使い分けを指導します。
              </p>
            </div>
            <div
              className={`${smallInfoCard} p-5 md:p-6 border-l-4 border-[#1b6d24]`}
            >
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <span className="material-symbols-outlined text-[#1b6d24] text-lg md:text-xl">auto_awesome</span>
                <h4 className="font-bold text-[11px] md:text-sm text-[#1b6d24] uppercase tracking-tight">
                  Natural Expression
                </h4>
              </div>
              <p className="text-xs md:text-sm text-[#454652] leading-relaxed">
                「몸의 선이 나온」を「드러나는」へ。より洗練された、ネイティブらしい情緒的な語彙の選択を提案します。
              </p>
            </div>
            <div
              className={`${smallInfoCard} p-5 md:p-6 border-l-4 border-[#670007]`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[#670007] text-xl">translate</span>
                <h4 className="font-bold text-sm text-[#670007] uppercase tracking-tight">Vocabulary Choice</h4>
              </div>
              <p className="text-sm text-[#454652] leading-relaxed">
                固有名詞（松田聖子）のハングル表記を修正。日本人が間違えやすい外来語表記も徹底的にチェックします。
              </p>
            </div>
            <button
              type="button"
              onClick={goApp}
              className="w-full mt-1 py-4 rounded-lg border-2 border-[#000666] text-[#000666] font-bold text-xs md:text-sm uppercase tracking-widest hover:bg-[#000666] hover:text-white transition-all font-['Manrope']"
            >
              添削システムを詳しく見る
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
