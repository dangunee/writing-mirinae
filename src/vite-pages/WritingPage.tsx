import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import StudentAccountPanel from '../components/student/StudentAccountPanel'
import AssignmentSubmitScreen from '../components/writing/AssignmentSubmitScreen'
import WritingPageAdminPreview, {
  type WritingAdminPreviewPayload,
} from '../components/writing/WritingPageAdminPreview'
import { useAuthMe } from '../hooks/useAuthMe'
import { apiUrl } from '../lib/apiUrl'
import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  parseAssignmentSnapshotForUi,
  parseThemeSnapshotForUi,
} from '../lib/writingThemeSnapshot'
import type { AccessContext } from '../types/writingAccess'

/** GET /api/writing/sessions/current — student / regular / trial course session (unified) */
type CurrentSessionOk = {
  ok: true
  accessKind?: 'student' | 'regular' | 'trial' | 'admin_test'
  applicationId?: string
  grantId?: string
  accessExpiresAt?: string | null
  pendingSubmissionId?: string | null
  courseId: string
  mode: 'pipeline' | 'fresh' | 'all_done'
  session: {
    id: string
    courseId: string
    index: number
    unlockAt: string
    status: string
    themeSnapshot?: string | null
    /** When present: only navigate to result for corrected | missed */
    runtimeStatus?: string | null
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
  const { me } = useAuthMe()
  const isAdmin = me?.role === 'admin'
  const [adminPreview, setAdminPreview] = useState<WritingAdminPreviewPayload | null>(null)
  const onAdminPreview = useCallback((p: WritingAdminPreviewPayload | null) => {
    setAdminPreview(p)
  }, [])

  const [current, setCurrent] = useState<CurrentSessionOk | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessContext, setAccessContext] = useState<AccessContext>({ type: 'student' })
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [refetchAfterSubmit, setRefetchAfterSubmit] = useState(false)
  const submitLockRef = useRef(false)

  const loadCurrent = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/writing/sessions/current'), { credentials: 'include' })
      if (!res.ok) {
        setCurrent(null)
        return
      }
      const data = (await res.json()) as
        | CurrentSessionOk
        | { ok: true; accessKind: 'trial'; applicationId: string; canSubmit: boolean; expiresAt: string | null }
        | { ok: false }
      if (data && 'ok' in data && data.ok === true && 'accessKind' in data && data.accessKind === 'trial') {
        const td = data as Partial<CurrentSessionOk> & {
          ok: true
          accessKind: 'trial'
          applicationId?: string
          courseId?: string
        }
        if (typeof td.courseId === 'string' && td.courseId.length > 0) {
          setCurrent(td as CurrentSessionOk)
          setAccessContext({ type: 'trial' })
          return
        }
        setCurrent(null)
        setAccessContext({ type: 'trial' })
        return
      }
      if (data && 'ok' in data && data.ok === true && 'courseId' in data && data.courseId) {
        const d = data as CurrentSessionOk
        setCurrent(d)
        if (d.accessKind === 'regular') {
          setAccessContext({ type: 'regular' })
        } else {
          setAccessContext({ type: 'student' })
        }
        return
      }
      setCurrent(null)
    } catch {
      setCurrent(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCurrent()
  }, [loadCurrent])

  /** When /sessions/current returned 404 (e.g. no course), still label trial/regular from dedicated cookies. */
  useEffect(() => {
    if (loading) return
    if (current != null) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(apiUrl('/api/writing/trial/session/current'), { credentials: 'include' })
        if (cancelled) return
        if (r.ok) {
          const j = (await r.json()) as { ok?: boolean }
          if (j?.ok === true) {
            setAccessContext({ type: 'trial' })
            return
          }
        }
        const rr = await fetch(apiUrl('/api/writing/regular/session/current'), { credentials: 'include' })
        if (cancelled) return
        if (rr.ok) {
          const jr = (await rr.json()) as { ok?: boolean }
          if (jr?.ok === true) setAccessContext({ type: 'regular' })
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, current])

  /** 管理者: プレビュー用に API で選んだコース／回次の theme_snapshot を優先 */
  const displaySession = useMemo((): CurrentSessionOk['session'] | null => {
    if (isAdmin && adminPreview) {
      return {
        id: adminPreview.sessionId ?? `preview-${adminPreview.courseId}-${adminPreview.sessionIndex}`,
        courseId: adminPreview.courseId,
        index: adminPreview.sessionIndex,
        unlockAt: new Date().toISOString(),
        status: 'preview',
        themeSnapshot: adminPreview.themeSnapshot,
        runtimeStatus: null,
      }
    }
    return current?.session ?? null
  }, [isAdmin, adminPreview, current?.session])

  const session = displaySession
  const submission = isAdmin && adminPreview ? null : (current?.submission ?? null)
  /** 관리자プレビュー: 목록 API에 세션 행이 있으면 실제 sessionId로 제출 가능 */
  const canSubmit =
    isAdmin && adminPreview
      ? Boolean(adminPreview.sessionId?.trim())
      : (current?.canSubmit ?? false)

  const showSessionTable = !(isAdmin && adminPreview) && Boolean(current?.ok && current.session)
  const weekLabel =
    session != null
      ? isAdmin && adminPreview
        ? `第${session.index}回 · プレビュー`
        : `제${session.index}회 · ${formatUnlockLabel(session.unlockAt)}`
      : ''

  const assignUi = parseAssignmentSnapshotForUi(session?.themeSnapshot ?? null)
  const themeUiLegacy = parseThemeSnapshotForUi(session?.themeSnapshot ?? null)
  const activeSessionTitle =
    session != null
      ? (assignUi.displayTitle || themeUiLegacy.title)?.trim()
        ? String((assignUi.displayTitle || themeUiLegacy.title)?.trim())
        : `제${session.index}회 작문`
      : '作文課題'
  const promptBody =
    (assignUi.prompt || assignUi.legacyInstruction || themeUiLegacy.instruction).trim() ||
    '今回の作文を下記入力欄に作成して提出してください。'
  const activeSessionDescription =
    assignUi.kind === 'structured' && assignUi.theme.trim()
      ? `${assignUi.theme.trim()}\n\n${promptBody}`.trim()
      : promptBody

  const hasSession = session != null
  const canUseForm =
    isAdmin && adminPreview
      ? Boolean(adminPreview.sessionId?.trim() && !refetchAfterSubmit)
      : Boolean(canSubmit && session?.id && !refetchAfterSubmit)

  const emptyAssignmentsText = (() => {
    if (current?.ok && current.mode === 'all_done') return '모든 과제를 완료했습니다.'
    if (
      current?.ok &&
      current.mode === 'fresh' &&
      current.session == null &&
      current.accessKind === 'trial' &&
      current.reasonIfNot === 'trial_session_pending'
    ) {
      return '체험 코스 세션을 불러오지 못했습니다. Vercel 환경변수 WRITING_TRIAL_COURSE_ID가 관리 화면에서 과제를 넣은 코스 UUID와 같은지, 그 코스가 active 상태인지 확인해 주세요.'
    }
    if (
      isAdmin &&
      adminPreview &&
      (!adminPreview.themeSnapshot || !String(adminPreview.themeSnapshot).trim())
    ) {
      return 'この回には課題が登録されていません。管理画面の「課題登録」でこのコース・回次に内容を保存してください。'
    }
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
    if (isAdmin && adminPreview && !adminPreview.sessionId?.trim()) return
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
      const data = (await res.json()) as { submissionId?: string; status?: string; error?: string }
      if (!data.submissionId || data.error) return
      setContent('')
      setRefetchAfterSubmit(true)
      await loadCurrent()
    } catch {
      /* minimal: 실패 시 버튼만 다시 활성화 */
    } finally {
      submitLockRef.current = false
      setRefetchAfterSubmit(false)
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

  const requirementCards =
    assignUi.requirements.length >= 1
      ? assignUi.requirements.slice(0, ASSIGNMENT_REQUIREMENT_SLOT_COUNT)
      : null

  const requirementBlockDesktop = (
    <div className="space-y-4">
      <h3 className="font-bold text-[#000666] flex items-center gap-2 font-['Manrope',sans-serif]">
        <span className="material-symbols-outlined text-sm">info</span>
        Requirement
      </h3>
      <p className="text-sm text-[#454652] mb-4">아래 안내를 확인한 뒤 작문을 작성해 주세요.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requirementCards
          ? requirementCards.map((item, index) => (
              <div key={item.expressionKey || index} className="bg-white/60 p-4 rounded-lg border-l-4 border-[#000666]">
                <p className="mb-1">
                  <span className="inline-block rounded bg-[#000666]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#000666]">
                    {item.grammarLevel}
                  </span>
                </p>
                <p className="font-bold text-sm">{item.expressionLabel}</p>
                <p className="text-xs text-[#454652] mt-1">{item.translationJa}</p>
                <p className="text-xs text-[#595c5e] mt-2 italic">예: {item.exampleKo}</p>
              </div>
            ))
          : REQUIREMENT_FALLBACK.map((item, index) => (
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

  const mainTopSlot = (
    <>
      <StudentAccountPanel compact />
      {isAdmin ? <WritingPageAdminPreview onPreview={onAdminPreview} /> : null}
    </>
  )

  return (
    <div className="writing-submit-page writing-stitch-root">
      <AssignmentSubmitScreen
        mainTopSlot={mainTopSlot}
        accessContext={accessContext}
        text={content}
        onTextChange={setContent}
        onPrimarySubmit={() => void handleSubmit()}
        primarySubmitDisabled={
          saving ||
          refetchAfterSubmit ||
          !content.trim() ||
          !session?.id ||
          !canSubmit
        }
        primarySubmitLoading={saving || refetchAfterSubmit}
        textareaDisabled={!canUseForm}
        showDraftButton={false}
        assignmentTitle={activeSessionTitle}
        assignmentDescription={cardDescription}
        desktopTextareaPlaceholder={
          canUseForm
            ? '여기에 작문을 입력해 주세요...'
            : isAdmin && adminPreview && !adminPreview.sessionId?.trim()
              ? '이 회차에 세션이 없어 입력·제출할 수 없습니다. 관리 화면에서 과제를 등록했는지 확인해 주세요.'
              : '제출 가능한 과제가 없을 때는 입력할 수 없습니다.'
        }
        mobileTextareaPlaceholder={
          canUseForm
            ? '여기에 작문을 입력해 주세요...'
            : isAdmin && adminPreview && !adminPreview.sessionId?.trim()
              ? '이 회차에 세션이 없어 입력·제출할 수 없습니다. 관리 화면에서 과제를 등록했는지 확인해 주세요.'
              : '제출 가능한 과제가 없을 때는 입력할 수 없습니다.'
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
  const rs = session.runtimeStatus
  const canOpenResult =
    submission?.id &&
    (rs === 'corrected' ||
      rs === 'missed' ||
      (rs == null || rs === ''
        ? isPublished || session.status === 'missed'
        : false))

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
        {canOpenResult ? (
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
        {/* [FIX] runtimeStatus corrected|missed 또는 레거시 published / session missed 일 때만 결과 (draft·locked 제외) */}
        {canOpenResult ? (
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
