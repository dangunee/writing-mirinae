import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

/** GET /api/writing/sessions/current 성공 본문 (서버 writingStudentService CurrentSessionResponse ok:true) */
type CurrentSessionOk = {
  ok: true
  courseId: string
  mode: 'pipeline' | 'fresh' | 'all_done'
  session: {
    id: string
    courseId: string
    index: number
    unlockAt: string
    status: string
  } | null
  submission: {
    id: string
    status: string
    bodyText: string | null
    imageStorageKey: string | null
    imageMimeType: string | null
    submittedAt: string | null
  } | null
  canSubmit: boolean
  reasonIfNot?: string
}

const REQUIREMENT_FALLBACK: { title: string; example?: string }[] = [
  { title: '주제에 맞게 작성할 것' },
  { title: '분량·형식을 지킬 것' },
]

export default function WritingPage() {
  const [current, setCurrent] = useState<CurrentSessionOk | null>(null)
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const submitLockRef = useRef(false)

  const loadCurrent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/writing/sessions/current'), { credentials: 'include' })
      if (!res.ok) {
        setCurrent(null)
        return
      }
      const data = (await res.json()) as CurrentSessionOk | { ok: false }
      if (data && 'ok' in data && data.ok === true) {
        setCurrent(data)
      } else {
        setCurrent(null)
      }
    } catch {
      setCurrent(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCurrent()
  }, [loadCurrent])

  const handleSubmitSuccess = () => {
    void loadCurrent()
  }

  const showSessionTable = Boolean(current?.ok && current.session)
  const session = current?.session ?? null
  const submission = current?.submission ?? null
  const canSubmit = current?.canSubmit ?? false
  const weekLabel =
    session != null
      ? `제${session.index}회 · ${formatUnlockLabel(session.unlockAt)}`
      : ''

  const activeSessionTitle =
    session != null ? `제${session.index}회 작문` : '作文課題'
  const activeSessionDescription = '今回の作文を下記入力欄に作成して提出してください。'

  const hasSession = session != null
  const canUseForm = Boolean(canSubmit && session?.id)

  const emptyAssignmentsText = (() => {
    if (current?.ok && current.mode === 'all_done') return '모든 과제를 완료했습니다.'
    if (current?.ok && current.mode === 'fresh') return '첫 과제를 시작하세요.'
    return '아직 과제가 없습니다.'
  })()

  const submissionFlowKind = (() => {
    if (!submission) return null
    if (submission.status === 'draft') return 'draft' as const
    if (submission.status === 'published') return 'published' as const
    return 'in_progress' as const
  })()

  const cardDescription = hasSession
    ? activeSessionDescription
    : `${emptyAssignmentsText} 이용 가능한 과제가 열리면 이 영역에 과제 안내가 표시됩니다.`

  const handleSubmit = async () => {
    const sessionId = session?.id ?? null
    if (!sessionId || !content.trim() || !canSubmit || saving || submitLockRef.current) return
    submitLockRef.current = true
    setSaving(true)
    try {
      const res = await fetch(apiUrl(`/api/writing/sessions/${sessionId}/submission`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', bodyText: content.trim() }),
      })
      if (!res.ok) return
      setContent('')
      handleSubmitSuccess()
    } catch {
      /* minimal: 실패 시 버튼만 다시 활성화 */
    } finally {
      submitLockRef.current = false
      setSaving(false)
    }
  }

  return (
    <WritingLayout>
      <main className="writing-submit-page writing-stitch-root bg-[#F5F5F5] min-h-[60vh]">
        {loading && (
          <p className="text-sm text-on-surface-variant mb-4 px-1" role="status">
            불러오는 중…
          </p>
        )}

        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row">
          <div className="flex-1 p-4 sm:p-6 lg:p-10 lg:pr-4">
            <div className="max-w-4xl mx-auto w-full">
              <header className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-primary font-headline tracking-tight mb-6">
                  과제 제출
                </h1>
                <div className="flex gap-4 sm:gap-8 border-b border-on-surface/10 overflow-x-auto">
                  <button
                    type="button"
                    className="pb-4 text-sm sm:text-lg font-bold border-b-2 border-primary text-primary shrink-0 transition-colors"
                  >
                    제출 (Submit)
                  </button>
                  <button
                    type="button"
                    className="pb-4 text-sm sm:text-lg font-medium text-on-surface/50 hover:text-primary shrink-0 transition-colors"
                  >
                    제출 완료
                  </button>
                  <button
                    type="button"
                    className="pb-4 text-sm sm:text-lg font-medium text-on-surface/50 hover:text-primary shrink-0 transition-colors"
                  >
                    첨삭 완료
                  </button>
                </div>
              </header>

              {hasSession && weekLabel ? (
                <h2 className="week-label text-lg font-semibold text-on-surface mb-4">{weekLabel}</h2>
              ) : null}

              {hasSession && submission != null && submissionFlowKind != null && (
                <>
                  <SubmissionBanner kind={submissionFlowKind} />
                  <SubmissionFlow kind={submissionFlowKind} />
                  {submission.status !== 'draft' && (
                    <p className="writing-lock-hint mb-6" role="status">
                      제출 후에는 수정할 수 없습니다.
                    </p>
                  )}
                </>
              )}

              <section className="rounded-xl p-6 sm:p-8 mb-8 shadow-sm bg-white">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1">
                    <div className="mb-6">
                      <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold font-label tracking-widest uppercase">
                        Theme
                      </span>
                      <h2 className="text-2xl font-bold text-on-background mt-3 font-headline">
                        {activeSessionTitle}
                      </h2>
                    </div>

                    <div className="bg-surface-container-lowest p-6 rounded-lg border border-outline-variant/10 mb-6">
                      <p className="text-on-surface font-body leading-relaxed whitespace-pre-line">{cardDescription}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl p-6 sm:p-8 mb-8 shadow-sm bg-white">
                <div className="space-y-4">
                  <h3 className="font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">info</span>
                    Requirement
                  </h3>

                  <p className="text-sm text-on-surface-variant mb-4">
                    아래 안내를 확인한 뒤 작문을 작성해 주세요.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {REQUIREMENT_FALLBACK.map((item, index) => (
                      <div
                        key={index}
                        className="bg-white/60 p-4 rounded-lg border-l-4 border-primary"
                      >
                        <p className="font-bold text-sm">{item.title}</p>
                        {item.example ? (
                          <p className="text-xs text-on-surface-variant mt-1">{item.example}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-6 mb-6">
                <div className="flex justify-between items-end px-2">
                  <label
                    htmlFor="submission-body"
                    className="font-label text-[10px] font-bold tracking-widest text-on-surface-variant uppercase"
                  >
                    Drafting Canvas
                  </label>
                  <span className="text-[10px] font-medium text-on-surface-variant">{content.length}</span>
                </div>
                <div className="relative">
                  <textarea
                    id="submission-body"
                    className="w-full h-80 bg-white p-8 rounded-xl border-none shadow-[0_10px_40px_rgba(30,27,19,0.04)] focus:ring-2 focus:ring-primary/20 text-lg leading-relaxed font-body placeholder:text-on-surface/20 disabled:bg-surface-container-high/50 disabled:cursor-not-allowed"
                    placeholder={
                      canUseForm
                        ? '여기에 작문을 입력해 주세요...'
                        : '제출 가능한 과제가 없을 때는 입력할 수 없습니다.'
                    }
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={!canUseForm}
                  />
                </div>
              </section>

              <div className={`mt-8 ${!canUseForm ? 'opacity-60 pointer-events-none' : ''}`}>
                <p className="text-sm font-bold text-on-surface-variant mb-3 font-headline flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">attachment</span>
                  손글씨 원고 업로드
                </p>

                <div className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-12 bg-surface-container-low/30 hover:bg-surface-container-low/50 transition-colors cursor-pointer group flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
                      cloud_upload
                    </span>
                  </div>

                  <p className="text-on-surface font-medium mb-1">
                    이미지 또는 PDF를 업로드하거나
                    <span className="text-primary font-bold underline decoration-2 underline-offset-4 ml-1">
                      파일을 선택
                    </span>
                  </p>

                  <p className="text-[10px] text-on-surface-variant/60 font-label tracking-wider uppercase mt-2">
                    MAX FILE SIZE: 10MB (PNG, JPG, PDF)
                  </p>

                  <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf" />
                </div>
              </div>

              {hasSession && session && !canSubmit ? (
                <p className="status pending submission-modal-hint mt-6" role="status">
                  이 세션에서는 제출할 수 없습니다.
                </p>
              ) : null}

              <div className="flex justify-end gap-4 mt-10 pb-20 lg:pb-8">
                <button
                  type="button"
                  className="px-8 py-3 rounded-lg font-bold bg-primary text-white shadow-lg hover:opacity-90 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => void handleSubmit()}
                  disabled={saving || !content.trim() || !session?.id || !canSubmit}
                >
                  {saving ? '제출 중…' : '과제 제출'}
                </button>
              </div>

              <p className="text-center text-[10px] text-on-surface-variant mt-2 mb-8 font-medium tracking-wide">
                제출 후 강사 확인·첨삭 일정은 코스 안내에 따릅니다.
              </p>

              {showSessionTable && session != null ? (
                <table className="assignment-table assignment-table-stitch writing-submit-table">
                  <thead>
                    <tr>
                      <th scope="col">과제</th>
                      <th scope="col">제출</th>
                      <th scope="col">첨삭</th>
                      <th scope="col">결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SessionRow session={session} submission={submission} />
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>

          <aside className="writing-submit-sidebar w-full lg:w-80 p-4 sm:p-6 lg:p-10 lg:pl-4 bg-[#F5F5F5]">
            <div className="writing-submit-sidebar-inner sticky top-24 space-y-6">
              <section className="bg-white p-6 rounded-2xl shadow-[0_10px_40px_rgba(30,27,19,0.04)]">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-headline font-bold text-primary">2026년 3월</h4>
                  <div className="flex gap-2">
                    <span className="material-symbols-outlined text-on-surface/40">chevron_left</span>
                    <span className="material-symbols-outlined text-on-surface/40">chevron_right</span>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-y-4 text-center text-[10px] font-bold font-label tracking-widest text-on-surface/40 uppercase mb-4">
                  <span>Sun</span>
                  <span>Mon</span>
                  <span>Tue</span>
                  <span>Wed</span>
                  <span>Thu</span>
                  <span>Fri</span>
                  <span>Sat</span>
                </div>

                <div className="grid grid-cols-7 gap-y-2 text-center text-sm font-medium">
                  <span className="p-2 text-on-surface/20">1</span>
                  <span className="p-2">2</span>
                  <span className="p-2">3</span>
                  <span className="p-2 bg-primary text-white rounded-lg">4</span>
                  <span className="p-2">5</span>
                  <span className="p-2">6</span>
                  <span className="p-2">7</span>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-6">
                  <h4 className="font-headline font-bold text-primary">최근 제출</h4>
                  <span className="text-xs text-on-surface/40 font-label tracking-tighter">안내</span>
                </div>

                <div className="space-y-4">
                  {[
                    { date: '—', title: '제출 내역이 없습니다', tag: '—' },
                    { date: '—', title: '연결 예정', tag: '대기' },
                    { date: '—', title: '연결 예정', tag: '대기' },
                  ].map((row, i) => (
                    <div
                      key={i}
                      className="bg-white/50 p-4 rounded-xl border border-outline-variant/10 group hover:bg-white transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold font-label tracking-widest text-on-surface/40 uppercase">
                          {row.date}
                        </span>
                        <span className="bg-secondary/10 text-secondary text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight">
                          {row.tag}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">
                        {row.title}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </main>
    </WritingLayout>
  )
}

function SubmissionBanner({ kind }: { kind: 'draft' | 'in_progress' | 'published' }) {
  if (kind === 'draft') {
    return (
      <div className="writing-submission-banner writing-submission-banner--neutral">
        <p className="writing-submission-banner-title">작성 중입니다</p>
        <p className="writing-submission-banner-desc">제출을 완료하면 강사가 확인할 수 있습니다.</p>
      </div>
    )
  }
  if (kind === 'published') {
    return (
      <div className="writing-submission-banner writing-submission-banner--success">
        <p className="writing-submission-banner-title">첨삭이 완료되었습니다</p>
        <p className="writing-submission-banner-desc">아래에서 결과를 확인할 수 있습니다.</p>
      </div>
    )
  }
  return (
    <div className="writing-submission-banner writing-submission-banner--success">
      <p className="writing-submission-banner-title">과제를 제출했습니다</p>
      <p className="writing-submission-banner-desc">강사 첨삭이 완료되면 결과를 확인할 수 있습니다.</p>
    </div>
  )
}

function SubmissionFlow({ kind }: { kind: 'draft' | 'in_progress' | 'published' }) {
  const s1 = kind === 'draft' ? 'current' : 'done'
  const s2 =
    kind === 'draft' ? 'upcoming' : kind === 'in_progress' ? 'current' : 'done'
  const s3 = kind === 'published' ? 'done' : 'upcoming'
  const lineAfter1 = kind === 'draft' ? 'muted' : 'done'
  const lineAfter2 = kind === 'published' ? 'done' : 'muted'

  return (
    <div className="writing-status-flow" aria-hidden="true">
      <div className="writing-status-flow-track">
        <div className={`writing-flow-step writing-flow-step--${s1}`}>
          <span className="writing-flow-dot" />
          <span className="writing-flow-label">제출</span>
        </div>
        <div className={`writing-flow-line writing-flow-line--${lineAfter1}`} />
        <div className={`writing-flow-step writing-flow-step--${s2}`}>
          <span className="writing-flow-dot" />
          <span className="writing-flow-label">첨삭 중</span>
        </div>
        <div className={`writing-flow-line writing-flow-line--${lineAfter2}`} />
        <div className={`writing-flow-step writing-flow-step--${s3}`}>
          <span className="writing-flow-dot" />
          <span className="writing-flow-label">완료</span>
        </div>
      </div>
    </div>
  )
}

function SessionRow({
  session,
  submission,
}: {
  session: NonNullable<CurrentSessionOk['session']>
  submission: CurrentSessionOk['submission']
}) {
  const hasSubmission = submission != null
  const isPublished = submission?.status === 'published'
  const isDraft = submission?.status === 'draft'
  const inProgress =
    hasSubmission &&
    submission != null &&
    submission.status !== 'draft' &&
    submission.status !== 'published'

  return (
    <tr>
      <td className="assignment-title">제{session.index}회 작문</td>
      <td>
        {!hasSubmission ? (
          <span className="status-badge status pending">미제출</span>
        ) : isDraft ? (
          <span className="status-badge status pending">
            작성 중
            <br />
            <small>{formatDate(submission.submittedAt)}</small>
          </span>
        ) : (
          <span className="status-badge status submitted">
            제출됨
            <br />
            <small>{formatDate(submission.submittedAt)}</small>
          </span>
        )}
      </td>
      <td>
        {isPublished && submission?.id ? (
          <Link to={`/view/${submission.id}`} className="status-badge status corrected">
            완료
            <br />
            <small>결과 보기</small>
          </Link>
        ) : inProgress ? (
          <span className="status-badge status partial writing-status-badge-pulse">
            진행 중
            <br />
            <small>—</small>
          </span>
        ) : (
          <span className="status-badge status pending">-</span>
        )}
      </td>
      <td>
        {/* [FIX] published + id 있을 때만 View (draft/진행 중 결과 페이지 노출 방지) */}
        {isPublished && submission?.id ? (
          <div className="view-links">
            <Link to={`/view/${submission.id}`} className="view-link">
              결과 보기
            </Link>
          </div>
        ) : (
          <span className="status-badge status pending">-</span>
        )}
      </td>
    </tr>
  )
}

function formatDate(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatUnlockLabel(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
