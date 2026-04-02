import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import AssignmentSubmitScreen from '../components/writing/AssignmentSubmitScreen'
import { apiUrl } from '../lib/apiUrl'
import type { AccessContext } from '../types/writingAccess'

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
  const [accessContext, setAccessContext] = useState<AccessContext>({ type: 'student' })
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

  useEffect(() => {
    if (loading) return
    if (current != null) {
      setAccessContext({ type: 'student' })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(apiUrl('/api/writing/trial/session/current'), { credentials: 'include' })
        if (cancelled) return
        if (!r.ok) return
        const j = (await r.json()) as { ok?: boolean }
        if (j?.ok === true) setAccessContext({ type: 'trial' })
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, current])

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

  const desktopSlotBelowTabs = (
    <>
      {loading ? (
        <p className="text-sm text-[#454652] mb-4 px-1" role="status">
          불러오는 중…
        </p>
      ) : null}
      {hasSession && weekLabel ? (
        <h2 className="text-lg font-semibold text-[#1e1b13] mb-4">{weekLabel}</h2>
      ) : null}
      {hasSession && submission != null && submissionFlowKind != null ? (
        <>
          <SubmissionBanner kind={submissionFlowKind} />
          <SubmissionFlow kind={submissionFlowKind} />
          {submission.status !== 'draft' ? (
            <p className="writing-lock-hint mb-6" role="status">
              제출 후에는 수정할 수 없습니다.
            </p>
          ) : null}
        </>
      ) : null}
    </>
  )

  const requirementBlockDesktop = (
    <div className="space-y-4">
      <h3 className="font-bold text-[#000666] flex items-center gap-2 font-['Manrope',sans-serif]">
        <span className="material-symbols-outlined text-sm">info</span>
        Requirement
      </h3>
      <p className="text-sm text-[#454652] mb-4">아래 안내를 확인한 뒤 작문을 작성해 주세요.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REQUIREMENT_FALLBACK.map((item, index) => (
          <div key={index} className="bg-white/60 p-4 rounded-lg border-l-4 border-[#000666]">
            <p className="font-bold text-sm">{item.title}</p>
            {item.example ? <p className="text-xs text-[#454652] mt-1">{item.example}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )

  const desktopAfterSubmitSlot = (
    <>
      {hasSession && session && !canSubmit ? (
        <p className="text-sm text-[#ba1a1a] mt-6" role="status">
          이 세션에서는 제출할 수 없습니다.
        </p>
      ) : null}
      <p className="text-center text-[10px] text-[#454652] mt-6 mb-8 font-medium tracking-wide">
        제출 후 강사 확인·첨삭 일정은 코스 안내에 따릅니다.
      </p>
      {showSessionTable && session != null ? (
        <table className="assignment-table assignment-table-stitch writing-submit-table w-full">
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
    </>
  )

  return (
    <div className="writing-submit-page writing-stitch-root">
      <AssignmentSubmitScreen
        accessContext={accessContext}
        text={content}
        onTextChange={setContent}
        onPrimarySubmit={() => void handleSubmit()}
        primarySubmitDisabled={saving || !content.trim() || !session?.id || !canSubmit}
        primarySubmitLoading={saving}
        textareaDisabled={!canUseForm}
        showDraftButton={false}
        assignmentTitle={activeSessionTitle}
        assignmentDescription={cardDescription}
        desktopTextareaPlaceholder={
          canUseForm ? '여기에 작문을 입력해 주세요...' : '제출 가능한 과제가 없을 때는 입력할 수 없습니다.'
        }
        mobileTextareaPlaceholder={
          canUseForm ? '여기에 작문을 입력해 주세요...' : '제출 가능한 과제가 없을 때는 입력할 수 없습니다.'
        }
        requirementBlockDesktop={requirementBlockDesktop}
        desktopSlotBelowTabs={desktopSlotBelowTabs}
        desktopAfterSubmitSlot={desktopAfterSubmitSlot}
        mobileSlotBelowTabs={desktopSlotBelowTabs}
      />
    </div>
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
          <Link to={`/writing/app/view/${submission.id}`} className="status-badge status corrected">
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
            <Link to={`/writing/app/view/${submission.id}`} className="view-link">
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
