import { Link } from 'react-router-dom'

export default function AtelierCorrectionExample() {
  return (
    <section className="bg-white px-6 py-12 md:bg-background md:px-8 md:py-24" id="example">
      <div className="mx-auto max-w-7xl space-y-6 md:space-y-12">
        <div className="mb-12 text-center md:mb-0 md:space-y-4">
          <h3 className="font-[family-name:var(--font-headline)] text-2xl font-bold md:text-4xl md:tracking-tight">
            卓越した添削の品質
          </h3>
          <p className="text-sm text-on-surface/60 md:font-[family-name:var(--font-body)]">
            実際に行われる添削のプロセスをご覧ください。
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-outline-variant/10 bg-background p-6 md:bg-surface-container-lowest md:p-8 md:shadow-sm">
            <label className="font-[family-name:var(--font-label)] mb-4 block text-[10px] font-bold uppercase tracking-widest text-primary/60">
              01. 学生の原文 (ORIGINAL)
            </label>
            <p className="font-[family-name:var(--font-body)] text-base italic leading-relaxed text-on-surface md:text-lg">
              어제 친구와 같이 한국 식당에 갔습니다. 비빔밥이 아주 맛있었습니다. 다시 가고 싶습니다.
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/10 bg-background p-6 md:bg-surface-container-lowest md:p-8 md:shadow-sm">
            <label className="font-[family-name:var(--font-label)] mb-4 block text-[10px] font-bold uppercase tracking-widest text-primary/60">
              02. 講師による添削 (CORRECTION)
            </label>
            <p className="font-[family-name:var(--font-body)] text-base leading-relaxed md:text-lg">
              어제 친구와 <span className="correction-error">같이</span>
              <span className="correction-fixed">함께</span> 한국 식당에 갔습니다. 비빔밥이 아주{' '}
              <span className="correction-error">맛있었습니다</span>
              <span className="correction-fixed">일품이었습니다</span>. 다시{' '}
              <span className="correction-error">가고 싶습니다</span>
              <span className="correction-fixed">방문하고 싶을 정도였습니다</span>.
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/10 bg-background p-6 md:bg-surface-container-lowest md:p-8 md:shadow-sm">
            <label className="font-[family-name:var(--font-label)] mb-4 block text-[10px] font-bold uppercase tracking-widest text-primary/60">
              03. 修正後の文章 (POLISHED)
            </label>
            <p className="font-[family-name:var(--font-body)] text-base font-bold leading-relaxed text-primary md:text-lg">
              어제 친구와 함께 한국 식당을 방문했습니다. 비빔밥의 맛이 정말 일품이라 조만간 다시 방문하고 싶을 정도였습니다.
            </p>
          </div>

          <div className="rounded-2xl border border-outline-variant/10 bg-background p-6 md:bg-surface-container-lowest md:p-8 md:shadow-sm">
            <label className="font-[family-name:var(--font-label)] mb-4 block text-[10px] font-bold uppercase tracking-widest text-primary/60">
              04. 模範解答 (MODEL ANSWER)
            </label>
            <p className="hidden text-lg leading-relaxed text-on-surface/70 md:block">
              어제 지인과 동행하여 평소 눈여겨보던 한국 식당을 찾았습니다. 기대했던 비빔밥은 깊은 풍미が느껴지는 일품 요리였으며, 그 훌륭한 맛 덕분에 머지않아 꼭 다시 찾게 될 것 같습니다.
            </p>
            <p className="font-[family-name:var(--font-body)] text-base leading-relaxed text-on-surface/70 md:hidden">
              어제 지인과 동행하여 평소 눈여겨보던 한국 식당을 찾았습니다. 기대했던 비빔밥은 깊은 풍미가 느껴지는 일품 요리였으며, 그 훌륭한 맛 덕분에 머지않아 꼭 다시 찾게 될 것 같습니다.
            </p>
          </div>
        </div>

        <div className="text-center">
          <p className="mb-6 font-[family-name:var(--font-label)] text-[10px] text-on-surface/40 md:text-xs">
            このように丁寧に添削されます
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border-l-4 border-primary bg-background p-6 shadow-sm md:bg-surface-container-lowest md:p-10">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">notes</span>
            <h4 className="font-[family-name:var(--font-headline)] text-lg font-bold text-on-surface md:text-xl">
              講師のひとこと
            </h4>
          </div>
          <p className="text-sm leading-relaxed text-on-surface/80 md:hidden">
            「같이」を「함께」に変えるだけで、文章全体の品格が一段上がります。また「맛있다（美味しい）」という一般的な表現を「일품이다（絶品だ）」などの具体的な言葉に置き換えることで、感動をより鮮明に伝えることができます。
          </p>
          <p className="hidden font-[family-name:var(--font-body)] leading-relaxed text-on-surface/80 md:block">
            「같이」を「함께」に変えるだけで、文章全体の品格が一段上がります。また「맛있다（美味しい）」という一般的な表現を「일품이다（絶品だ）」などの具体的な言葉に置き換えることで、読者にその感動をより鮮明に伝えることができます。まずは語彙の幅を広げることから始めましょう。
          </p>
        </div>

        <div className="text-center md:mx-auto md:max-w-sm md:pt-4">
          <Link
            className="inline-flex w-full items-center justify-center rounded-xl bg-primary py-5 font-[family-name:var(--font-headline)] text-sm font-bold text-on-primary shadow-lg transition-all hover:bg-primary-container md:text-base"
            to="/writing/app"
          >
            この品質の添削を1,800円で体験する
          </Link>
        </div>
      </div>
    </section>
  )
}
