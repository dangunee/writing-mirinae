import { useState } from 'react'

export default function AtelierCurriculumMobile() {
  const [lesson01Expanded, setLesson01Expanded] = useState(true)
  const [showAllLessons, setShowAllLessons] = useState(false)

  const toggleLesson01 = () => {
    setLesson01Expanded((v) => !v)
  }

  return (
    <section className="bg-background pt-4 md:hidden">
      <div className="px-6">
        <h3 className="font-[family-name:var(--font-headline)] mb-4 text-3xl font-bold tracking-tight">カリキュラム</h3>
        <p className="mb-6 text-sm leading-relaxed text-on-surface/60">
          言語的習熟に向けた全8期のジャーニー。各期は10の集中的なレッスンで構成され、あなたの表現力と独自の文体を磨き上げます。
        </p>
        <div className="flex gap-4">
          <span className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-primary/10">全8期</span>
          <span className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-primary/10">80レッスン</span>
        </div>
      </div>

      <div className="mt-8 flex gap-3 overflow-x-auto px-6 hide-scrollbar">
        <div className="flex-none rounded-xl bg-primary px-8 py-4 font-[family-name:var(--font-headline)] text-sm font-bold whitespace-nowrap text-on-primary shadow-lg">
          第1期
        </div>
        <div className="flex-none flex items-center gap-2 rounded-xl border border-outline-variant/10 bg-white px-6 py-4 font-[family-name:var(--font-headline)] text-sm font-bold whitespace-nowrap text-on-surface/30 opacity-60">
          第2期 <span className="material-symbols-outlined text-xs">lock</span>
        </div>
        <div className="flex-none flex items-center gap-2 rounded-xl border border-outline-variant/10 bg-white px-6 py-4 font-[family-name:var(--font-headline)] text-sm font-bold whitespace-nowrap text-on-surface/30 opacity-60">
          第3期 <span className="material-symbols-outlined text-xs">lock</span>
        </div>
        <div className="flex-none flex items-center gap-2 rounded-xl border border-outline-variant/10 bg-white px-6 py-4 font-[family-name:var(--font-headline)] text-sm font-bold whitespace-nowrap text-on-surface/30 opacity-60">
          第4期 <span className="material-symbols-outlined text-xs">lock</span>
        </div>
        <div className="flex-none flex items-center gap-2 rounded-xl border border-outline-variant/10 bg-white px-6 py-4 font-[family-name:var(--font-headline)] text-sm font-bold whitespace-nowrap text-on-surface/30 opacity-60">
          第5-8期 <span className="material-symbols-outlined text-xs">lock</span>
        </div>
      </div>

      <div className="px-6">
        <div className="mb-4 mt-8">
          <h4 className="font-[family-name:var(--font-headline)] mb-2 text-2xl font-extrabold text-primary">第1期：基礎と自己表現</h4>
          <p className="font-[family-name:var(--font-body)] text-sm text-on-surface/60">自然な韓国語の基礎を、身近なテーマを通じて学びます。</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="group">
            <button
              type="button"
              className="flex aspect-[3/1] w-full cursor-pointer flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm transition-colors hover:bg-surface-container-low"
              onClick={toggleLesson01}
            >
              <span className="flex items-center justify-between text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
                LESSON 01
                <span
                  className={`material-symbols-outlined text-lg transition-transform ${lesson01Expanded ? 'rotate-180' : ''}`}
                >
                  expand_more
                </span>
              </span>
              <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">自己紹介を究める</h5>
            </button>
            <div
              className={`accordion-content mt-1 rounded-2xl border border-outline-variant/5 bg-white/50 ${lesson01Expanded ? 'expanded' : ''}`}
              id="lesson-01"
            >
              <div className="space-y-6 p-6">
                <div className="space-y-2">
                  <label className="font-[family-name:var(--font-label)] text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40">
                    THEME
                  </label>
                  <h6 className="font-[family-name:var(--font-headline)] text-xl font-bold text-primary">自己紹介を究める</h6>
                  <div className="rounded-xl border border-outline-variant/10 bg-surface-container-highest/30 p-4">
                    <p className="text-sm leading-relaxed text-on-surface/80">
                      単なる名前や職業の羅列ではなく、あなたの「価値観」や「情熱」가 伝わる自己紹介を作成しましょう。なぜ韓国語を学んでいるのか、どのような瞬間に喜びを感じるのか。読み手の心に残る、あなただけの物語を綴ります。
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="font-[family-name:var(--font-label)] text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40">
                    REQUIREMENTS
                  </label>
                  <div className="grid gap-3">
                    <div className="flex gap-4 rounded-xl border border-outline-variant/10 bg-white p-4">
                      <span className="shrink-0 font-[family-name:var(--font-headline)] text-xl font-bold text-primary/20">01</span>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-primary">-기로 약속하다</p>
                        <p className="text-[11px] text-on-surface/60">韓国の友人と毎日日記を書くことにしました</p>
                      </div>
                    </div>
                    <div className="flex gap-4 rounded-xl border border-outline-variant/10 bg-white p-4">
                      <span className="shrink-0 font-[family-name:var(--font-headline)] text-xl font-bold text-primary/20">02</span>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-primary">-ㄹ/을 통해</p>
                        <p className="text-[11px] text-on-surface/60">音楽を通じて韓国の芸術をより深く理解するようになりました</p>
                      </div>
                    </div>
                    <div className="flex gap-4 rounded-xl border border-outline-variant/10 bg-white p-4">
                      <span className="shrink-0 font-[family-name:var(--font-headline)] text-xl font-bold text-primary/20">03</span>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-primary">-기 위해서</p>
                        <p className="text-[11px] text-on-surface/60">自分の夢を叶えるために毎日努力しています</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm">
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 02
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">週末の予定を生き生きと</h5>
          </div>
          <div className="flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm">
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 03
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">私の好きな風景と理由</h5>
          </div>
          <div className="flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm">
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 04
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">感謝の手紙をしたためる</h5>
          </div>
          <div className="flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm">
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 05
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">韓国料理の魅力を伝える</h5>
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 py-4 font-[family-name:var(--font-headline)] text-sm font-bold text-primary transition-colors hover:bg-primary/5"
            onClick={() => setShowAllLessons((v) => !v)}
          >
            {showAllLessons ? '閉じる' : 'すべて表示'}{' '}
            <span className={`material-symbols-outlined text-lg transition-transform ${showAllLessons ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>

          <div className={`flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm ${showAllLessons ? '' : 'hidden'}`}>
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 06
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">旅の思い出を情緒豊かに</h5>
          </div>
          <div className={`flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm ${showAllLessons ? '' : 'hidden'}`}>
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 07
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">夢と将来の展望を語る</h5>
          </div>
          <div className={`flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm ${showAllLessons ? '' : 'hidden'}`}>
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 08
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">最近の関心事を深く掘り下げる</h5>
          </div>
          <div className={`flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm ${showAllLessons ? '' : 'hidden'}`}>
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 09
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">他薦：大切な人を紹介する</h5>
          </div>
          <div className={`flex aspect-[3/1] flex-col justify-between rounded-2xl border border-outline-variant/10 bg-white p-6 shadow-sm ${showAllLessons ? '' : 'hidden'}`}>
            <span className="text-[10px] font-[family-name:var(--font-label)] font-bold uppercase tracking-widest text-primary/40">
              LESSON 10
            </span>
            <h5 className="font-[family-name:var(--font-headline)] text-lg font-bold text-primary">第1期の総まとめ作文</h5>
          </div>
        </div>

        <div className="pt-10 text-center">
          <p className="font-[family-name:var(--font-label)] mb-4 text-[10px] uppercase tracking-widest text-on-surface/40">
            体験レッスン修了後に全てのカリキュラムへのアクセスが解放されます
          </p>
          <div className="flex justify-center gap-2">
            <div className="h-1 w-12 rounded-full bg-primary" />
            <div className="h-1 w-1 rounded-full bg-outline-variant/30" />
            <div className="h-1 w-1 rounded-full bg-outline-variant/30" />
            <div className="h-1 w-1 rounded-full bg-outline-variant/30" />
          </div>
        </div>
      </div>
    </section>
  )
}
