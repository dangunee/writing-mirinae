import { Link } from 'react-router-dom'

export default function AtelierCurriculumDesktop() {
  return (
    <section className="mx-auto hidden max-w-7xl px-8 pt-6 pb-20 md:block md:pt-8 md:pb-24">
      <div className="mb-16">
        <h2 className="font-[family-name:var(--font-headline)] mb-4 text-4xl font-bold tracking-tight">カリキュラム</h2>
        <p className="max-w-xl text-on-surface/60">
          言語的習熟に向けた全8期のジャーニー。各期は10の集中的なレッスンで構成され、あなたの表現力と独自の文体を磨き上げます。
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="lg:w-1/4">
          <div className="sticky top-28 max-h-[70vh] space-y-3 overflow-y-auto pr-2">
            <div className="flex cursor-pointer items-center justify-between rounded-2xl border border-primary bg-primary p-6 text-on-primary shadow-lg transition-all hover:scale-[1.02]">
              <span className="font-[family-name:var(--font-headline)] text-lg font-bold">第1期</span>
              <span className="material-symbols-outlined text-sm">arrow_forward_ios</span>
            </div>
            {[2, 3, 4].map((n) => (
              <div
                key={n}
                className="flex cursor-not-allowed select-none items-center justify-between rounded-2xl border border-transparent bg-surface-container-high/50 p-6 opacity-40 grayscale"
              >
                <div className="flex flex-col">
                  <span className="font-[family-name:var(--font-headline)] text-lg font-bold">第{n}期</span>
                  <span className="font-[family-name:var(--font-label)] mt-1 text-[10px] font-bold uppercase tracking-wider">
                    ログイン後に利用可能
                  </span>
                </div>
                <span className="material-symbols-outlined text-sm">lock</span>
              </div>
            ))}
            <div className="flex cursor-not-allowed select-none items-center justify-between rounded-2xl border border-transparent bg-surface-container-high/50 p-6 opacity-40 grayscale">
              <div className="flex flex-col text-sm">
                <span className="font-[family-name:var(--font-headline)] text-lg font-bold">第5-8期</span>
                <span className="font-[family-name:var(--font-label)] mt-1 text-[10px] font-bold uppercase tracking-wider">
                  順次公開予定
                </span>
              </div>
              <span className="material-symbols-outlined text-sm">lock</span>
            </div>
          </div>
        </aside>

        <main className="w-full space-y-10 lg:w-3/4">
          <div className="space-y-2 border-b border-outline-variant/20 pb-6">
            <h3 className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-primary">第1期：基礎と自己表現</h3>
            <p className="font-[family-name:var(--font-body)] text-on-surface/60">自然な韓国語の基礎を、身近なテーマを通じて学びます。</p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <div className="flex aspect-square flex-col justify-between rounded-2xl border-2 border-primary bg-primary-container p-5 shadow-md">
              <span className="font-[family-name:var(--font-label)] text-[10px] font-bold uppercase tracking-widest text-on-primary-container">
                LESSON 01
              </span>
              <h4 className="font-[family-name:var(--font-headline)] leading-snug font-bold text-on-primary-container">
                自己紹介を究める
              </h4>
            </div>
            {[
              ['LESSON 02', '週末の予定を生き生きと'],
              ['LESSON 03', '私の好きな風景'],
              ['LESSON 04', '感謝の手紙'],
              ['LESSON 05', '料理の魅力を伝える'],
              ['LESSON 06', '旅の思い出'],
              ['LESSON 07', '夢と将来の展望'],
              ['LESSON 08', '最近の関心事'],
              ['LESSON 09', '大切な人を紹介する'],
              ['LESSON 10', '第1期の総まとめ'],
            ].map(([num, title]) => (
              <div
                key={num}
                className="group flex aspect-square cursor-pointer flex-col justify-between rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 transition-all hover:border-primary/20 hover:shadow-lg"
              >
                <span className="font-[family-name:var(--font-label)] text-[10px] font-bold uppercase tracking-widest text-primary/40">
                  {num}
                </span>
                <h4 className="font-[family-name:var(--font-headline)] leading-snug font-bold text-primary group-hover:underline">
                  {title}
                </h4>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-outline-variant/30 bg-surface-container-lowest shadow-2xl shadow-primary/5">
            <div className="space-y-8 px-10 pb-6 pt-10 md:space-y-10 md:pb-8">
              <div className="space-y-4">
                <span className="font-[family-name:var(--font-label)] text-[10px] font-bold uppercase tracking-[0.3em] text-primary/40">
                  THEME
                </span>
                <h3 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold text-primary">自己紹介を究める</h3>
                <div className="rounded-2xl border border-primary/5 bg-surface-container-low/50 p-8 leading-relaxed">
                  <p className="text-lg text-on-surface/80">
                    単なる名前や職業の羅列ではなく、あなたの「価値観」や「情熱」が伝わる自己紹介を作成しましょう。なぜ韓国語を学んでいるのか、どのような瞬間に喜びを感じるのか。読み手の心に残る、あなただけの物語を綴ります。
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="font-[family-name:var(--font-headline)] flex items-center gap-2 text-xl font-bold">
                  <span className="material-symbols-outlined text-primary">rule</span>
                  要求事項 (Requirement)
                </h4>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-3 rounded-xl border border-outline-variant/20 bg-background p-6">
                    <span className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-primary/20">01</span>
                    <p className="font-bold text-primary">~기로 약속하다</p>
                    <p className="text-xs italic leading-relaxed text-on-surface/60">
                      한국 친구와 매일 일기를 쓰기로 약속했습니다.
                      <br />
                      (韓国の友人と毎日日記を書くことにしました)
                    </p>
                  </div>
                  <div className="space-y-3 rounded-xl border border-outline-variant/20 bg-background p-6">
                    <span className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-primary/20">02</span>
                    <p className="font-bold text-primary">~을/를 통해</p>
                    <p className="text-xs italic leading-relaxed text-on-surface/60">
                      음악을 통해 한국 문화를 더 깊이 이해하게 되었습니다.
                      <br />
                      (音楽を通じて韓国文化をより深く理解するようになりました)
                    </p>
                  </div>
                  <div className="space-y-3 rounded-xl border border-outline-variant/20 bg-background p-6">
                    <span className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-primary/20">03</span>
                    <p className="font-bold text-primary">~기 위해서</p>
                    <p className="text-xs italic leading-relaxed text-on-surface/60">
                      자신의 꿈을 이루기 위해서 매일 노력하고 있습니다.
                      <br />
                      (自分の夢を叶えるために毎日努力しています)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-between gap-6 border-t border-outline-variant/10 pt-6 sm:flex-row">
                <div className="flex items-center gap-4 text-on-surface/50">
                  <span className="material-symbols-outlined text-sm">timer</span>
                  <span className="font-[family-name:var(--font-label)] text-xs">推奨：600-800文字</span>
                </div>
                <Link
                  className="rounded-xl bg-primary px-8 py-4 font-[family-name:var(--font-headline)] font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform hover:scale-[1.03] active:scale-95"
                  to="/writing/course"
                >
                  この課題を体験する
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </section>
  )
}
