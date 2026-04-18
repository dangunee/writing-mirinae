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
}

const DEFAULT_ASSIGNMENT_TITLE = '約束'
const DEFAULT_ASSIGNMENT_BODY = `우리는 일상생활에서 많은 약속을 하며 살아갑니다. 친구와의 약속, 자신과의 다짐, 혹은 사회적인 규칙 등 다양한 형태의 '약속'이 있습니다. 여러분에게 가장 소중한 약속은 무엇인가요? 평소에 약속을 잘 지키는 편인가요? 약속의 의미와 자신의 경험에 대해 써 보세요.`

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
  mobileSlotBelowTabs,
  assignmentTitle,
  assignmentDescription,
  desktopTextareaPlaceholder,
  mobileTextareaPlaceholder,
  requirementBlockDesktop,
  mainTopSlot,
}: AssignmentSubmitScreenProps) {
  const navigate = useNavigate()
  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

  const narrow = useNarrowScreen()
  const maxChars = narrow ? 1200 : 400

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
      const sliced = next.slice(0, maxChars)
      if (onTextChange) onTextChange(sliced)
      else setInternalText(sliced)
    },
    [maxChars, onTextChange]
  )

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileInputMobileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (controlledText === undefined) {
      setInternalText((t) => (t.length > maxChars ? t.slice(0, maxChars) : t))
    }
  }, [maxChars, controlledText])

  const showDraftButton = showDraftButtonProp ?? accessContext.type === 'trial'

  const count = text.length

  const titleResolved = assignmentTitle ?? DEFAULT_ASSIGNMENT_TITLE
  const bodyResolved = assignmentDescription ?? DEFAULT_ASSIGNMENT_BODY
  const phDesktop = desktopTextareaPlaceholder ?? 'ここに韓国語で文章を入力してください...'
  const phMobile = mobileTextareaPlaceholder ?? 'ここに論説を書き始めてください...'

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

  const submitDisabled = primarySubmitDisabled || primarySubmitLoading

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
        <LandingNav goApp={goApp} />
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
                      className="pb-4 text-lg font-bold border-b-2 border-[#000666] text-[#000666] transition-colors"
                    >
                      提出 (Submit)
                    </button>
                    <button
                      type="button"
                      className="pb-4 text-lg font-medium text-[#1e1b13]/50 hover:text-[#000666] transition-colors"
                    >
                      既提出 (Already Submitted)
                    </button>
                    <button
                      type="button"
                      className="pb-4 text-lg font-medium text-[#1e1b13]/50 hover:text-[#000666] transition-colors"
                    >
                      添削完了 (Correction Completed)
                    </button>
                  </div>
                </header>

                {desktopSlotBelowTabs}

                <section className="rounded-xl p-8 mb-8 shadow-sm bg-white">
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
                            Requirement
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
                </section>

                <section className="space-y-6">
                  <div className="relative">
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      disabled={textareaDisabled}
                      className="w-full min-h-80 bg-white p-8 rounded-xl border-none shadow-[0_10px_40px_rgba(30,27,19,0.04)] focus:ring-2 focus:ring-[#000666]/20 text-lg leading-relaxed font-['Plus_Jakarta_Sans',sans-serif] placeholder:text-[#1e1b13]/20 disabled:bg-[#f5f5f5]/80 disabled:cursor-not-allowed"
                      placeholder={phDesktop}
                    />
                    <div className="absolute bottom-4 right-6 text-sm font-['Manrope',sans-serif] tracking-widest text-[#1e1b13]/40">
                      {Math.min(count, maxChars)} / {maxChars}
                    </div>
                  </div>

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
                    <div className="bg-white/50 p-4 rounded-xl border border-[#c6c5d4]/10 group hover:bg-white transition-all cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold font-['Manrope',sans-serif] tracking-widest text-[#1e1b13]/40 uppercase">
                          11.07
                        </span>
                        <span className="bg-[#1b6d24]/10 text-[#1b6d24] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight">
                          添削済み
                        </span>
                      </div>
                      <p className="font-bold text-sm text-[#1e1b13] group-hover:text-[#000666] transition-colors">秋の夜長に思うこと</p>
                    </div>
                    <div className="bg-white/50 p-4 rounded-xl border border-[#c6c5d4]/10 group hover:bg-white transition-all cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold font-['Manrope',sans-serif] tracking-widest text-[#1e1b13]/40 uppercase">
                          11.02
                        </span>
                        <span className="bg-[#1b6d24]/10 text-[#1b6d24] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight">
                          添削済み
                        </span>
                      </div>
                      <p className="font-bold text-sm text-[#1e1b13] group-hover:text-[#000666] transition-colors">週末の料理</p>
                    </div>
                    <div className="bg-white/50 p-4 rounded-xl border border-[#c6c5d4]/10 group hover:bg-white transition-all cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold font-['Manrope',sans-serif] tracking-widest text-[#1e1b13]/40 uppercase">
                          10.28
                        </span>
                        <span className="bg-[#1b6d24]/10 text-[#1b6d24] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight">
                          添削済み
                        </span>
                      </div>
                      <p className="font-bold text-sm text-[#1e1b13] group-hover:text-[#000666] transition-colors">私の故郷</p>
                    </div>
                  </div>
                </section>

                <div className="rounded-2xl overflow-hidden relative group">
                  <img
                    alt=""
                    className="w-full h-40 object-cover group-hover:scale-110 transition-transform duration-700"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBoTCEnYgiS_70iaRHoi6WAVVAYW7ZrCFUCGkFaSPkbTBB2jjLWy-gURdpytuZJE7XABZaZAQFMfxY6fUXHsp-XDr079paTxg2ki5E6aXDUKkCenkoSStwjeA9e_PbZ3MPDimO25gBK648BcJVvICecb98y489ydXS95GXHjD2LHotcIbKBDjrKMOboJ54qKLaKq9O1W4xpHqz3SNCBPaKGXrGu0EKPk2pgAkS_UBMcMNlbX3dqAZM_i7haGATmFIe7pYTr2CLTZrs"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000666]/80 to-transparent flex items-end p-4">
                    <p className="text-white text-xs font-bold leading-tight">
                      文法マスターコース
                      <br />
                      <span className="opacity-70 font-normal">上級者向けの新しい教材が登場</span>
                    </p>
                  </div>
                </div>
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
            <button type="button" className="flex-1 py-2.5 text-sm font-medium rounded-lg bg-[#000666] text-white shadow-sm">
              課題提出
            </button>
            <button
              type="button"
              className="flex-1 py-2.5 text-sm font-medium rounded-lg text-[#454652] hover:bg-black/5 transition-colors"
            >
              既提出
            </button>
            <button
              type="button"
              className="flex-1 py-2.5 text-sm font-medium rounded-lg text-[#454652] hover:bg-black/5 transition-colors"
            >
              添削完了
            </button>
          </div>

          {mobileSlotBelowTabs}

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

          <section className="grid grid-cols-1 gap-6 mb-12">
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

            <div className="space-y-6">
              <div className="flex justify-between items-end px-2">
                <label className="font-['Manrope',sans-serif] text-[10px] font-bold tracking-widest text-[#454652] uppercase">
                  Drafting Canvas
                </label>
                <span className="text-[10px] font-medium text-[#454652]">
                  {Math.min(count, maxChars)} / {maxChars} 文字
                </span>
              </div>
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
          </section>

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
