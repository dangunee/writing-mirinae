import './intro-workspace.css'

/**
 * Stitch「講師専用ワークスペース」HTML をベースにしたプレビュー。
 * UI 文言は日本語、本文例は韓国語作文。
 */
export default function IntroCorrectionWorkspace() {
  return (
    <section className="intro-workspace atelier-koto-root bg-[#F5F5F5] px-4 pb-10 pt-24 font-[family-name:var(--font-body)] text-on-surface md:px-6 md:pb-12 md:pt-28">
      <div className="mx-auto mb-8 max-w-4xl px-2 text-center md:mb-10">
        <h2 className="font-[family-name:var(--font-headline)] text-[40px] font-extrabold leading-tight tracking-tight text-primary md:text-[44px]">
          皆さんの韓国語がこう変わります！
        </h2>
        <p className="mt-3 font-[family-name:var(--font-label)] text-[20px] font-bold uppercase tracking-[0.2em] text-primary md:mt-4">
          体験レッスンで確認できる内容
        </p>
      </div>

      <div className="mx-auto flex max-w-[1600px] flex-col overflow-hidden rounded-xl border border-outline-variant/15 bg-white shadow-sm lg:flex-row lg:items-stretch">
        {/* 中央 */}
        <section className="order-1 min-w-0 flex-1">
          <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:space-y-12 md:px-8 md:py-12">
            {/* 提出詳細 */}
            <header className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
              <div className="mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">description</span>
                <span className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-widest text-secondary">
                  提出詳細
                </span>
              </div>
              <h1 className="font-[family-name:var(--font-headline)] text-2xl font-extrabold tracking-tight text-on-surface md:text-3xl">
                都市計画におけるAIの社会的影響
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant md:gap-4">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  残り 14:20
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">history_edu</span>
                  上級レベル
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">person</span>
                  김민준 (3期 · 7回目)
                </span>
              </div>
            </header>

            {/* 1. 原文（提出） */}
            <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">article</span>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-on-surface">
                  提出原文
                </h3>
              </div>
              <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/80 p-5 text-base leading-relaxed text-on-surface hangul">
                도시 계획에서 인공지능의 역할은 늘 복잡한 과제였습니다. 그러나 최근 AI 기술의 도입은 그 전경을 크게 바꾸고 있습니다.
                기존의 방식은 실시간 데이터 변화를 잘 반영하지 못하는 경우가 많습니다. 예를 들어 교통 흐름을 모델링할 때, 정적인 모델은 통근자의 갑작스러운 행동 변화를 예측하기 어렵습니다. 그
                결과 도시의 자원 배분이 더 효율적이 되고, 이는 밀집 지역에 사는 시민의 삶의 질을 높이는 방향으로 이어집니다.
              </div>
            </div>

            {/* 2. 添削ビュー */}
            <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
              <div className="mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-on-surface">
                  添削ビュー
                </h3>
              </div>
              <div className="selection:bg-primary-fixed space-y-6 text-base leading-relaxed text-on-surface hangul">
                <p className="relative">
                  도시 계획에서 인공지능이 맡는 역할은{' '}
                  <span className="rounded-sm bg-error-container px-1 text-on-error-container line-through decoration-error">
                    늘 복잡한 과제였습니다
                  </span>{' '}
                  <span className="rounded-sm bg-secondary-container px-1 font-semibold text-on-secondary-container">
                    본래부터 복잡한 과제였습니다
                  </span>
                  . 그러나 최근 AI 기술의 도입은 그{' '}
                  <span className="rounded-sm bg-error-container px-1 text-on-error-container line-through decoration-error">
                    전경
                  </span>{' '}
                  <span className="rounded-sm bg-secondary-container px-1 font-semibold text-on-secondary-container">
                    전망
                  </span>
                  을 크게 바꾸고 있습니다.
                  <span className="absolute -right-4 top-0 hidden w-56 translate-x-8 rounded-xl border border-outline-variant/20 bg-surface-container-highest/90 p-4 text-xs leading-snug shadow-xl backdrop-blur-md lg:block">
                    <span className="mb-1 block font-bold text-primary">講師のアドバイス</span>
                    学術文脈では「전망（展望）」の方が「전경（前景）」より適切です。
                  </span>
                </p>
                <p>
                  기존의 방식은 실시간 데이터 변화를{' '}
                  <span className="rounded-sm bg-error-container px-1 text-on-error-container line-through decoration-error">
                    잘 반영하지 못하는 경우가 많습니다
                  </span>{' '}
                  <span className="rounded-sm bg-secondary-container px-1 font-semibold text-on-secondary-container">
                    충분히 반영하지 못하는 경우가 많습니다
                  </span>
                  . 예를 들어 교통 흐름을{' '}
                  <span className="rounded-sm bg-error-container px-1 text-on-error-container line-through decoration-error">
                    모델링할 때
                  </span>
                  ,{' '}
                  <span className="rounded-sm bg-secondary-container px-1 font-semibold text-on-secondary-container">
                    시뮬레이션할 때
                  </span>
                  , 정적인 모델은 통근자의 갑작스러운{' '}
                  <span className="rounded-sm bg-error-container px-1 text-on-error-container line-through decoration-error">
                    행동 변화
                  </span>{' '}
                  <span className="rounded-sm bg-secondary-container px-1 font-semibold text-on-secondary-container">
                    이동 패턴의 변화
                  </span>
                  를 예측하기 어렵습니다.
                </p>
                <p>
                  그 결과 도시의 자원 배분{' '}
                  <span className="rounded-sm bg-error-container px-1 text-on-error-container line-through decoration-error">
                    이 더 효율적이 되고
                  </span>{' '}
                  <span className="rounded-sm bg-secondary-container px-1 font-semibold text-on-secondary-container">
                    의 효율이 높아지고
                  </span>
                  , 이는 밀집 지역에 사는 시민의{' '}
                  <span className="rounded-sm bg-error-container px-1 text-on-error-container line-through decoration-error">
                    삶의 질을 높이는 방향으로 이어집니다
                  </span>{' '}
                  <span className="rounded-sm bg-secondary-container px-1 font-semibold text-on-secondary-container">
                    삶의 질 향상에 기여합니다
                  </span>
                  .
                </p>
              </div>
              <div className="mt-8 hidden items-center justify-center gap-6 border-t border-outline-variant/15 pt-6 lg:flex">
                <div className="flex items-center gap-4 border-r border-outline-variant/30 pr-8">
                  <button type="button" className="flex flex-col items-center" aria-hidden>
                    <span className="material-symbols-outlined text-on-surface-variant">undo</span>
                    <span className="mt-1 text-[9px] font-bold uppercase text-outline">元に戻す</span>
                  </button>
                  <button type="button" className="flex flex-col items-center" aria-hidden>
                    <span className="material-symbols-outlined text-on-surface-variant">redo</span>
                    <span className="mt-1 text-[9px] font-bold uppercase text-outline">やり直し</span>
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-2 text-xs font-bold text-primary">
                    <span className="material-symbols-outlined">keyboard</span>
                    ショートカット
                  </span>
                  <div className="h-8 w-px bg-outline-variant/30" />
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-secondary" />
                    <span className="text-xs font-bold text-on-surface-variant">同期済み</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 清書 */}
            <div className="space-y-4 rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">auto_fix_high</span>
                  <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-on-surface">
                    清書（最終確認）
                  </h3>
                </div>
                <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-primary">
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  コピー
                </span>
              </div>
              <div className="relative">
                <div className="min-h-[160px] rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 text-base leading-relaxed text-on-surface shadow-sm hangul">
                  도시 계획에서 인공지능이 맡는 역할은 본래부터 복잡한 과제였습니다. 그러나 최근 AI 기술의 도입은 그 전망을 크게 바꾸고 있습니다. 기존의 방식은 실시간 데이터 변화를 충분히
                  반영하지 못하는 경우가 많습니다. 예를 들어 교통 흐름을 시뮬레이션할 때, 정적인 모델은 통근자의 갑작스러운 이동 패턴의 변화를 예측하기 어렵습니다. 그 결과 도시의 자원
                  배분의 효율이 높아지고, 이는 밀집 지역에 사는 시민의 삶의 질 향상에 기여합니다.
                </div>
                <div className="absolute bottom-3 right-3 rounded bg-surface-container px-2 py-1 text-[10px] font-bold text-outline">
                  単語数: 82
                </div>
              </div>
            </div>

            {/* 4. 模範解答 */}
            <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">school</span>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-on-surface">
                  模範解答
                </h3>
              </div>
              <div className="group relative overflow-hidden rounded-3xl border border-primary/10 bg-primary-container/30 p-6 md:p-8">
                <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/5 blur-3xl transition-colors group-hover:bg-primary/10" />
                <div className="relative z-10">
                  <p className="mb-4 flex flex-wrap items-center gap-2 font-[family-name:var(--font-headline)] text-lg font-bold text-primary">
                    アカデミック・スタンダード
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-on-primary">プレミアムコンテンツ</span>
                  </p>
                  <p className="mb-6 text-lg italic leading-relaxed text-on-surface-variant hangul">
                    &quot;도시 행정에서 인공지능의 전략적 통합은 실시간 데이터의 역동성을 반영하지 못하는 전통적 방법론의 한계를 극복하며, 궁극적으로 대도시 환경에서 거주민의 삶의 질을
                    제고하는 데 기여할 수 있습니다.&quot;
                  </p>
                  <div className="flex justify-end">
                    <span className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-xs font-bold text-primary">
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      リファレンスとして適用
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 講師メッセージ（中央列・モバイルでも表示） */}
            <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">forum</span>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-on-surface">
                  講師からのメッセージ
                </h3>
              </div>
              <textarea
                readOnly
                className="min-h-[120px] w-full resize-none rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 text-sm text-on-surface shadow-sm"
                placeholder="学生へのパーソナライズされたフィードバックを入力..."
                defaultValue="語彙の選択と文のリズムが一段と洗練されました。次回は接続詞の多様化にも挑戦してみましょう。"
              />
            </div>
          </div>
        </section>

        {/* 右：ツール */}
        <aside className="order-2 w-full shrink-0 border-outline-variant/15 lg:w-96 lg:border-l">
          <div className="no-scrollbar max-h-none space-y-8 overflow-y-auto p-5 md:p-6 lg:max-h-[calc(100vh-5rem)] lg:sticky lg:top-24">
            <section>
              <div className="mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">label</span>
                <h4 className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-widest text-on-surface">
                  エラーカテゴリー
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-surface-container-low p-2 transition-colors hover:bg-surface-container active:border-primary/20">
                  <input defaultChecked readOnly className="rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                  <span className="text-xs font-semibold">文法</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-surface-container-low p-2 transition-colors hover:bg-surface-container">
                  <input defaultChecked readOnly className="rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                  <span className="text-xs font-semibold">語彙</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-surface-container-low p-2 transition-colors hover:bg-surface-container">
                  <input readOnly className="rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                  <span className="text-xs font-semibold">句読点</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-surface-container-low p-2 transition-colors hover:bg-surface-container">
                  <input readOnly className="rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                  <span className="text-xs font-semibold">スタイル</span>
                </label>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">auto_awesome</span>
                  <h4 className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-widest text-on-surface">
                    添削フラグメント
                  </h4>
                </div>
                <span className="text-[10px] font-bold text-primary">保存</span>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-error-container px-1.5 py-0.5 text-[9px] font-bold text-on-error-container">文法</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-on-surface-variant line-through">늘 복잡한 과제였습니다</p>
                    <p className="font-bold text-primary">본래부터 복잡한 과제였습니다</p>
                  </div>
                </div>
                <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-secondary-container px-1.5 py-0.5 text-[9px] font-bold text-on-secondary-container">
                      語彙
                    </span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="text-on-surface-variant line-through">전경</p>
                    <p className="font-bold text-primary">전망</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="border-t border-outline-variant/20 pt-8">
              <div className="mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                <h4 className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-widest text-on-surface">
                  評価フィードバック
                </h4>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-on-surface-variant">文法の正確性</span>
                    <span className="text-xs font-bold text-primary">85%</span>
                  </div>
                  <input className="accent-primary" defaultValue={85} readOnly type="range" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-on-surface-variant">語彙の適切さ</span>
                    <span className="text-xs font-bold text-primary">72%</span>
                  </div>
                  <input className="accent-primary" defaultValue={72} readOnly type="range" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-on-surface-variant">文脈の流暢さ</span>
                    <span className="text-xs font-bold text-primary">90%</span>
                  </div>
                  <input className="accent-primary" defaultValue={90} readOnly type="range" />
                </div>
                <button
                  type="button"
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 py-2.5 text-xs font-bold text-primary transition-all hover:bg-primary/10"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  評価を保存
                </button>
              </div>
            </section>

            <section className="border-t border-outline-variant/20 pb-8 pt-8">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">history_edu</span>
                  <h4 className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-widest text-on-surface">
                    プレビュー表示
                  </h4>
                </div>
                <span className="material-symbols-outlined text-sm text-outline">content_copy</span>
              </div>
              <textarea
                readOnly
                className="h-32 w-full resize-none rounded-xl border-none bg-surface p-4 text-xs leading-relaxed shadow-inner focus:ring-1 focus:ring-primary/20"
                defaultValue="도시 계획에서 인공지능의 전략적 통합은 실시간 데이터의 역동성을 반영하지 못하는 전통적 방법론의 한계를 보완하는 데 기여할 수 있습니다."
              />
            </section>
          </div>
        </aside>
      </div>
    </section>
  )
}
