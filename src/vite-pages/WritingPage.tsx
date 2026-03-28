import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import WritingLayout from '../components/WritingLayout'
import SubmissionModal from '../components/SubmissionModal'

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

export default function WritingPage() {
  const [current, setCurrent] = useState<CurrentSessionOk | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitModalOpen, setSubmitModalOpen] = useState(false)

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
    setSubmitModalOpen(false)
    void loadCurrent()
  }

  const showSessionTable = Boolean(current?.ok && current.session)
  const session = current?.session ?? null
  const submission = current?.submission ?? null
  const weekLabel =
    session != null
      ? `제${session.index}회 · ${formatUnlockLabel(session.unlockAt)}`
      : ''

  // [FIX] current.mode별 빈 화면 문구만 분기 (UI 구조 동일)
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

  return (
    <WritingLayout onOpenSubmitModal={() => setSubmitModalOpen(true)}>
      <div className="writing-page">
        <h1 className="writing-page-title">작문 과제</h1>
        {loading && <p className="status pending writing-page-loading">불러오는 중…</p>}

        <div className="assignment-weeks">
          {showSessionTable && session != null && (
            <section key={session.id} className="week-section">
              <h3 className="week-label">{weekLabel}</h3>
              {submission != null && submissionFlowKind != null && (
                <>
                  <SubmissionBanner kind={submissionFlowKind} />
                  <SubmissionFlow kind={submissionFlowKind} />
                  {submission.status !== 'draft' && (
                    <p className="writing-lock-hint" role="status">
                      제출 후에는 수정할 수 없습니다.
                    </p>
                  )}
                </>
              )}
              <table className="assignment-table assignment-table-stitch">
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
            </section>
          )}
        </div>

        {!loading && !showSessionTable && (
          <p className="no-assignments">{emptyAssignmentsText}</p>
        )}
      </div>

      <SubmissionModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        onSuccess={handleSubmitSuccess}
        sessionId={session?.id ?? null}
        sessionIndex={session?.index ?? null}
        canSubmit={current?.canSubmit ?? false}
      />
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
