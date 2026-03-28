import { useEffect, useMemo, useState } from 'react'

// [API 연결] 세션 쿠키 기반 — base URL은 Vite 프록시(/) 또는 VITE_API_BASE_URL
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

const DONUT_C = 251.2

type MypageSummary = {
  courseId: string
  sessionCount: number
  publishedSubmissionCount: number
  submissionRate: number
  globalAverageSubmissionRate: number | null
  correctionRate: number | null
  evaluation: {
    grammar: { average: number | null }
    vocabulary: { average: number | null }
    context: { average: number | null }
  }
}

type MypageSessionItem = {
  index: number
  correctionRate: number | null
}

type MypageCommentItem = {
  sessionIndex: number
  teacherComment: string
  publishedAt: string | null
}

type FrequentCategory = {
  category: string
  fragmentCount: number
  topPairs: Array<{ originalText: string; correctedText: string; count: number }>
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n))
}

/** correctionRate / evaluation.* / sessions[].correctionRate: API 0–100 */
function scoreToPctDisplay(n: number | null | undefined, fallback: number): number {
  if (n == null || Number.isNaN(n) || !Number.isFinite(Number(n))) return fallback
  const x = Number(n)
  return Math.min(100, Math.max(0, Math.round(x * 10) / 10))
}

function correctionBarHeightPct(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n) || !Number.isFinite(Number(n))) return 0
  const x = Number(n)
  return Math.min(100, Math.max(0, Math.round(x * 10) / 10))
}

function formatSessionDate(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function pairQuote(p: { originalText: string; correctedText: string }): string {
  const a = (p.originalText ?? '').trim()
  const b = (p.correctedText ?? '').trim()
  if (!a && !b) return '（該当する修正ペアがありません）'
  return `「${a}」→「${b}」`
}

const CATEGORY_LABEL_JA: Record<string, string> = {
  grammar: '文法',
  expression: '表現',
  vocabulary: '語彙',
  particle: '助詞の使い分け',
  spelling: '綴り・タイポ',
  honorifics: '謙譲語',
  kanji: '漢字の誤変換',
}

const MISTAKE_CARD_BORDERS = ['border-red-500', 'border-[#000666]', 'border-[#f59e0b]'] as const
const MISTAKE_ICON_WRAP = [
  'bg-red-50 text-red-600',
  'bg-indigo-50 text-[#000666]',
  'bg-orange-50 text-[#f59e0b]',
] as const
const MISTAKE_BADGE = [
  'bg-red-100 text-red-700',
  'bg-indigo-100 text-[#000666]',
  'bg-orange-100 text-[#f59e0b]',
] as const
const MISTAKE_ICONS = ['error', 'history_edu', 'spellcheck'] as const

const MOBILE_MISTAKE_BORDER = ['border-error', 'border-primary', 'border-[#e67e22]'] as const
const MOBILE_MISTAKE_ICON_WRAP = ['bg-error-container', 'bg-primary-fixed', 'bg-[#fef5e7]'] as const
const MOBILE_MISTAKE_ICON_COLOR = ['text-on-error-container', 'text-primary', 'text-[#e67e22]'] as const
const MOBILE_MISTAKE_NUM_COLOR = ['text-error', 'text-primary', 'text-[#e67e22]'] as const
const MOBILE_MISTAKE_ICONS = ['error', 'school', 'edit_square'] as const

const BREAKDOWN_COLS = ['bg-primary', 'bg-indigo-400', 'bg-indigo-200', 'bg-stone-200'] as const

export default function MypagePage() {
  const [summary, setSummary] = useState<MypageSummary | null>(null)
  const [sessionsPayload, setSessionsPayload] = useState<{ sessions: MypageSessionItem[] } | null>(null)
  const [commentsPayload, setCommentsPayload] = useState<{ items: MypageCommentItem[] } | null>(null)
  const [freqPayload, setFreqPayload] = useState<{
    categories: FrequentCategory[]
    totalFragments: number
  } | null>(null)

  // [API 연결] summary / sessions / comments / frequent-mistakes 병렬 fetch
  // [VERIFY] draft 비노출: 서버 writingMypageService·Repository가 published 만 집계/반환
  useEffect(() => {
    const opts: RequestInit = { credentials: 'include' }
    let cancelled = false

    async function load() {
      try {
        const [rSum, rSes, rCom, rFq] = await Promise.all([
          fetch(apiUrl('/api/writing/mypage/summary'), opts),
          fetch(apiUrl('/api/writing/mypage/sessions'), opts),
          fetch(apiUrl('/api/writing/mypage/comments'), opts),
          fetch(apiUrl('/api/writing/mypage/frequent-mistakes'), opts),
        ])
        if (cancelled) return
        setSummary(rSum.ok ? ((await rSum.json()) as MypageSummary) : null)
        setSessionsPayload(rSes.ok ? ((await rSes.json()) as { sessions: MypageSessionItem[] }) : null)
        setCommentsPayload(rCom.ok ? ((await rCom.json()) as { items: MypageCommentItem[] }) : null)
        setFreqPayload(rFq.ok ? ((await rFq.json()) as { categories: FrequentCategory[]; totalFragments: number }) : null)
      } catch {
        if (!cancelled) {
          setSummary(null)
          setSessionsPayload(null)
          setCommentsPayload(null)
          setFreqPayload(null)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const sessionsSorted = useMemo(() => {
    const raw = sessionsPayload?.sessions
    const list = Array.isArray(raw) ? raw : []
    return [...list].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  }, [sessionsPayload])

  const currentSessionAccuracy = useMemo(() => {
    let best: MypageSessionItem | null = null
    for (const s of sessionsSorted) {
      const cr = s.correctionRate
      if (cr == null || Number.isNaN(cr) || !Number.isFinite(cr)) continue
      if (!Number.isFinite(s.index)) continue
      if (!best || s.index >= best.index) best = s
    }
    if (best?.correctionRate != null) return scoreToPctDisplay(best.correctionRate, 0)
    // [FIX] 세션 API 미수신 전에만 Stitch 75%; 로드 후 데이터 없음은 0 (mock으로 0 덮어쓰기 방지)
    return sessionsPayload == null ? 75 : 0
  }, [sessionsSorted, sessionsPayload])

  const avgCorrectionPct = useMemo(
    () => scoreToPctDisplay(summary?.correctionRate, summary == null ? 22.5 : 0),
    [summary],
  )

  // [VERIFY] submissionRate / globalAverageSubmissionRate: API 0–1 → % 표시는 submissionPctDisplay / globalAvgPctDisplay
  const submissionRatio = useMemo(() => {
    if (summary == null) return 0.7
    const r = summary.submissionRate
    if (r == null || Number.isNaN(r) || !Number.isFinite(r)) return 0
    return clamp01(r <= 1 ? r : r / 100)
  }, [summary])

  const globalAvgRatio = useMemo(() => {
    if (summary == null) return 0.82
    const g = summary.globalAverageSubmissionRate
    // [FIX] API null = 전체 평균 없음 → 82% 가짜 표시 대신 0
    if (g == null || Number.isNaN(g) || !Number.isFinite(g)) return 0
    return clamp01(g <= 1 ? g : g / 100)
  }, [summary])

  const donutOffset = DONUT_C * (1 - submissionRatio)

  // [FIX] summary 없음(미로드/실패)만 7·10 플레이스홀더; 실제 0은 그대로 표시
  const publishedCount = (() => {
    if (summary == null) return 7
    const n = summary.publishedSubmissionCount
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  })()
  const sessionCount = (() => {
    if (summary == null) return 10
    const n = summary.sessionCount
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  })()
  const submissionPctDisplay = Math.round(submissionRatio * 1000) / 10
  const globalAvgPctDisplay = Math.round(globalAvgRatio * 1000) / 10
  const tasksRemaining = Math.max(0, sessionCount - publishedCount)

  const grammarPct = useMemo(
    () => scoreToPctDisplay(summary?.evaluation?.grammar?.average, summary == null ? 85 : 0),
    [summary],
  )
  const vocabPct = useMemo(
    () => scoreToPctDisplay(summary?.evaluation?.vocabulary?.average, summary == null ? 72 : 0),
    [summary],
  )
  const contextPct = useMemo(
    () => scoreToPctDisplay(summary?.evaluation?.context?.average, summary == null ? 91 : 0),
    [summary],
  )

  const topFreq = useMemo(() => {
    const raw = freqPayload?.categories
    const cats = Array.isArray(raw) ? raw : []
    const tf = freqPayload?.totalFragments
    const total = typeof tf === 'number' && Number.isFinite(tf) ? tf : 0
    return { cats: cats.slice(0, 3), total }
  }, [freqPayload])

  const breakdownTop4 = useMemo(() => {
    const raw = freqPayload?.categories
    const cats = Array.isArray(raw) ? raw : []
    const tf = freqPayload?.totalFragments
    const total = typeof tf === 'number' && Number.isFinite(tf) ? tf : 0
    const top4 = cats.slice(0, 4)
    if (total <= 0 || top4.length === 0) {
      return [
        { label: '文法修正', pct: 40, w: '40%' },
        { label: '表現修正', pct: 30, w: '30%' },
        { label: '語彙選択', pct: 20, w: '20%' },
        { label: '綴り・タイポ', pct: 10, w: '10%' },
      ]
    }
    return top4.map((c) => {
      const fc = c.fragmentCount
      const count = typeof fc === 'number' && Number.isFinite(fc) ? Math.max(0, fc) : 0
      const pct = total > 0 ? Math.round((count / total) * 1000) / 10 : 0
      return {
        label: CATEGORY_LABEL_JA[c.category ?? ''] ?? c.category ?? '',
        pct,
        w: `${pct}%`,
      }
    })
  }, [freqPayload])

  const commentItems = useMemo(() => {
    const raw = commentsPayload?.items
    return Array.isArray(raw) ? raw : []
  }, [commentsPayload])

  const highlightSessionIndex = useMemo(() => {
    let idx = -1
    for (const s of sessionsSorted) {
      const cr = s.correctionRate
      if (cr == null || Number.isNaN(cr) || !Number.isFinite(cr)) continue
      const si = s.index
      if (!Number.isFinite(si)) continue
      if (si >= idx) idx = si
    }
    return idx
  }, [sessionsSorted])

  const firstComment = commentItems[0]

  return (
    <div className="mypage-root min-h-screen bg-background font-body text-on-surface antialiased">
      <style>{`
        .mypage-root .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .mypage-root .ink-gradient {
          background: linear-gradient(135deg, #000666 0%, #1a237e 100%);
        }
        .mypage-root .chart-container {
          height: 180px;
          display: flex;
          align-items: flex-end;
          gap: 4px;
          position: relative;
        }
        .mypage-root .bar-group {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
        }
        .mypage-root .bar {
          width: 100%;
          background-color: #e0e0ff;
          border-top-left-radius: 2px;
          border-top-right-radius: 2px;
          transition: all 0.3s ease;
        }
        .mypage-root .bar:hover {
          background-color: #1a237e;
        }
        .mypage-root .bar.current {
          background-color: #1a237e;
        }
        .mypage-root .avg-line {
          position: absolute;
          left: 0;
          right: 0;
          border-top: 1px dashed #1b6d24;
          z-index: 10;
        }
        .mypage-root .line-chart-svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }
      `}</style>

      {/* ——— Desktop (Stitch) ——— */}
      <div className="hidden lg:block">
        <header className="bg-white/80 dark:bg-stone-900/80 backdrop-blur-md sticky top-0 w-full z-40 shadow-sm border-b border-gray-200/50">
          <div className="flex justify-between items-center px-8 h-16 w-full">
            <div className="text-xl font-bold tracking-tighter text-indigo-950 dark:text-indigo-100 font-headline">
              The Scholar
            </div>
            <nav className="hidden md:flex items-center gap-x-8 font-manrope text-sm tracking-tight">
              <a className="text-stone-500 dark:text-stone-400 hover:text-indigo-700 transition-colors" href="#">
                Atelier
              </a>
              <a className="text-stone-500 dark:text-stone-400 hover:text-indigo-700 transition-colors" href="#">
                Manuscripts
              </a>
              <a
                className="text-stone-500 dark:text-stone-400 hover:text-indigo-700 transition-colors text-indigo-900 dark:text-indigo-200 font-semibold underline decoration-2 underline-offset-8 decoration-indigo-900"
                href="#"
              >
                Analytics
              </a>
              <a className="text-stone-500 dark:text-stone-400 hover:text-indigo-700 transition-colors" href="#">
                Lexicon
              </a>
            </nav>
            <div className="flex items-center gap-x-4">
              <button
                type="button"
                className="scale-95 active:scale-90 transition-transform text-indigo-900 dark:text-indigo-300"
              >
                <span className="material-symbols-outlined">notifications</span>
              </button>
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant/15">
                <img
                  alt="Portrait of a distinguished scholar"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8t93SXnAVHwyYJKjucBkt6c_9ZkTaZlMP8TjXy7bR_1-PHC1SPgjtHE3uaCkNhizzkk6n3D7hehuwQ5ikB9d9b1GL2wTsLyhWuOIdcQAFVhZaaStLqf9yxyBlmaxy-21OJCpuyzF0QrlMWi2jtBur7HmDhLlTBLnVzt1azk0X2bkmSwqKCNNxzzwHXrJIOXiIH1ARj9x4jcdLIxAj6dLc_iFFHVty9nCmF7JQF9xCexd-A54IAW0-WtNaJSyhK4DBdetK8waymJM"
                />
              </div>
            </div>
          </div>
        </header>
        <div className="flex">
          <aside className="min-h-screen w-64 fixed left-0 top-0 pt-16 hidden lg:flex flex-col py-8 px-6 gap-y-8 bg-[#f5f1ea] dark:bg-stone-950 border-r border-stone-200/15">
            <div className="mt-4">
              <div className="font-manrope text-lg font-black text-indigo-950 dark:text-white mb-1">賢者のアトリエ</div>
              <div className="font-manrope uppercase tracking-[0.05em] text-[11px] font-bold text-stone-500">
                Upper Intermediate
              </div>
            </div>
            <nav className="flex flex-col gap-y-4">
              <div className="flex items-center gap-x-3 text-stone-500 group cursor-pointer">
                <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1">
                  edit_note
                </span>
                <span className="font-manrope uppercase tracking-[0.05em] text-[11px] font-bold">Atelier</span>
              </div>
              <div className="flex items-center gap-x-3 text-stone-500 group cursor-pointer">
                <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1">
                  menu_book
                </span>
                <span className="font-manrope uppercase tracking-[0.05em] text-[11px] font-bold">Manuscripts</span>
              </div>
              <div className="flex items-center gap-x-3 text-indigo-900 dark:text-indigo-200 border-b-2 border-indigo-900 dark:border-indigo-400 pb-1">
                <span className="material-symbols-outlined">insights</span>
                <span className="font-manrope uppercase tracking-[0.05em] text-[11px] font-bold">Analytics</span>
              </div>
              <div className="flex items-center gap-x-3 text-stone-500 group cursor-pointer">
                <span className="material-symbols-outlined transition-transform duration-200 group-hover:translate-x-1">
                  translate
                </span>
                <span className="font-manrope uppercase tracking-[0.05em] text-[11px] font-bold">Lexicon</span>
              </div>
            </nav>
            <div className="mt-auto flex flex-col gap-y-4">
              <div className="flex items-center gap-x-3 text-stone-500 font-manrope uppercase tracking-[0.05em] text-[11px] font-bold">
                <span className="material-symbols-outlined">help_outline</span>
                Help Center
              </div>
              <button
                type="button"
                className="ink-gradient text-white py-3 px-4 rounded-lg text-[11px] font-bold uppercase tracking-[0.1em] shadow-lg shadow-primary/10"
              >
                Review Feedback
              </button>
            </div>
          </aside>
          <main className="flex-1 lg:ml-64 p-8 md:p-12 lg:p-20">
            <div className="max-w-6xl mx-auto">
              <header className="mb-16">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                  <div className="max-w-2xl">
                    <span className="font-label text-[11px] font-bold tracking-[0.1em] text-primary uppercase">
                      Progress Report
                    </span>
                    <h1 className="font-headline text-4xl md:text-5xl font-extrabold text-indigo-950 tracking-tight mt-2 leading-tight">
                      学習到達度の詳細分析
                    </h1>
                    <p className="mt-6 text-on-surface-variant font-body text-lg leading-relaxed">
                      直近10回のセッションに基づいた、あなたの文章表現の傾向と改善ポイントを視覚化しました。
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-x-2 bg-white px-6 py-4 rounded-lg border border-gray-200 text-indigo-950 font-label font-bold text-sm hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined">history_edu</span>
                    過去の記録を見る
                  </button>
                </div>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-12 bg-white p-8 rounded-xl shadow-sm border border-gray-100 flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-secondary-container/5 rounded-full -translate-y-24 translate-x-24" />
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                    <div>
                      <h3 className="font-label text-xs font-bold tracking-[0.1em] text-stone-500 uppercase">
                        Correction Percentage Analysis
                      </h3>
                      <p className="font-headline text-2xl font-bold text-indigo-950 mt-1">セッション別添削率の推移</p>
                    </div>
                    <div className="flex items-center gap-x-8">
                      <div className="text-right">
                        <span className="font-label text-[10px] font-bold text-stone-500 tracking-wider uppercase">
                          Current Session Accuracy
                        </span>
                        <div className="flex items-baseline gap-x-1 justify-end">
                          {/* [API 연결] 최신 세션 correctionRate */}
                          <span className="font-headline text-4xl font-black text-indigo-950">{currentSessionAccuracy}%</span>
                          <span className="text-secondary font-bold text-xs">+12%</span>
                        </div>
                      </div>
                      <div className="h-10 w-px bg-gray-100 hidden md:block" />
                      <div className="text-right">
                        <span className="font-label text-[10px] font-bold text-stone-500 tracking-wider uppercase">
                          Average Correction Rate
                        </span>
                        {/* [API 연결] summary.correctionRate */}
                        <div className="font-headline text-2xl font-bold text-secondary">{avgCorrectionPct}%</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[220px] flex flex-col">
                    <div className="chart-container mb-4">
                      {/* [FIX] 첨삭률 막대(0–100)와 동일 스케일 — summary.correctionRate（= 右上 AVG）; 모바일과 avgCorrectionPct 공통 */}
                      <div className="avg-line" style={{ bottom: `${avgCorrectionPct}%` }}>
                        <div className="absolute right-0 -top-5 text-[9px] font-bold text-secondary uppercase bg-white px-1">
                          Avg Line
                        </div>
                      </div>
                      {sessionsSorted.length === 0
                        ? Array.from({ length: 10 }).map((_, i) => (
                            <div key={`ph-${i}`} className="bar-group">
                              <div className="bar" style={{ height: '0%' }} />
                              <span className="text-[9px] font-bold text-stone-400 mt-2">S{i + 1}</span>
                            </div>
                          ))
                        : sessionsSorted.map((s) => {
                            const h = correctionBarHeightPct(s.correctionRate)
                            const isCurrent =
                              s.correctionRate != null &&
                              Number.isFinite(s.index) &&
                              highlightSessionIndex >= 0 &&
                              s.index === highlightSessionIndex
                            return (
                              <div key={s.index} className="bar-group">
                                <div className={isCurrent ? 'bar current' : 'bar'} style={{ height: `${h}%` }} />
                                <span
                                  className={`text-[9px] font-bold mt-2 ${isCurrent ? 'text-indigo-950' : 'text-stone-400'}`}
                                >
                                  S{s.index}
                                </span>
                              </div>
                            )
                          })}
                    </div>
                    <div className="pt-6 border-t border-gray-50 flex items-center justify-between text-sm font-body text-on-surface-variant leading-relaxed">
                      <p>
                        過去10回のセッションを通じて添削率（修正箇所）は着実に低下しており、
                        <span className="text-secondary font-bold">自然な韓国語表現</span>
                        への移行が順調です。
                      </p>
                      <div className="flex items-center gap-x-4 shrink-0 ml-4">
                        <div className="flex items-center gap-x-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-100" />
                          <span className="text-[10px] font-bold text-stone-500">修正率</span>
                        </div>
                        <div className="flex items-center gap-x-1.5">
                          <span className="w-2 h-2 border-t border-dashed border-secondary" />
                          <span className="text-[10px] font-bold text-stone-500">平均</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-12">
                  <div className="bg-surface-container-low p-8 rounded-xl border border-stone-200/20 relative shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-label text-xs font-bold tracking-[0.1em] text-stone-500 uppercase">頻出ミス</h3>
                      <span className="bg-error-container text-on-error-container px-2 py-1 text-[10px] font-bold rounded">
                        要注意
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {topFreq.cats.length === 0
                        ? [0, 1, 2].map((slot) => (
                            <div
                              key={`fm-f-${slot}`}
                              className={`flex items-start gap-x-4 p-4 bg-white rounded-lg border-l-4 ${MISTAKE_CARD_BORDERS[slot]} shadow-sm`}
                            >
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${MISTAKE_ICON_WRAP[slot]}`}
                              >
                                <span className="material-symbols-outlined text-sm">{MISTAKE_ICONS[slot]}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex justify-between items-start">
                                  <span className="font-body font-bold text-sm text-indigo-950">
                                    {slot === 0 ? '助詞の使い分け' : slot === 1 ? '謙譲語の混同' : '漢字の誤変換'}
                                  </span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 whitespace-nowrap ${MISTAKE_BADGE[slot]}`}
                                  >
                                    {slot === 0 ? '12回' : slot === 1 ? '8回' : '5回'}
                                  </span>
                                </div>
                                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                                  {slot === 0
                                    ? '「『は』と『が』の主語強調のニュアンスに注意が必要です。」'
                                    : slot === 1
                                      ? '「尊敬語と謙譲語の主語の置き換えを再確認しましょう。」'
                                      : '「同音異義語の選択ミスが散見されます。文脈判断を大切に。」'}
                                </p>
                              </div>
                            </div>
                          ))
                        : topFreq.cats.map((c, i) => {
                            const slot = i % 3
                            const label = CATEGORY_LABEL_JA[c.category] ?? c.category
                            const quote =
                              c.topPairs?.[0] != null
                                ? pairQuote(c.topPairs[0])
                                : '（該当する修正ペアがありません）'
                            return (
                              <div
                                key={`${c.category}-${i}`}
                                className={`flex items-start gap-x-4 p-4 bg-white rounded-lg border-l-4 ${MISTAKE_CARD_BORDERS[slot]} shadow-sm`}
                              >
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${MISTAKE_ICON_WRAP[slot]}`}
                                >
                                  <span className="material-symbols-outlined text-sm">{MISTAKE_ICONS[slot]}</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-start">
                                    <span className="font-body font-bold text-sm text-indigo-950">{label}</span>
                                    <span
                                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 whitespace-nowrap ${MISTAKE_BADGE[slot]}`}
                                    >
                                      {typeof c.fragmentCount === 'number' && Number.isFinite(c.fragmentCount) ? c.fragmentCount : 0}回
                                    </span>
                                  </div>
                                  <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{quote}</p>
                                </div>
                              </div>
                            )
                          })}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-12 lg:col-span-6 bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-10">
                    <div>
                      <h3 className="font-headline text-xl font-bold text-indigo-950">添削項目の詳細分析</h3>
                      <p className="text-xs text-stone-500 font-label tracking-wide uppercase mt-1">Correction Item Breakdown</p>
                    </div>
                  </div>
                  <div className="mb-8">
                    <div className="flex h-12 w-full rounded-full overflow-hidden shadow-inner bg-gray-50">
                      {/* [API 연결] frequent-mistakes 상위 4 카테고리 비율 */}
                      {breakdownTop4.map((b, i) => (
                        <div
                          key={`seg-${b.label}-${i}`}
                          className={`h-full ${BREAKDOWN_COLS[i % BREAKDOWN_COLS.length]}`}
                          style={{ width: b.w }}
                          title={`${b.label}: ${b.pct}%`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                    {breakdownTop4.map((b, i) => (
                      <div key={`row-${b.label}-${i}`} className="flex items-center gap-x-3">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${BREAKDOWN_COLS[i % BREAKDOWN_COLS.length]}`} />
                        <div className="flex-1">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold text-indigo-950">{b.label}</span>
                            <span className="text-sm font-black text-indigo-950">{b.pct}%</span>
                          </div>
                          <div className="h-1 w-full bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                            <div className={`h-full ${BREAKDOWN_COLS[i % BREAKDOWN_COLS.length]}`} style={{ width: b.w }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-12 lg:col-span-6 bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="font-headline text-xl font-bold text-indigo-950">評価フィードバック</h3>
                      <p className="text-xs text-stone-500 font-label tracking-wide uppercase mt-1">Evaluation Feedback</p>
                    </div>
                  </div>
                  <div className="space-y-4 mb-8">
                    <div className="group">
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-indigo-950">文法の正確性</span>
                        {/* [API 연결] evaluation.grammar.average */}
                        <span className="text-primary font-black">{grammarPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${grammarPct}%` }} />
                      </div>
                    </div>
                    <div className="group">
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-indigo-950">語彙の適切さ</span>
                        <span className="text-primary font-black">{vocabPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${vocabPct}%` }} />
                      </div>
                    </div>
                    <div className="group">
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-indigo-950">文脈の流暢さ</span>
                        <span className="text-primary font-black">{contextPct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${contextPct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="pt-6 border-t border-gray-100">
                    <h5 className="font-label text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">Submission Status</h5>
                    <div className="flex items-center gap-x-6">
                      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                          <circle className="text-stone-100" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                          <circle
                            className="text-primary"
                            cx="50"
                            cy="50"
                            fill="transparent"
                            r="40"
                            stroke="currentColor"
                            strokeDasharray={DONUT_C}
                            strokeDashoffset={donutOffset}
                            strokeLinecap="round"
                            strokeWidth="8"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          {/* [API 연결] publishedSubmissionCount / sessionCount */}
                          <span className="font-headline text-lg font-black text-indigo-950">
                            {publishedCount}/{sessionCount}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-[11px] font-bold text-indigo-950">個人進捗 {submissionPctDisplay}%</span>
                          </div>
                          <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${submissionPctDisplay}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-[11px] font-bold text-stone-500">全体平均 {globalAvgPctDisplay}%</span>
                          </div>
                          <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
                            <div className="h-full bg-stone-400" style={{ width: `${globalAvgPctDisplay}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-12 flex flex-col">
                  <div className="bg-primary text-white p-8 rounded-xl flex flex-col md:flex-row items-center justify-between overflow-hidden relative shadow-lg">
                    <div className="relative z-10 max-w-2xl">
                      <h4 className="font-headline text-2xl font-bold mb-2">総評を確認する</h4>
                      <p className="text-indigo-200 text-sm leading-relaxed mb-6 md:mb-0">
                        AIと専任講師による詳細なフィードバックレポートが完成しました。学習の指針となる具体的なアドバイスが含まれています。
                      </p>
                    </div>
                    <button
                      type="button"
                      className="relative z-10 px-10 py-4 bg-white text-primary rounded font-label font-black text-sm uppercase tracking-widest shadow-xl hover:bg-indigo-50 transition-colors shrink-0"
                    >
                      View General Evaluation
                    </button>
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl" />
                  </div>
                </div>
              </div>

              <section className="mt-16 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xl shadow-indigo-900/5">
                <div className="p-10 border-b border-gray-100 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-x-4">
                    <div className="w-12 h-12 rounded-full ink-gradient flex items-center justify-center text-white">
                      <span className="material-symbols-outlined">forum</span>
                    </div>
                    <div>
                      <h2 className="font-headline text-2xl font-extrabold text-indigo-950 tracking-tight">講師のひとことログ</h2>
                      <p className="text-xs text-stone-500 font-label font-bold tracking-widest uppercase mt-1">
                        Instructor Feedback History
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-x-2 text-secondary font-bold font-label text-sm">
                    <span className="material-symbols-outlined text-lg">verified</span>
                    Grade: Excellent (優)
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2">
                  <div className="p-10 border-r border-gray-100 bg-[#f3f4f6]">
                    <h5 className="font-label text-xs font-black text-stone-400 uppercase tracking-widest mb-6">Instructor&apos;s Messages</h5>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-300">
                      {/* [API 연결] comments.items map */}
                      {commentItems.length === 0 ? (
                        <>
                          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200/50">
                            <div className="flex justify-between mb-1">
                              <span className="text-[10px] font-bold text-primary uppercase">第10回</span>
                              <span className="text-[10px] text-stone-400">2023.11.20</span>
                            </div>
                            <p className="text-sm text-indigo-950 leading-relaxed font-medium">
                              表現の幅が格段に広がりましたね！特に漢語語彙の使い方が自然です。
                            </p>
                          </div>
                          <div className="bg-white/60 p-4 rounded-lg border border-gray-200/50">
                            <div className="flex justify-between mb-1">
                              <span className="text-[10px] font-bold text-stone-500 uppercase">第9回</span>
                              <span className="text-[10px] text-stone-400">2023.11.15</span>
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">接続詞の選択がより論理的になってきました。素晴らしい進歩です。</p>
                          </div>
                          <div className="bg-white/60 p-4 rounded-lg border border-gray-200/50">
                            <div className="flex justify-between mb-1">
                              <span className="text-[10px] font-bold text-stone-500 uppercase">第8回</span>
                              <span className="text-[10px] text-stone-400">2023.11.10</span>
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">パッチムの処理ミスが減りました。この調子で細部まで意識しましょう。</p>
                          </div>
                          <div className="bg-white/60 p-4 rounded-lg border border-gray-200/50">
                            <div className="flex justify-between mb-1">
                              <span className="text-[10px] font-bold text-stone-500 uppercase">第7回</span>
                              <span className="text-[10px] text-stone-400">2023.11.05</span>
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">新しい表現に積極的に挑戦している姿勢がとても良いです！</p>
                          </div>
                          <div className="bg-white/60 p-4 rounded-lg border border-gray-200/50">
                            <div className="flex justify-between mb-1">
                              <span className="text-[10px] font-bold text-stone-500 uppercase">第6回</span>
                              <span className="text-[10px] text-stone-400">2023.10.30</span>
                            </div>
                            <p className="text-sm text-stone-600 leading-relaxed">文章の構成がスッキリして読みやすくなりました。</p>
                          </div>
                          <div className="bg-white/60 p-4 rounded-lg border border-gray-200/50 opacity-60">
                            <div className="flex justify-between mb-1">
                              <span className="text-[10px] font-bold text-stone-500 uppercase">第1回〜第5回</span>
                            </div>
                            <p className="text-sm text-stone-500 leading-relaxed italic">過去のフィードバックが蓄積されています。</p>
                          </div>
                        </>
                      ) : (
                        commentItems.map((it, idx) => (
                          <div
                            key={`${it.sessionIndex}-${idx}`}
                            className={idx === 0 ? 'bg-white p-4 rounded-lg shadow-sm border border-gray-200/50' : 'bg-white/60 p-4 rounded-lg border border-gray-200/50'}
                          >
                            <div className="flex justify-between mb-1">
                              <span className={`text-[10px] font-bold uppercase ${idx === 0 ? 'text-primary' : 'text-stone-500'}`}>
                                第{Number.isFinite(it.sessionIndex) ? it.sessionIndex : '—'}回
                              </span>
                              <span className="text-[10px] text-stone-400">{formatSessionDate(it.publishedAt)}</span>
                            </div>
                            <p className={`text-sm leading-relaxed ${idx === 0 ? 'text-indigo-950 font-medium' : 'text-stone-600'}`}>
                              {it.teacherComment ?? ''}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="p-10 bg-[#f3f4f6] relative">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                      <div className="md:row-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                        <h5 className="font-label text-[10px] font-black text-stone-400 uppercase tracking-widest mb-6">
                          Your Submission Rate
                          <br />
                          <span className="text-[11px] text-indigo-900">提出率</span>
                        </h5>
                        <div className="relative w-40 h-40 flex items-center justify-center mb-6">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle className="text-stone-100" cx="50" cy="50" fill="transparent" r="40" stroke="currentColor" strokeWidth="10" />
                            <circle
                              className="text-primary"
                              cx="50"
                              cy="50"
                              fill="transparent"
                              r="40"
                              stroke="currentColor"
                              strokeDasharray={DONUT_C}
                              strokeDashoffset={donutOffset}
                              strokeLinecap="round"
                              strokeWidth="10"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center">
                            <span className="font-headline text-4xl font-black text-indigo-950">{submissionPctDisplay}%</span>
                            <span className="text-[10px] font-bold text-stone-500 mt-1">
                              {publishedCount} / {sessionCount} 完了
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-on-surface-variant font-medium leading-relaxed mt-2">
                          今月の提出ノルマ達成まで
                          <br />
                          あと{tasksRemaining}つの課題です。
                        </p>
                      </div>
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                        <h5 className="font-label text-[10px] font-black text-stone-400 uppercase tracking-widest mb-4">
                          Global Average
                          <br />
                          <span className="text-[11px] text-indigo-900">全体平均</span>
                        </h5>
                        <div className="flex items-baseline gap-x-2 mb-4">
                          <span className="font-headline text-3xl font-black text-indigo-950">{globalAvgPctDisplay}%</span>
                          <span className="text-secondary font-bold text-[10px]">全体平均</span>
                        </div>
                        <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-stone-500" style={{ width: `${globalAvgPctDisplay}%` }} />
                        </div>
                      </div>
                      <div className="bg-primary p-6 rounded-xl shadow-lg flex flex-col justify-center relative overflow-hidden">
                        <div
                          className="absolute inset-0 opacity-10 pointer-events-none"
                          style={{
                            backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
                            backgroundSize: '12px 12px',
                          }}
                        />
                        <h5 className="font-label text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-4 relative z-10">
                          Performance Rank
                          <br />
                          <span className="text-[11px] text-white">成績ランク</span>
                        </h5>
                        <div className="flex items-center gap-x-4 relative z-10">
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined">military_tech</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="font-headline text-2xl font-black text-white">上位 35%</span>
                            <span className="text-[10px] text-indigo-200 font-bold">全受講生中の位置付け</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <footer className="mt-20 flex flex-col md:flex-row items-center justify-between border-t border-gray-200 pt-10 pb-20">
                <div className="flex gap-x-12 mb-8 md:mb-0">
                  <div className="text-center md:text-left">
                    <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Total Lessons</span>
                    <span className="font-headline text-3xl font-bold text-indigo-950">128</span>
                  </div>
                  <div className="text-center md:text-left">
                    <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Words Written</span>
                    <span className="font-headline text-3xl font-bold text-indigo-950">42.5k</span>
                  </div>
                  <div className="text-center md:text-left">
                    <span className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Success Rate</span>
                    <span className="font-headline text-3xl font-bold text-indigo-950">92%</span>
                  </div>
                </div>
                <div className="flex gap-x-4">
                  <button
                    type="button"
                    className="px-8 py-3 bg-white text-indigo-950 font-bold text-xs uppercase tracking-widest rounded hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm"
                  >
                    Download PDF Report
                  </button>
                  <button
                    type="button"
                    className="px-8 py-3 ink-gradient text-white font-bold text-xs uppercase tracking-widest rounded shadow-xl shadow-primary/20"
                  >
                    Start New Manuscript
                  </button>
                </div>
              </footer>
            </div>
          </main>
        </div>
      </div>

      {/* ——— Mobile (Stitch) ——— */}
      <div className="lg:hidden bg-[#f5f5f5] font-body text-on-surface selection:bg-primary-fixed-dim">
        <header className="bg-[#fff8ef]/60 dark:bg-[#1e1b13]/60 backdrop-blur-xl fixed top-0 w-full z-50">
          <div className="flex justify-between items-center px-6 h-16 w-full max-w-7xl mx-auto">
            <h1 className="Manrope display-lg tracking-[-0.02em] font-bold uppercase text-lg tracking-[0.05em] text-[#000666] dark:text-[#fbf3e4]">
              STUDENT ATELIER
            </h1>
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-[#000666] dark:text-[#a0f399] hover:opacity-80 transition-opacity cursor-pointer">
                notifications
              </span>
              <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant/15">
                <img
                  alt=""
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCBqih0LsOY3BSBG9Zb8a02CTHz6sRV5T-iqDQz_679EmIk0FTrM7vCCP_1bdjWCRRB0TQnlSXvUvvbsnkn00x3Q4NTq5CkOpXlJDK7ZnhuexJ4nGr52-7h7wR75RmQvaVp_rE7CMctuzQH4wQwKjVDnKvP37uL8jicrGXewNrmNwjCcREgk-gJMyjilmbtPF1B7L3BhG95uxxSDBtZXWmAG-EaUK_3y-iyzlMqGs8neHn_6czU4Sszo36WmdVn02TAN06ZWNq-5JY"
                />
              </div>
            </div>
          </div>
        </header>
        <main className="pt-24 pb-32 px-5 max-w-md mx-auto space-y-10">
          <section className="space-y-2">
            <span className="font-label text-xs tracking-[0.1em] text-on-surface-variant uppercase">Academic Insight</span>
            <h2 className="font-headline text-2xl font-bold tracking-tight text-primary">学習到達度の詳細分析</h2>
            <p className="text-on-surface-variant text-sm leading-relaxed">
              直近10回のセッションに基づいた、あなたの文章スタイルの傾向と改善点です。
            </p>
          </section>
          <section className="grid grid-cols-3 gap-3">
            <div className="bg-surface-container-lowest p-4 rounded-xl flex flex-col items-center text-center">
              <span className="font-label text-[10px] text-on-surface-variant uppercase mb-1">Total Lessons</span>
              <span className="font-headline text-xl font-bold text-primary">128</span>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl flex flex-col items-center text-center">
              <span className="font-label text-[10px] text-on-surface-variant uppercase mb-1">Words Written</span>
              <span className="font-headline text-xl font-bold text-primary">42.5k</span>
            </div>
            <div className="bg-surface-container-lowest p-4 rounded-xl flex flex-col items-center text-center">
              <span className="font-label text-[10px] text-on-surface-variant uppercase mb-1">Success Rate</span>
              <span className="font-headline text-xl font-bold text-secondary">92%</span>
            </div>
          </section>
          <section className="bg-surface-container-low rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="font-headline text-lg font-bold text-primary">セッション別添削率の推移</h3>
                <p className="text-xs text-on-surface-variant">Past 10 Sessions</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-on-surface-variant block">AVG. RATE</span>
                <span className="font-headline text-xl font-bold text-primary">{avgCorrectionPct}%</span>
              </div>
            </div>
            <div className="h-40 flex items-end justify-between gap-2 relative">
              {/* [FIX] 데스크톱과 동일 — 첨삭 평균(summary.correctionRate) 기준선 */}
              <div
                className="absolute w-full border-t border-dashed border-primary/20 z-0"
                style={{ bottom: `${avgCorrectionPct}%` }}
              />
              {sessionsSorted.length === 0
                ? Array.from({ length: 10 }).map((_, i) => (
                    <div key={`mb-${i}`} className="w-full bg-primary/10 rounded-t-sm h-[5%]" />
                  ))
                : sessionsSorted.map((s) => {
                    const h = correctionBarHeightPct(s.correctionRate)
                    const isHi =
                      highlightSessionIndex >= 0 &&
                      Number.isFinite(s.index) &&
                      s.index === highlightSessionIndex &&
                      s.correctionRate != null
                    return (
                      <div key={`mbar-${s.index}`} className="w-full flex flex-col items-center justify-end flex-1 min-w-0 relative">
                        {isHi ? (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary whitespace-nowrap">
                            {currentSessionAccuracy}%
                          </div>
                        ) : null}
                        <div
                          className={`w-full rounded-t-sm ${isHi ? 'bg-primary' : 'bg-primary/10'}`}
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    )
                  })}
            </div>
          </section>
          <section className="space-y-4">
            <h3 className="font-headline text-lg font-bold text-primary">頻出ミス</h3>
            <div className="grid grid-cols-1 gap-3">
              {topFreq.cats.length === 0
                ? [0, 1, 2].map((slot) => (
                    <div
                      key={`mf-f-${slot}`}
                      className={`group bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between border-l-4 ${MOBILE_MISTAKE_BORDER[slot]}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${MOBILE_MISTAKE_ICON_WRAP[slot]}`}>
                          <span
                            className={`material-symbols-outlined ${MOBILE_MISTAKE_ICON_COLOR[slot]}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {MOBILE_MISTAKE_ICONS[slot]}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold block text-on-surface">
                            {slot === 0 ? '助詞の使い分け' : slot === 1 ? '謙譲語の混同' : '漢字の誤変換'}
                          </span>
                          <span className="text-xs text-on-surface-variant">
                            {slot === 0 ? 'Particle Usage' : slot === 1 ? 'Honorific Confusions' : 'Kanji Conversion'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-headline text-xl font-bold ${MOBILE_MISTAKE_NUM_COLOR[slot]}`}>
                          {slot === 0 ? '12' : slot === 1 ? '8' : '5'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant ml-1 uppercase">Times</span>
                      </div>
                    </div>
                  ))
                : topFreq.cats.map((c, i) => {
                    const slot = i % 3
                    const label = CATEGORY_LABEL_JA[c.category] ?? c.category
                    return (
                      <div
                        key={`mcat-${c.category}-${i}`}
                        className={`group bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between border-l-4 ${MOBILE_MISTAKE_BORDER[slot]}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${MOBILE_MISTAKE_ICON_WRAP[slot]}`}>
                            <span
                              className={`material-symbols-outlined ${MOBILE_MISTAKE_ICON_COLOR[slot]}`}
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              {MOBILE_MISTAKE_ICONS[slot]}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold block text-on-surface">{label}</span>
                            <span className="text-xs text-on-surface-variant">{c.category}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`font-headline text-xl font-bold ${MOBILE_MISTAKE_NUM_COLOR[slot]}`}>
                            {typeof c.fragmentCount === 'number' && Number.isFinite(c.fragmentCount) ? c.fragmentCount : 0}
                          </span>
                          <span className="text-[10px] text-on-surface-variant ml-1 uppercase">Times</span>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </section>
          <section className="bg-surface-container-low rounded-2xl p-6 space-y-6">
            <h3 className="font-headline text-lg font-bold text-primary">評価フィードバック</h3>
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>文法の正確性</span>
                  <span className="font-headline font-bold">{grammarPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-secondary" style={{ width: `${grammarPct}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>語彙の適切さ</span>
                  <span className="font-headline font-bold">{vocabPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-primary-container" style={{ width: `${vocabPct}%` }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>文脈の流暢さ</span>
                  <span className="font-headline font-bold">{contextPct}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-secondary" style={{ width: `${contextPct}%` }} />
                </div>
              </div>
            </div>
          </section>
          <section className="grid grid-cols-1 gap-4">
            <div className="bg-surface-container-lowest rounded-2xl p-6 flex items-center justify-between">
              <div className="space-y-3">
                <h3 className="font-label text-xs font-bold tracking-widest text-on-surface-variant">SUBMISSION STATUS</h3>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm">個人進捗 {submissionPctDisplay}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-surface-variant" />
                    <span className="text-sm text-on-surface-variant">全体平均 {globalAvgPctDisplay}%</span>
                  </div>
                </div>
              </div>
              <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
                  <circle className="text-surface-container-low" cx="48" cy="48" fill="transparent" r="40" stroke="currentColor" strokeWidth="8" />
                  <circle
                    className="text-primary"
                    cx="48"
                    cy="48"
                    fill="transparent"
                    r="40"
                    stroke="currentColor"
                    strokeDasharray={DONUT_C}
                    strokeDashoffset={donutOffset}
                    strokeLinecap="round"
                    strokeWidth="8"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-headline text-xl font-extrabold text-primary leading-none">
                    {publishedCount}/{sessionCount}
                  </span>
                  <span className="text-[10px] text-on-surface-variant uppercase">Tasks</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="w-full bg-primary text-on-primary py-5 rounded-xl font-bold flex items-center justify-center gap-3 active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined">analytics</span>
              <span>総評を確認する</span>
            </button>
          </section>
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-headline text-lg font-bold text-primary">講師のひとことログ</h3>
              <span className="text-xs text-primary font-bold cursor-pointer hover:underline">View All</span>
            </div>
            <div className="space-y-3">
              <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3">
                  <span className="bg-secondary-container text-on-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full">New</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center border border-outline-variant/15">
                    <img
                      alt=""
                      className="w-full h-full object-cover rounded-full"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZa7oqYt6GKpQjMgY3O7TVmaEoLQ0XmkmJQRRLT-m8M9mi4ZKqqEGer6Lzh52x1n80rAUxkatiY6u7AGeqIwpLTSGdtD9FGIralsiVU43Uc5ihsVBgIrQEXH7UhRG59FsDyRJLZYp25snkEK7QhVWE1CMsHWPNAYHOKspGZXmrGhgdfkjCEK1RVC1m8lfCEaqor-iLgYNt16jVUdrYP6zGCUi4BTFEqH2C5j4ymp_B91L8wcyZ2-PU2fafT48YH8ccgX_7Xre9U3U"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-sm block">
                      Session{' '}
                      {firstComment != null && Number.isFinite(firstComment.sessionIndex) ? firstComment.sessionIndex : 10}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      {firstComment ? formatSessionDate(firstComment.publishedAt) : '2023.11.20'} | Instructor Maria
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-on-surface/80 italic">
                  「
                  {firstComment
                    ? firstComment.teacherComment
                    : '文末の表現がより自然になりましたね。特に接続詞の使い方が見違えるように良くなっています。この調子で進めていきましょう！'}
                  」
                </p>
              </div>
            </div>
          </section>
          <section className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="bg-surface-container-high text-on-surface py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              PDFダウンロード
            </button>
            <button
              type="button"
              className="bg-primary-container text-on-primary-container py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              新しい作文
            </button>
          </section>
        </main>
        <nav className="fixed bottom-0 left-0 w-full bg-[#fff8ef] dark:bg-[#1e1b13] flex justify-around items-center px-4 pb-safe h-20 z-50 border-t border-[#1e1b13]/15 shadow-[0_-10px_40px_rgba(30,27,19,0.04)]">
          <div className="flex flex-col items-center justify-center text-[#1e1b13]/40 dark:text-[#fbf3e4]/40 hover:text-[#000666] dark:hover:text-[#a0f399] transition-colors cursor-pointer">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="Plus Jakarta Sans body-sm font-medium text-[10px] mt-1">Dashboard</span>
          </div>
          <div className="flex flex-col items-center justify-center text-[#1e1b13]/40 dark:text-[#fbf3e4]/40 hover:text-[#000666] dark:hover:text-[#a0f399] transition-colors cursor-pointer">
            <span className="material-symbols-outlined">edit_note</span>
            <span className="Plus Jakarta Sans body-sm font-medium text-[10px] mt-1">Assignments</span>
          </div>
          <div className="flex flex-col items-center justify-center text-[#1e1b13]/40 dark:text-[#fbf3e4]/40 hover:text-[#000666] dark:hover:text-[#a0f399] transition-colors cursor-pointer">
            <span className="material-symbols-outlined">local_library</span>
            <span className="Plus Jakarta Sans body-sm font-medium text-[10px] mt-1">Library</span>
          </div>
          <div className="flex flex-col items-center justify-center text-[#000666] dark:text-[#a0f399] bg-[#fbf3e4] dark:bg-[#1e1b13] rounded-xl py-1 px-4 scale-90 duration-150">
            <span className="material-symbols-outlined">rate_review</span>
            <span className="Plus Jakarta Sans body-sm font-medium text-[10px] mt-1">Feedback</span>
          </div>
        </nav>
      </div>
    </div>
  )
}
