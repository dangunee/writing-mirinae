import './intro-workspace.css'
import {
  introCorrectionFinalDraftWordCount,
  introCorrectionMarketingSample,
} from '../../lib/introCorrectionMarketingSample'
import { IntroCorrectionSampleParagraph } from './IntroCorrectionSampleSegments'

/**
 * Stitch「講師専用ワークスペース」HTML をベースにしたプレビュー。
 * UI 文言は日本語、本文例は韓国語作文。
 */
export default function IntroCorrectionWorkspace() {
  const {
    assignmentTitle,
    originalText,
    finalDraftText,
    modelAnswerText,
    teacherMessageText,
    correctionParagraphs,
    sidebarFragments,
  } = introCorrectionMarketingSample

  const wordCount = introCorrectionFinalDraftWordCount(finalDraftText)

  return (
    <section className="intro-workspace atelier-koto-root bg-[#F5F5F5] pb-6 pt-24 font-[family-name:var(--font-body)] text-on-surface md:pb-8 md:pt-28">
      <div className="mx-auto max-w-7xl px-6 md:px-8">
        <div className="mx-auto mb-6 max-w-4xl text-center md:mb-8">
          <h2 className="font-[family-name:var(--font-headline)] text-[40px] font-extrabold leading-tight tracking-tight text-primary md:text-[44px]">
            皆さんの韓国語がこう変わります！
          </h2>
          <p className="mt-3 font-[family-name:var(--font-label)] text-[20px] font-bold uppercase tracking-[0.2em] text-primary md:mt-4">
            体験レッスンで確認できる内容
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 overflow-hidden rounded-xl border border-outline-variant/15 bg-white shadow-sm lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-stretch lg:gap-3">
          {/* 中央 */}
          <section className="order-1 min-w-0">
            <div className="space-y-6 px-4 py-6 md:space-y-8 md:px-6 md:py-10">
              {/* 提出詳細 */}
              <header className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
                <div className="mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">description</span>
                  <span className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-widest text-secondary">
                    提出詳細
                  </span>
                </div>
                <h1 className="font-[family-name:var(--font-headline)] text-2xl font-extrabold tracking-tight text-on-surface md:text-3xl">
                  {assignmentTitle}
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
                <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/80 p-5 text-base leading-relaxed text-on-surface hangul whitespace-pre-wrap">
                  {originalText}
                </div>
              </div>

              {/* 2. 添削ビュー */}
              <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
                <div className="mb-5 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">edit_note</span>
                  <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-on-surface">
                    添削ビュー
                  </h3>
                </div>
                <div className="selection:bg-primary-fixed space-y-5 text-base leading-relaxed text-on-surface hangul">
                  {correctionParagraphs.map((paragraph, idx) => (
                    <IntroCorrectionSampleParagraph key={idx} segments={paragraph} />
                  ))}
                </div>
                <div className="mt-6 hidden items-center justify-center gap-6 border-t border-outline-variant/15 pt-5 lg:flex">
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
                  <div className="min-h-[160px] rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 text-base leading-relaxed text-on-surface shadow-sm hangul whitespace-pre-wrap">
                    {finalDraftText}
                  </div>
                  <div className="absolute bottom-3 right-3 rounded bg-surface-container px-2 py-1 text-[10px] font-bold text-outline">
                    単語数: {wordCount}
                  </div>
                </div>
              </div>

              {/* 4. 模範解答 */}
              <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] md:p-8">
                <div className="mb-3 flex items-center gap-2">
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
                    <p className="mb-6 text-lg italic leading-relaxed text-on-surface-variant hangul whitespace-pre-wrap">
                      {modelAnswerText}
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
                <div className="mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">forum</span>
                  <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-on-surface">
                    講師からのメッセージ
                  </h3>
                </div>
                <textarea
                  readOnly
                  className="min-h-[120px] w-full resize-none rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 text-sm text-on-surface shadow-sm"
                  placeholder="学生へのパーソナライズされたフィードバックを入力..."
                  defaultValue={teacherMessageText}
                />
              </div>
            </div>
          </section>

          {/* 右：ツール */}
          <aside className="order-2 min-w-0 border-outline-variant/15 lg:border-l">
            <div className="no-scrollbar max-h-none space-y-6 overflow-y-auto p-4 md:p-5 lg:max-h-[calc(100vh-5rem)] lg:sticky lg:top-24">
              <section>
                <div className="mb-3 flex items-center gap-2">
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
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">auto_awesome</span>
                    <h4 className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-widest text-on-surface">
                      添削フラグメント
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-primary">保存</span>
                </div>
                <div className="space-y-3">
                  {sidebarFragments.map((frag) => (
                    <div
                      key={`${frag.wrong}-${frag.right}`}
                      className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-3 shadow-sm"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span
                          className={
                            frag.category === '語彙'
                              ? 'rounded bg-secondary-container px-1.5 py-0.5 text-[9px] font-bold text-on-secondary-container'
                              : 'rounded bg-error-container px-1.5 py-0.5 text-[9px] font-bold text-on-error-container'
                          }
                        >
                          {frag.category}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <p className="text-on-surface-variant line-through">{frag.wrong}</p>
                        <p className="font-bold text-primary">{frag.right}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-t border-outline-variant/20 pt-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  <h4 className="font-[family-name:var(--font-label)] text-xs font-bold uppercase tracking-widest text-on-surface">
                    評価フィードバック
                  </h4>
                </div>
                <div className="space-y-5">
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

              <section className="border-t border-outline-variant/20 pb-6 pt-6">
                <div className="mb-3 flex items-center justify-between">
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
                  defaultValue={finalDraftText}
                />
              </section>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
