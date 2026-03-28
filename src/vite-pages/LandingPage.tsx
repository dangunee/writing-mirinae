import { useNavigate } from 'react-router-dom'

/**
 * 공개 랜딩 (writing.mirinae.jp /writing).
 * CTA는 navigate만 사용 — fetch 없음.
 */
export default function LandingPage() {
  const navigate = useNavigate()

  const goToApp = () => {
    navigate('/writing/app')
  }

  return (
    <div className="landing-root text-[var(--color-text)]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/[0.06] via-transparent to-[var(--color-accent)]/[0.08]" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24 md:py-28 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            ミリネ韓国語教室
          </p>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[var(--color-primary)] sm:text-4xl md:text-5xl">
            writing<span className="text-[var(--color-text)]">.mirinae.jp</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--color-text-muted)] sm:text-xl">
            作文トレーニング — 韓国語の作文を、回数制のコースで継続的に学べます。
          </p>
          <p className="hangul mx-auto mt-3 max-w-xl text-sm text-[var(--color-text-muted)]">
            주제에 맞는 작문 제출, 강사 첨삭, 나의 학습 요약까지 한 곳에서 진행합니다.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={goToApp}
              className="w-full min-w-[200px] rounded-xl bg-[var(--color-primary)] px-8 py-3.5 text-base font-bold text-white shadow-md transition hover:opacity-95 active:scale-[0.99] sm:w-auto"
            >
              시작하기
            </button>
            <button
              type="button"
              onClick={goToApp}
              className="w-full min-w-[200px] rounded-xl border-2 border-[var(--color-primary)] bg-white px-8 py-3.5 text-base font-bold text-[var(--color-primary)] transition hover:bg-stone-50 active:scale-[0.99] sm:w-auto"
            >
              Apply
            </button>
          </div>
        </div>
      </section>

      {/* Value */}
      <section className="mx-auto max-w-5xl px-4 py-14 md:py-20">
        <h2 className="text-center font-headline text-xl font-bold text-[var(--color-text)] md:text-2xl">
          コースの流れ
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-[var(--color-text-muted)]">
          お支払い後、スケジュールを設定して10回のセッションに取り組みます。
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            {
              icon: 'edit_note',
              title: '課題に取り組む',
              desc: '各セッションのテーマに沿って作文を作成し、期限内に提出します。',
            },
            {
              icon: 'rate_review',
              title: '講師が添削',
              desc: '講師のフィードバックと評価を待ち、公開後に結果を確認します。',
            },
            {
              icon: 'monitoring',
              title: 'マイページで振り返り',
              desc: '提出状況や傾向をまとめて表示し、学習の続きをサポートします。',
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition hover:shadow-md"
            >
              <span
                className="material-symbols-outlined mb-4 block text-4xl text-[var(--color-primary)]"
                aria-hidden
              >
                {item.icon}
              </span>
              <h3 className="font-headline text-lg font-bold text-[var(--color-text)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-muted)]">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="border-t border-[var(--color-border)] bg-[var(--color-primary)]/[0.08] py-14 md:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-headline text-xl font-bold text-[var(--color-text)] md:text-2xl">
            すでにコースをお持ちの方
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            ログイン後、課題の提出と結果確認はアプリ画面から行えます。
          </p>
          <button
            type="button"
            onClick={goToApp}
            className="mt-8 rounded-xl bg-[var(--color-primary)] px-10 py-3.5 text-base font-bold text-white shadow-md transition hover:opacity-95 active:scale-[0.99]"
          >
            アプリを開く
          </button>
        </div>
      </section>

      {/* School link — external only */}
      <section className="mx-auto max-w-5xl px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
        <p>
          教室のご案内は{' '}
          <a
            href="https://mirinae.jp"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
          >
            mirinae.jp
          </a>
          をご覧ください。
        </p>
      </section>
    </div>
  )
}
