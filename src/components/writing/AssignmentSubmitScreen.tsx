import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../landing.css'
import LandingNav from '../landing/LandingNav'
import type { AccessContext } from '../../types/writingAccess'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPT = '.png,.jpg,.jpeg,.pdf'

/** 右サイドバー: 指定月の全週グリッド（前月・翌月の埋め込み日付を含む）。`today` と同じ年月日は selected */
function buildCalendarMonthCells(
  year: number,
  monthIndex: number,
  today: Date
): { key: string; day: number; muted: boolean; selected: boolean }[] {
  const firstDow = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const prevLast = new Date(year, monthIndex, 0).getDate()
  const out: { key: string; day: number; muted: boolean; selected: boolean }[] = []

  const isTodayInThisMonth = (d: number) =>
    today.getFullYear() === year && today.getMonth() === monthIndex && today.getDate() === d

  for (let i = 0; i < firstDow; i++) {
    const day = prevLast - firstDow + i + 1
    out.push({ key: `prev-${year}-${monthIndex}-${day}`, day, muted: true, selected: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    out.push({
      key: `cur-${year}-${monthIndex}-${d}`,
      day: d,
      muted: false,
      selected: isTodayInThisMonth(d),
    })
  }
  let next = 1
  while (out.length % 7 !== 0) {
    out.push({ key: `next-${year}-${monthIndex}-${next}`, day: next, muted: true, selected: false })
    next++
  }
  return out
}

function formatYearMonthJa(year: number, monthIndex: number): string {
  return `${year}年 ${monthIndex + 1}月`
}

function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = () => setNarrow(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return narrow
}

export type AssignmentTabKind = 'submit' | 'submitted' | 'correction'

export type AssignmentSubmitScreenProps = {
  accessContext: AccessContext
  /** 正規コース: 親コンポーネントが本文を保持 */
  text?: string
  onTextChange?: (value: string) => void
  onPrimarySubmit?: () => void
  onDraftSave?: () => void
  primarySubmitDisabled?: boolean
  primarySubmitLoading?: boolean
  textareaDisabled?: boolean
  /** 未指定時: trial のみ下書きボタン表示 */
  showDraftButton?: boolean
  desktopSlotBelowTabs?: ReactNode
  /** デスクトップ: 提出ボタン列の下（進捗表など） */
  desktopAfterSubmitSlot?: ReactNode
  /** デスクトップ右:「最近提出リスト」カード内の実データ（未指定時は案内文のみ） */
  desktopSidebarRecentSlot?: ReactNode
  mobileSlotBelowTabs?: ReactNode
  /** デスクトップ課題カード（未指定時は Stitch デモ） */
  assignmentTitle?: string
  assignmentDescription?: string
  desktopTextareaPlaceholder?: string
  mobileTextareaPlaceholder?: string
  /** 未指定時は Stitch デモの Requirement ブロック */
  requirementBlockDesktop?: ReactNode
  /** メインカラム先頭（課題UIより上）。/writing/app のアカウント帯・管理者プレビュー等 */
  mainTopSlot?: ReactNode
  /** `/writing/app` 試用: 上部 LandingNav をブランドのみにし、アカウントは mainTopSlot に集約 */
  landingNavVariant?: 'default' | 'minimal'
  /**
   * Parent drives 「提出 / 既提出 / 添削完了」 (Admin sandbox, trial, student, regular on /writing/app).
   * When false, UI stays on 提出 with non-interactive tab styling (legacy).
   */
  controlledAssignmentTab?: boolean
  assignmentTab?: AssignmentTabKind
  onAssignmentTabChange?: (tab: AssignmentTabKind) => void
  /** 既提出タブで表示する提出済み本文 */
  submittedTabBody?: string | null
  /** 既提出タブ: ステータス一行（例: 添削中） */
  submittedTabStatusJa?: string | null
  /** 添削完了タブ（学習者）: 説明一行 */
  correctionTabStatusJa?: string | null
  /** true: 添削完了タブで学習者向け本文表示（Sandbox のプレースホルダーにしない） */
  showLearnerCorrectionTab?: boolean
  /**
   * When set (e.g. published result from GET /api/writing/results/:id), shown instead of the plain 「提出本文」 card.
   * Falls back to submitted body-only UI when omitted.
   */
  correctionTabDetailSlot?: ReactNode
  /**
   * Real learner flows (trial / regular mail / logged-in student on /writing/app).
   * When set (e.g. 500): do not truncate input; show count as current/max; disable submit when over.
   * Omit for admin sandbox (legacy 400 / 1200 + slice behavior).
   */
  studentBodyMaxChars?: number
}

const DEFAULT_ASSIGNMENT_TITLE = '約束'
const DEFAULT_ASSIGNMENT_BODY = `私たちは日常生活のなかでさまざまな「約束」を交わしながら暮らしています。友人との約束、自分への決意、あるいは社会的なルールなど、形はさまざまです。あなたにとって一番大切な約束は何ですか。普段、時間や内容を守るタイプですか。約束の意味と、ご自身の経験について韓国語で書いてみましょう。`

/**
 * 作文提出 UI（Stitch）— trial / 正規で共通。提出 API は親または将来の loader で接続。
 */
export default function AssignmentSubmitScreen({
  accessContext,
  text: controlledText,
  onTextChange,
  onPrimarySubmit,
  onDraftSave,
  primarySubmitDisabled = false,
  primarySubmitLoading = false,
  textareaDisabled = false,
  showDraftButton: showDraftButtonProp,
  desktopSlotBelowTabs,
  desktopAfterSubmitSlot,
  desktopSidebarRecentSlot,
  mobileSlotBelowTabs,
  assignmentTitle,
  assignmentDescription,
  desktopTextareaPlaceholder,
  mobileTextareaPlaceholder,
  requirementBlockDesktop,
  mainTopSlot,
  landingNavVariant = 'default',
  controlledAssignmentTab = false,
  assignmentTab = 'submit',
  onAssignmentTabChange,
  submittedTabBody = null,
  submittedTabStatusJa = null,
  correctionTabStatusJa = null,
  showLearnerCorrectionTab = false,
  correctionTabDetailSlot,
  studentBodyMaxChars,
}: AssignmentSubmitScreenProps) {
  const navigate = useNavigate()
  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

  const narrow = useNarrowScreen()
  const useStudentCharLimit = studentBodyMaxChars != null && studentBodyMaxChars > 0
  const legacyMaxChars = narrow ? 1200 : 400
  const maxChars = useStudentCharLimit ? studentBodyMaxChars! : legacyMaxChars

  /** /writing/app 学生提出欄 */
  const STUDENT_BODY_OVER_MSG =
    '文字数が500文字を超えています。500文字以内に収めてください。'

  /** ページ表示時点の「今日」で右サイドバー暦を固定（マウント時の年月） */
  const [calendarToday] = useState(() => new Date())
  const calendarYear = calendarToday.getFullYear()
  const calendarMonthIndex = calendarToday.getMonth()
  const calendarTitle = formatYearMonthJa(calendarYear, calendarMonthIndex)
  const calendarCells = useMemo(
    () => buildCalendarMonthCells(calendarYear, calendarMonthIndex, calendarToday),
    [calendarYear, calendarMonthIndex, calendarToday]
  )

  const [internalText, setInternalText] = useState('')
  const text = controlledText !== undefined ? controlledText : internalText
  const setText = useCallback(
    (next: string) => {
      if (useStudentCharLimit) {
        if (onTextChange) onTextChange(next)
        else setInternalText(next)
        return
      }
      const sliced = next.slice(0, maxChars)
      if (onTextChange) onTextChange(sliced)
      else setInternalText(sliced)
    },
    [maxChars, onTextChange, useStudentCharLimit]
  )

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputMobileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (controlledText === undefined && !useStudentCharLimit) {
      setInternalText((t) => (t.length > maxChars ? t.slice(0, maxChars) : t))
    }
  }, [maxChars, controlledText, useStudentCharLimit])

  const showDraftButton = showDraftButtonProp ?? accessContext.type === 'trial'

  const count = text.length
  const bodyOverStudentLimit = useStudentCharLimit && count > maxChars

  const titleResolved = assignmentTitle ?? DEFAULT_ASSIGNMENT_TITLE
  const bodyResolved = assignmentDescription ?? DEFAULT_ASSIGNMENT_BODY
  const phDesktop = desktopTextareaPlaceholder ?? 'ここに韓国語で文章を入力してください...'
  const phMobile = mobileTextareaPlaceholder ?? 'ここに論説を書き始めてください...'

  const activeTab: AssignmentTabKind = controlledAssignmentTab ? assignmentTab : 'submit'
  const showSubmitColumn = activeTab === 'submit'
  const showSubmittedReadOnly = controlledAssignmentTab && activeTab === 'submitted'
  const showCorrectionLearner =
    controlledAssignmentTab && activeTab === 'correction' && showLearnerCorrectionTab

  const submittedBodyDisplay =
    submittedTabBody != null && String(submittedTabBody).trim().length > 0
      ? submittedTabBody
      : null

  const desktopTabClass = (t: AssignmentTabKind) =>
    activeTab === t
      ? 'pb-4 text-lg font-bold border-b-2 border-[#000666] text-[#000666] transition-colors'
      : 'pb-4 text-lg font-medium text-[#1e1b13]/50 hover:text-[#000666] transition-colors'

  const mobileTabClass = (t: AssignmentTabKind) =>
    activeTab === t
      ? 'flex-1 py-2.5 text-sm font-medium rounded-lg bg-[#000666] text-white shadow-sm'
      : 'flex-1 py-2.5 text-sm font-medium rounded-lg text-[#454652] hover:bg-black/5 transition-colors'

  const pickTab = (t: AssignmentTabKind) => {
    if (!controlledAssignmentTab || !onAssignmentTabChange) return
    onAssignmentTabChange(t)
  }

  /** 添削完了タブ: 課題カードはデフォルト折りたたみ（提出タブは従来どおり常時表示）。 */
  const [correctionAssignmentExpanded, setCorrectionAssignmentExpanded] = useState(false)
  useEffect(() => {
    if (!controlledAssignmentTab || assignmentTab !== 'correction') {
      setCorrectionAssignmentExpanded(false)
    }
  }, [controlledAssignmentTab, assignmentTab])

  const validateFile = useCallback((f: File): boolean => {
    const okType = /^(image\/(png|jpeg)|application\/pdf)$/i.test(f.type) || /\.(png|jpg|jpeg|pdf)$/i.test(f.name)
    if (!okType) return false
    if (f.size > MAX_FILE_BYTES) return false
    return true
  }, [])

  const onFiles = useCallback(
    (files: FileList | null) => {
      const f = files?.[0]
      if (!f) return
      if (validateFile(f)) setSelectedFile(f)
    },
    [validateFile]
  )

  const handleDraft = () => {
    if (onDraftSave) onDraftSave()
    else console.log('draft save clicked')
  }

  const handleSubmit = () => {
    if (onPrimarySubmit) onPrimarySubmit()
    else console.log('submit clicked')
  }

  const mobileSubmit = handleSubmit

  const assignmentThemeDesktopInner = (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="flex-1">
        <div className="mb-6">
          <span className="bg-[#000666]/10 text-[#000666] px-3 py-1 rounded-full text-xs font-bold font-['Manrope',sans-serif] tracking-widest uppercase">
            Theme
          </span>
          <h2 className="text-2xl font-bold text-[#1e1b13] mt-3 font-['Manrope',sans-serif]">{titleResolved}</h2>
        </div>
        <div className="bg-white p-6 rounded-lg border border-[#c6c5d4]/10 mb-6">
          <p className="text-[#1e1b13] font-['Plus_Jakarta_Sans',sans-serif] leading-relaxed whitespace-pre-line">
            {bodyResolved}
          </p>
        </div>
        {requirementBlockDesktop ?? (
          <div className="space-y-4">
            <h3 className="font-bold text-[#000666] flex items-center gap-2 font-['Manrope',sans-serif]">
              <span className="material-symbols-outlined text-sm trial-writing-ms">info</span>
              課題要件
            </h3>
            <p className="text-sm text-[#454652] mb-4">下記に提示された文型を、必ず2つ以上使用すること。</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/60 p-4 rounded-lg border-l-4 border-[#000666]">
                <p className="font-bold text-sm">1. ○-기로 약속하다</p>
                <p className="text-xs text-[#454652] mt-1">例：다음 주말에 친구와 영화를 보기로 약속했다.</p>
              </div>
              <div className="bg-white/60 p-4 rounded-lg border-l-4 border-[#1b6d24]">
                <p className="font-bold text-sm">2. ○-하는 편이다</p>
                <p className="text-xs text-[#454652] mt-1">例：나는 약속 시간을 잘 지키는 편이다.</p>
              </div>
              <div className="bg-white/60 p-4 rounded-lg border-l-4 border-[#4c56af]">
                <p className="font-bold text-sm">3. ○-기 때문에</p>
                <p className="text-xs text-[#454652] mt-1">例：중요한 약속이기 때문에 늦으면 안 된다.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const mobileLessonIntroBlock = (
    <div className="mb-10">
      <div className="inline-block px-3 py-1 rounded-full bg-black/5 text-[10px] font-['Manrope',sans-serif] font-bold tracking-widest text-[#000666] mb-3">
        LESSON 04
      </div>
      <h2 className="font-['Manrope',sans-serif] text-3xl font-extrabold text-[#000666] leading-tight tracking-tighter mb-4">
        現代社会における
        <br />
        デジタル技術の役割
      </h2>
      <div className="flex flex-wrap items-center gap-4 text-[#454652] text-sm">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base trial-writing-ms">calendar_today</span>
          <span>期限: 2024年5月24日</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#1b6d24]">
          <span className="material-symbols-outlined text-base trial-writing-ms" style={{ fontVariationSettings: "'FILL' 1" }}>
            stars
          </span>
          <span className="font-semibold">重要課題</span>
        </div>
      </div>
    </div>
  )

  const mobileRequirementCard = (
    <div className="bg-white p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#bdc2ff]/10 rounded-full -mr-12 -mt-12" />
      <h3 className="font-['Manrope',sans-serif] font-bold text-lg mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[#000666] trial-writing-ms">description</span>
        課題要件
      </h3>
      <ul className="space-y-3 text-sm text-[#454652] leading-relaxed">
        <li className="flex gap-3">
          <span className="text-[#000666] font-bold">・</span>
          <span>800文字以上 1200文字以内の論説文として作成してください。</span>
        </li>
        <li className="flex gap-3">
          <span className="text-[#000666] font-bold">・</span>
          <span>具体的な事例を最低2つ引用し、論理的な裏付けを行ってください。</span>
        </li>
        <li className="flex gap-3">
          <span className="text-[#000666] font-bold">・</span>
          <span>敬体（です・ます調）ではなく、常体（だ・である調）を使用してください。</span>
        </li>
      </ul>
    </div>
  )

  const submitDisabled = primarySubmitDisabled || primarySubmitLoading || bodyOverStudentLimit

  return (
    <>
      <style>{`
        .trial-writing-ms { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; vertical-align: middle; }
        .trial-writing-scrollbar::-webkit-scrollbar { width: 4px; }
        .trial-writing-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .trial-writing-scrollbar::-webkit-scrollbar-thumb { background: #e9e2d3; border-radius: 10px; }
      `}</style>

      {/* /writing ランディングと同一ヘッダー */}
      <div className="landing-stitch-root">
        <LandingNav goApp={goApp} variant={landingNavVariant} />
      </div>

      {/* ——— Desktop (md+) ——— */}
      <div className="relative hidden min-h-screen font-['Plus_Jakarta_Sans',sans-serif] text-[#1e1b13] bg-[#F5F5F5] trial-writing-scrollbar md:block">
        <aside className="fixed left-0 top-0 z-40 flex h-full w-64 flex-col gap-2 bg-[#F5F5F5] pt-20">
          <div className="px-6 py-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#e9e2d3] overflow-hidden border-2 border-[#000666]/10">
                <img
                  alt=""
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBf38cpp30-_c-DF5-os4vw7U8Ck-EY8eMFC4bM745mzJMT1Ra9MnVR2EXoSnvnOKgGWYHXMsaHiOcbHR3YMdNO8TBw55I4DTomvDyHYkdwLu3sfR_ZpXi32QtUFaZTBgSvqviCJvqJW0SFnYX1CLBQ6odEdsSxtAgUr_EUeH4EKyzJQI6ByrxohVPhH86Uh9Wzx8sG_8d_AeidVf0OYToW05DTZ4KnVMkPXmZp6xJvZNNLEBIEfdL9Z8CwVJQOARWRvUNkge3gutM"
                />
              </div>
              <div>
                <p className="text-lg font-black text-[#1e1b13] font-['Manrope',sans-serif]">学習者様</p>
                <p className="text-[10px] uppercase tracking-widest text-[#1e1b13]/60 font-['Manrope',sans-serif]">
                  中級韓国語コース
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 pr-4">
            <span className="flex items-center gap-3 text-[#1e1b13]/70 ml-4 pl-4 py-3 rounded-l-full font-['Manrope',sans-serif] text-sm uppercase tracking-widest cursor-default">
              <span className="material-symbols-outlined trial-writing-ms">dashboard</span>
              <span>ダッシュボード</span>
            </span>
            <span className="flex items-center gap-3 bg-white text-[#000666] rounded-l-full ml-4 pl-4 py-3 font-bold font-['Manrope',sans-serif] text-sm uppercase tracking-widest">
              <span className="material-symbols-outlined trial-writing-ms">edit_note</span>
              <span>課題提出</span>
            </span>
            <span className="flex items-center gap-3 text-[#1e1b13]/70 ml-4 pl-4 py-3 rounded-l-full font-['Manrope',sans-serif] text-sm uppercase tracking-widest cursor-default">
              <span className="material-symbols-outlined trial-writing-ms">history_edu</span>
              <span>添削履歴</span>
            </span>
            <span className="flex items-center gap-3 text-[#1e1b13]/70 ml-4 pl-4 py-3 rounded-l-full font-['Manrope',sans-serif] text-sm uppercase tracking-widest cursor-default">
              <span className="material-symbols-outlined trial-writing-ms">calendar_month</span>
              <span>学習カレンダー</span>
            </span>
          </div>
        </aside>

        <div className="hidden min-h-screen w-full min-w-0 flex-row md:flex">
          {/* fixed サイドバー幅分の in-flow 予約 */}
          <div className="w-64 shrink-0" aria-hidden="true" />

          <main className="flex min-h-screen min-w-0 flex-1 flex-col bg-[#F5F5F5] pt-20">
          {mainTopSlot ? (
            <div className="w-full shrink-0 px-8 pt-1 pb-2 lg:px-12">
              <div className="mx-auto w-full max-w-6xl">{mainTopSlot}</div>
            </div>
          ) : null}
          <div className="max-w-[1400px] mx-auto flex w-full min-w-0 flex-1 flex-col lg:flex-row">
            <div className="flex-1 p-8 lg:p-12">
              <div className="max-w-4xl mx-auto">
                <header className="mb-10">
                  <h1 className="text-4xl font-extrabold text-[#000666] font-['Manrope',sans-serif] tracking-tight mb-6">
                    課題提出
                  </h1>
                  <div className="flex gap-8 border-b border-[#1e1b13]/10">
                    <button
                      type="button"
                      className={
                        !controlledAssignmentTab
                          ? 'pb-4 text-lg font-bold border-b-2 border-[#000666] text-[#000666] transition-colors'
                          : desktopTabClass('submit')
                      }
                      onClick={() => pickTab('submit')}
                    >
                      提出
                    </button>
                    <button
                      type="button"
                      className={
                        !controlledAssignmentTab
                          ? 'pb-4 text-lg font-medium text-[#1e1b13]/50 hover:text-[#000666] transition-colors'
                          : desktopTabClass('submitted')
                      }
                      onClick={() => pickTab('submitted')}
                    >
                      既提出
                    </button>
                    <button
                      type="button"
                      className={
                        !controlledAssignmentTab
                          ? 'pb-4 text-lg font-medium text-[#1e1b13]/50 hover:text-[#000666] transition-colors'
                          : desktopTabClass('correction')
                      }
                      onClick={() => pickTab('correction')}
                    >
                      添削完了
                    </button>
                  </div>
                </header>

                {desktopSlotBelowTabs}

                <section
                  className={
                    showCorrectionLearner
                      ? 'rounded-xl mb-8 shadow-sm bg-white border border-[#c6c5d4]/10 overflow-hidden'
                      : 'rounded-xl p-8 mb-8 shadow-sm bg-white'
                  }
                >
                  {showCorrectionLearner ? (
                    <>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left font-['Manrope',sans-serif] text-sm font-bold text-[#000666] bg-[#eef3fb] hover:bg-[#e4ecf8] transition-colors border-b border-[#000666]/10"
                        aria-expanded={correctionAssignmentExpanded}
                        onClick={() => setCorrectionAssignmentExpanded((v) => !v)}
                      >
                        <span>課題内容を見る</span>
                        <span className="material-symbols-outlined text-[#000666] trial-writing-ms text-xl shrink-0">
                          {correctionAssignmentExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </button>
                      {correctionAssignmentExpanded ? (
                        <div className="p-8 pt-6">{assignmentThemeDesktopInner}</div>
                      ) : null}
                    </>
                  ) : (
                    <div className="p-8">{assignmentThemeDesktopInner}</div>
                  )}
                </section>

                <section className="space-y-6">
                  {showSubmitColumn ? (
                    <>
                      <div className="relative">
                        <textarea
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                          disabled={textareaDisabled}
                          className="w-full min-h-80 bg-white p-8 rounded-xl border-none shadow-[0_10px_40px_rgba(30,27,19,0.04)] focus:ring-2 focus:ring-[#000666]/20 text-lg leading-relaxed font-['Plus_Jakarta_Sans',sans-serif] placeholder:text-[#1e1b13]/20 disabled:bg-[#f5f5f5]/80 disabled:cursor-not-allowed"
                          placeholder={phDesktop}
                        />
                        <div className="absolute bottom-4 right-6 text-sm font-['Manrope',sans-serif] tracking-widest text-[#1e1b13]/40">
                          {useStudentCharLimit ? count : Math.min(count, maxChars)} / {maxChars}
                        </div>
                      </div>
                      {useStudentCharLimit && bodyOverStudentLimit ? (
                        <p className="text-sm text-[#b91c1c] mb-4 font-medium px-1" role="alert">
                          {STUDENT_BODY_OVER_MSG}
                        </p>
                      ) : null}

                      <div className="mt-8">
                        <p className="text-sm font-bold text-[#454652] mb-3 font-['Manrope',sans-serif] flex items-center gap-2">
                          <span className="material-symbols-outlined text-base trial-writing-ms">attachment</span>
                          手書き原稿のアップロード
                        </p>
                        <div
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOver(true)
                          }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault()
                            setDragOver(false)
                            onFiles(e.dataTransfer.files)
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed border-[#c6c5d4]/30 rounded-2xl p-12 bg-[#fbf3e4]/30 hover:bg-[#fbf3e4]/50 transition-colors cursor-pointer group flex flex-col items-center justify-center text-center ${
                            dragOver ? 'bg-[#fbf3e4]/60' : ''
                          }`}
                        >
                          <div className="w-16 h-16 bg-[#f5edde] rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                            <span className="material-symbols-outlined text-4xl text-[#454652]/40 trial-writing-ms">cloud_upload</span>
                          </div>
                          <p className="text-[#1e1b13] font-medium mb-1">
                            画像またはPDFをドラッグ＆ドロップ、または{' '}
                            <span className="text-[#000666] font-bold underline decoration-2 underline-offset-4">ファイルを選択</span>
                          </p>
                          {selectedFile ? (
                            <p className="text-xs text-[#000666] mt-2 font-['Manrope',sans-serif]">{selectedFile.name}</p>
                          ) : null}
                          <p className="text-[10px] text-[#454652]/60 font-['Manrope',sans-serif] tracking-wider uppercase mt-2">
                            MAX FILE SIZE: 10MB (PNG, JPG, PDF)
                          </p>
                          <input
                            ref={fileInputRef}
                            accept={ACCEPT}
                            className="hidden"
                            type="file"
                            onChange={(e) => onFiles(e.target.files)}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-4 mt-10 pb-20 lg:pb-0">
                        {showDraftButton ? (
                          <button
                            type="button"
                            onClick={handleDraft}
                            className="px-8 py-3 rounded-lg font-bold text-[#000666] border border-[#000666]/20 hover:bg-[#000666]/5 transition-colors"
                          >
                            下書き保存
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={submitDisabled}
                          className="px-8 py-3 rounded-lg font-bold bg-[#000666] text-white shadow-lg hover:opacity-90 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {primarySubmitLoading ? '提出中…' : '課題を提出する'}
                        </button>
                      </div>
                    </>
                  ) : showSubmittedReadOnly ? (
                    <div className="pb-20 lg:pb-0">
                      {submittedTabStatusJa ? (
                        <p className="text-sm font-bold text-[#000666] mb-2 font-['Manrope',sans-serif]">
                          {submittedTabStatusJa}
                        </p>
                      ) : null}
                      <p className="text-sm font-bold text-[#454652] mb-3 font-['Manrope',sans-serif]">提出済みの本文</p>
                      <div className="w-full min-h-80 bg-white p-8 rounded-xl border border-[#c6c5d4]/10 shadow-[0_10px_40px_rgba(30,27,19,0.04)] text-lg leading-relaxed font-['Plus_Jakarta_Sans',sans-serif] text-[#1e1b13] whitespace-pre-wrap">
                        {submittedBodyDisplay ?? '（提出本文がありません）'}
                      </div>
                    </div>
                  ) : showCorrectionLearner ? (
                    <div className="pb-20 lg:pb-0">
                      {correctionTabStatusJa ? (
                        <p className="text-sm font-bold text-[#000666] mb-3 font-['Manrope',sans-serif]">
                          {correctionTabStatusJa}
                        </p>
                      ) : null}
                      {correctionTabDetailSlot != null ? (
                        correctionTabDetailSlot
                      ) : (
                        <>
                          <p className="text-sm font-bold text-[#454652] mb-3 font-['Manrope',sans-serif]">提出本文</p>
                          <div className="w-full min-h-80 bg-white p-8 rounded-xl border border-[#c6c5d4]/10 shadow-[0_10px_40px_rgba(30,27,19,0.04)] text-lg leading-relaxed font-['Plus_Jakarta_Sans',sans-serif] text-[#1e1b13] whitespace-pre-wrap">
                            {submittedBodyDisplay ?? '（本文がありません）'}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="pb-20 lg:pb-0">
                      <p className="text-sm text-[#454652] font-['Manrope',sans-serif]">
                        Admin Sandbox では「添削完了」のプレビューはありません。本番の添削完了は添削履歴からご確認ください。
                      </p>
                    </div>
                  )}
                  {desktopAfterSubmitSlot}
                </section>
              </div>
            </div>

            <aside className="w-full lg:w-80 p-8 lg:p-12 lg:pl-4 bg-[#F5F5F5]">
              <div className="sticky top-24 space-y-10">
                <section className="bg-white p-6 rounded-2xl shadow-[0_10px_40px_rgba(30,27,19,0.04)]">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-['Manrope',sans-serif] font-bold text-[#000666]">{calendarTitle}</h4>
                    <div className="flex gap-2">
                      <span className="material-symbols-outlined text-[#1e1b13]/40 cursor-pointer hover:text-[#000666] trial-writing-ms">
                        chevron_left
                      </span>
                      <span className="material-symbols-outlined text-[#1e1b13]/40 cursor-pointer hover:text-[#000666] trial-writing-ms">
                        chevron_right
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-y-4 text-center text-[10px] font-bold font-['Manrope',sans-serif] tracking-widest text-[#1e1b13]/40 uppercase mb-4">
                    <span>Sun</span>
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span>Sat</span>
                  </div>
                  <div className="grid grid-cols-7 gap-y-2 text-center text-sm font-medium">
                    {calendarCells.map((c) => {
                      const base =
                        'p-2 rounded-lg cursor-pointer relative flex flex-col items-center justify-center min-h-[2.25rem]'
                      if (c.muted) {
                        return (
                          <span key={c.key} className={`${base} text-[#1e1b13]/20`}>
                            {c.day}
                          </span>
                        )
                      }
                      if (c.selected) {
                        return (
                          <span key={c.key} className={`${base} bg-[#000666] text-white`}>
                            {c.day}
                            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full" />
                          </span>
                        )
                      }
                      return (
                        <span key={c.key} className={`${base} hover:bg-[#f5edde]`}>
                          {c.day}
                        </span>
                      )
                    })}
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-['Manrope',sans-serif] font-bold text-[#000666]">最近提出リスト</h4>
                    <span className="text-xs text-[#1e1b13]/40 font-['Manrope',sans-serif] tracking-tighter cursor-pointer hover:text-[#000666] transition-colors">
                      すべて見る
                    </span>
                  </div>
                  <div className="space-y-4">
                    {desktopSidebarRecentSlot ?? (
                      <p className="text-xs text-[#1e1b13]/45 font-['Manrope',sans-serif] leading-relaxed px-0.5">
                        表示できる提出履歴がありません。
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </main>
        </div>
      </div>

      {/* ——— Mobile (< md) ——— */}
      <div className="md:hidden bg-[#f5f5f5] font-['Plus_Jakarta_Sans',sans-serif] text-[#1e1b13] min-h-screen pb-28">
        <main className="min-h-screen w-full min-w-0 pt-16 pb-24 px-4">
          {mainTopSlot ? <div className="mb-4 w-full">{mainTopSlot}</div> : null}
          <div className="flex space-x-1 mb-8 bg-black/5 p-1 rounded-xl">
            <button
              type="button"
              className={
                !controlledAssignmentTab
                  ? 'flex-1 py-2.5 text-sm font-medium rounded-lg bg-[#000666] text-white shadow-sm'
                  : mobileTabClass('submit')
              }
              onClick={() => pickTab('submit')}
            >
              課題提出
            </button>
            <button
              type="button"
              className={
                !controlledAssignmentTab
                  ? 'flex-1 py-2.5 text-sm font-medium rounded-lg text-[#454652] hover:bg-black/5 transition-colors'
                  : mobileTabClass('submitted')
              }
              onClick={() => pickTab('submitted')}
            >
              既提出
            </button>
            <button
              type="button"
              className={
                !controlledAssignmentTab
                  ? 'flex-1 py-2.5 text-sm font-medium rounded-lg text-[#454652] hover:bg-black/5 transition-colors'
                  : mobileTabClass('correction')
              }
              onClick={() => pickTab('correction')}
            >
              添削完了
            </button>
          </div>

          {mobileSlotBelowTabs}

          {showCorrectionLearner ? (
            <div className="mb-6 rounded-2xl border border-[#c6c5d4]/10 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left font-['Manrope',sans-serif] text-sm font-bold text-[#000666] bg-[#eef3fb] hover:bg-[#e4ecf8] transition-colors border-b border-[#000666]/10"
                aria-expanded={correctionAssignmentExpanded}
                onClick={() => setCorrectionAssignmentExpanded((v) => !v)}
              >
                <span>課題内容を見る</span>
                <span className="material-symbols-outlined text-[#000666] trial-writing-ms text-xl shrink-0">
                  {correctionAssignmentExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
              {correctionAssignmentExpanded ? (
                <div className="p-4 pt-3 border-t border-[#1e1b13]/10 space-y-4">
                  {mobileLessonIntroBlock}
                  {mobileRequirementCard}
                </div>
              ) : null}
            </div>
          ) : (
            mobileLessonIntroBlock
          )}

          <section className="grid grid-cols-1 gap-6 mb-12">
            {!showCorrectionLearner ? mobileRequirementCard : null}

            {showSubmitColumn ? (
              <>
                <div className="space-y-6">
                  <div className="flex justify-between items-end px-2">
                    <label className="font-['Manrope',sans-serif] text-[10px] font-bold tracking-widest text-[#454652] uppercase">
                      入力エリア
                    </label>
                    <span className="text-[10px] font-medium text-[#454652]">
                      {useStudentCharLimit ? count : Math.min(count, maxChars)} / {maxChars} 文字
                    </span>
                  </div>
                  {useStudentCharLimit && bodyOverStudentLimit ? (
                    <p className="text-sm text-[#b91c1c] mb-2 font-medium px-2" role="alert">
                      {STUDENT_BODY_OVER_MSG}
                    </p>
                  ) : null}
                  <div className="relative group">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={textareaDisabled}
                      className="w-full min-h-80 p-8 rounded-2xl bg-white border-none focus:ring-2 focus:ring-[#000666]/20 text-lg leading-relaxed placeholder:text-[#767683]/50 shadow-[0_4px_20px_rgba(0,0,0,0.05)] disabled:bg-[#f5f5f5]/80 disabled:cursor-not-allowed"
                      placeholder={phMobile}
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2">
                      <button type="button" className="p-2 rounded-lg bg-[#e5e5e5] text-[#454652] hover:bg-[#e1e1e1] transition-colors">
                        <span className="material-symbols-outlined text-xl trial-writing-ms">auto_fix</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white border-2 border-dashed border-black/5 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                  <div className="w-16 h-16 rounded-full bg-[#e1e1e1] flex items-center justify-center text-[#1a237e]">
                    <span className="material-symbols-outlined text-3xl trial-writing-ms">upload_file</span>
                  </div>
                  <div>
                    <p className="font-['Manrope',sans-serif] font-bold text-[#1e1b13]">参考資料の添付</p>
                    <p className="text-xs text-[#454652] mt-1">PDF, JPG, PNG (最大 10MB)</p>
                    {selectedFile ? <p className="text-xs text-[#000666] mt-2">{selectedFile.name}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputMobileRef.current?.click()}
                    className="mt-2 px-6 py-2 rounded-full border border-[#000666] text-[#000666] font-semibold text-sm hover:bg-[#000666] hover:text-white transition-all"
                  >
                    ファイルを選択
                  </button>
                  <input
                    ref={fileInputMobileRef}
                    accept={ACCEPT}
                    className="hidden"
                    type="file"
                    onChange={(e) => onFiles(e.target.files)}
                  />
                </div>
              </>
            ) : showSubmittedReadOnly ? (
              <div className="space-y-3">
                {submittedTabStatusJa ? (
                  <p className="text-sm font-bold text-[#000666] px-2 font-['Manrope',sans-serif]">{submittedTabStatusJa}</p>
                ) : null}
                <p className="text-sm font-bold text-[#454652] px-2 font-['Manrope',sans-serif]">提出済みの本文</p>
                <div className="w-full min-h-80 p-8 rounded-2xl bg-white border border-[#c6c5d4]/10 text-lg leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-[#1e1b13] whitespace-pre-wrap">
                  {submittedBodyDisplay ?? '（提出本文がありません）'}
                </div>
              </div>
            ) : showCorrectionLearner ? (
              <div className="space-y-3">
                {correctionTabStatusJa ? (
                  <p className="text-sm font-bold text-[#000666] px-2 font-['Manrope',sans-serif]">{correctionTabStatusJa}</p>
                ) : null}
                {correctionTabDetailSlot != null ? (
                  <div className="px-2">{correctionTabDetailSlot}</div>
                ) : (
                  <>
                    <p className="text-sm font-bold text-[#454652] px-2 font-['Manrope',sans-serif]">提出本文</p>
                    <div className="w-full min-h-80 p-8 rounded-2xl bg-white border border-[#c6c5d4]/10 text-lg leading-relaxed shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-[#1e1b13] whitespace-pre-wrap">
                      {submittedBodyDisplay ?? '（本文がありません）'}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="px-2">
                <p className="text-sm text-[#454652] font-['Manrope',sans-serif]">
                  Admin Sandbox では「添削完了」のプレビューはありません。
                </p>
              </div>
            )}
          </section>

          {showSubmitColumn ? (
            <div className="mt-12 mb-20 px-4">
              <button
                type="button"
                onClick={mobileSubmit}
                disabled={submitDisabled}
                className="w-full py-5 bg-gradient-to-r from-[#000666] to-[#1a237e] text-white rounded-xl font-['Manrope',sans-serif] font-bold text-lg shadow-xl shadow-[#000666]/10 active:scale-[0.98] transition-transform flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined trial-writing-ms" style={{ fontVariationSettings: "'FILL' 1" }}>
                  send
                </span>
                課題を提出する
              </button>
              <p className="text-center text-[10px] text-[#454652] mt-4 font-medium tracking-wide">
                提出後、24時間以内に講師による添削が開始されます。
              </p>
            </div>
          ) : (
            <div className="mb-20" />
          )}
        </main>

        <nav className="fixed bottom-0 w-full z-50 bg-[#f5f5f5] border-t border-black/5 flex justify-around items-center px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" className="flex flex-col items-center justify-center text-[#1e1b13]/50 p-2 hover:bg-black/5 transition-colors active:scale-90">
            <span className="material-symbols-outlined trial-writing-ms">home</span>
            <span className="font-['Plus_Jakarta_Sans',sans-serif] text-[10px] tracking-wider uppercase font-medium">ホーム</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center justify-center bg-[#1a237e] text-white rounded-xl p-2 scale-105 active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined trial-writing-ms" style={{ fontVariationSettings: "'FILL' 1" }}>
              edit_note
            </span>
            <span className="font-['Plus_Jakarta_Sans',sans-serif] text-[10px] tracking-wider uppercase font-medium">課題提出</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center text-[#1e1b13]/50 p-2 hover:bg-black/5 transition-colors active:scale-90">
            <span className="material-symbols-outlined trial-writing-ms">history_edu</span>
            <span className="font-['Plus_Jakarta_Sans',sans-serif] text-[10px] tracking-wider uppercase font-medium">提出済み</span>
          </button>
          <button type="button" className="flex flex-col items-center justify-center text-[#1e1b13]/50 p-2 hover:bg-black/5 transition-colors active:scale-90">
            <span className="material-symbols-outlined trial-writing-ms">task_alt</span>
            <span className="font-['Plus_Jakarta_Sans',sans-serif] text-[10px] tracking-wider uppercase font-medium">添削完了</span>
          </button>
        </nav>
      </div>
    </>
  )
}
