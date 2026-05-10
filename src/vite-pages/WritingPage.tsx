import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import StudentAccountPanel from '../components/student/StudentAccountPanel'
import AdminSandboxPanel from '../components/writing/AdminSandboxPanel'
import StudentCorrectionResultInline from '../components/student/StudentCorrectionResultInline'
import AssignmentSubmitScreen, { type AssignmentTabKind } from '../components/writing/AssignmentSubmitScreen'
import WritingPageAdminPreview, {
  type WritingAdminPreviewPayload,
} from '../components/writing/WritingPageAdminPreview'
import { useAuthMe } from '../hooks/useAuthMe'
import { apiUrl } from '../lib/apiUrl'
import {
  clearWritingSessionCurrentBootstrap,
  takeWritingSessionCurrentBootstrap,
} from '../lib/writingSessionCurrentBootstrap'
import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  parseAssignmentSnapshotForUi,
  parseThemeSnapshotForUi,
} from '../lib/writingThemeSnapshot'
import type { AccessContext } from '../types/writingAccess'
import { trialWritingErrorMessageJa, TRIAL_SESSION_REFRESH_NOTICE_JA } from '../lib/trialWritingErrorsJa'
import { writingSessionReasonIfNotJa } from '../lib/writingSessionReasonIfNotJa'

/** GET /api/writing/sessions/current — student / regular / trial course session (unified) */
type CurrentSessionOk = {
  ok: true
  accessKind?: 'student' | 'regular' | 'trial' | 'admin_test' | 'admin_sandbox'
  sandboxMode?: 'trial' | 'regular' | 'academy'
  adminSandbox?: { contextExpiresAt: string; isTestSubmission: boolean }
  applicationId?: string
  grantId?: string
  accessExpiresAt?: string | null
  pendingSubmissionId?: string | null
  courseId: string
  mode: 'pipeline' | 'fresh' | 'all_done' | 'submitted'
  session: {
    id: string
    courseId: string
    index: number
    unlockAt: string
    status: string
    themeSnapshot?: string | null
    /** When present: only navigate to result for corrected | missed */
    runtimeStatus?: string | null
    /** Trial (and future) session deadline — ISO string */
    dueAt?: string | null
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
  { title: 'テーマに沿って書くこと' },
  { title: '分量・形式の指定を守ること' },
]

function learnerAssignmentTabFromSession(
  sessionForUi: CurrentSessionOk['session'] | null,
  submissionForUi: CurrentSessionOk['submission'] | null,
): AssignmentTabKind {
  const rt = sessionForUi?.runtimeStatus ?? ''
  const st = submissionForUi?.status ?? ''

  if (rt === 'missed' || st === 'missed') return 'correction'
  if (st === 'corrected' || st === 'published') return 'correction'
  if (rt === 'corrected') return 'correction'

  if (submissionForUi && st && st !== 'draft') return 'submitted'
  return 'submit'
}

type AdminSandboxErrorCode =
  | 'sandbox_context_missing_or_expired'
  | 'sandbox_context_invalid_or_stale'
  | 'sandbox_resolution_failed'
  | 'admin_no_writing_session_context'

function adminSandboxErrorBannerText(code: AdminSandboxErrorCode): string {
  switch (code) {
    case 'sandbox_context_missing_or_expired':
      return 'セッションの有効期限が切れました。もう一度設定してください。'
    case 'sandbox_context_invalid_or_stale':
      return 'サンドボックス設定が無効です。再設定してください。'
    case 'sandbox_resolution_failed':
      return '一時的なエラーが発生しました。時間をおいて再試行してください。'
    case 'admin_no_writing_session_context':
      return '利用可能な作文セッションがありません。Admin Sandbox を有効化するか、コース設定を確認してください。'
    default:
      return '一時的なエラーが発生しました。時間をおいて再試行してください。'
  }
}

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
  const [assignmentTab, setAssignmentTab] = useState<AssignmentTabKind>('submit')
  const [sandboxSubmitNotice, setSandboxSubmitNotice] = useState(false)
  const [sandboxErrorCode, setSandboxErrorCode] = useState<AdminSandboxErrorCode | null>(null)
  /** Last POST /submission error (admin sandbox only); surfaced under tabs, not silent. */
  const [sandboxSubmitFieldError, setSandboxSubmitFieldError] = useState<string | null>(null)
  /** Trial: GET /sessions/current failure (public error code → JA). */
  const [trialSessionLoadError, setTrialSessionLoadError] = useState<string | null>(null)
  /** Trial: stale session recovery notice / POST error messages (Japanese). */
  const [trialSubmitNotice, setTrialSubmitNotice] = useState<string | null>(null)
  const [trialSubmitError, setTrialSubmitError] = useState<string | null>(null)

  const loadCurrent = useCallback(async () => {
    const t0 =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    console.debug('[WritingPage] loadCurrent() start')
    setLoading(true)
    try {
      let data:
        | CurrentSessionOk
        | { ok: true; accessKind: 'trial'; applicationId: string; canSubmit: boolean; expiresAt: string | null }
        | { ok: false; accessKind?: string; code?: string; error?: string; applicationId?: string }

      const fromBootstrap = takeWritingSessionCurrentBootstrap()
      if (fromBootstrap != null && typeof fromBootstrap === 'object') {
        data = fromBootstrap as typeof data
        const t1 =
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()
        console.debug('[WritingPage] loadCurrent() bootstrap from guard', {
          ms: Math.round(t1 - t0),
        })
      } else {
        const res = await fetch(apiUrl('/api/writing/sessions/current'), { credentials: 'include' })
        let parsed: unknown = null
        try {
          parsed = await res.json()
        } catch {
          parsed = null
        }
        data = parsed as typeof data
        if (
          data &&
          typeof data === 'object' &&
          'ok' in data &&
          data.ok === false &&
          'accessKind' in data &&
          (data as { accessKind?: string }).accessKind === 'trial'
        ) {
          const errRaw =
            typeof (data as { error?: string }).error === 'string' && (data as { error: string }).error.trim()
              ? (data as { error: string }).error.trim()
              : 'internal_error'
          setSandboxErrorCode(null)
          setTrialSessionLoadError(trialWritingErrorMessageJa(errRaw))
          setTrialSubmitNotice(null)
          setTrialSubmitError(null)
          setCurrent(null)
          setAccessContext({ type: 'trial' })
          const t2 =
            typeof performance !== 'undefined' && typeof performance.now === 'function'
              ? performance.now()
              : Date.now()
          console.debug('[WritingPage] loadCurrent() fetch complete', {
            ms: Math.round(t2 - t0),
            httpOk: res.ok,
            trialError: errRaw,
          })
          return
        }
        if (!res.ok) {
          console.warn('[WritingPage] loadCurrent HTTP error', {
            status: res.status,
            body: parsed,
          })
          setCurrent(null)
          setSandboxErrorCode(null)
          setTrialSessionLoadError(null)
          return
        }
        const t2 =
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now()
        console.debug('[WritingPage] loadCurrent() fetch complete', { ms: Math.round(t2 - t0) })
      }
      if (
        data &&
        'ok' in data &&
        data.ok === false &&
        'accessKind' in data &&
        (data as { accessKind?: string }).accessKind === 'admin_sandbox'
      ) {
        const codeRaw = (data as { code?: string }).code
        const allowed: AdminSandboxErrorCode[] = [
          'sandbox_context_missing_or_expired',
          'sandbox_context_invalid_or_stale',
          'sandbox_resolution_failed',
          'admin_no_writing_session_context',
        ]
        const code =
          codeRaw && allowed.includes(codeRaw as AdminSandboxErrorCode)
            ? (codeRaw as AdminSandboxErrorCode)
            : 'sandbox_resolution_failed'
        setSandboxErrorCode(code)
        setCurrent(null)
        setAccessContext({ type: 'admin_sandbox', mode: 'trial' })
        return
      }
      if (
        data &&
        'ok' in data &&
        data.ok === false &&
        'accessKind' in data &&
        (data as { accessKind?: string }).accessKind === 'trial'
      ) {
        const errRaw =
          typeof (data as { error?: string }).error === 'string' && (data as { error: string }).error.trim()
            ? (data as { error: string }).error.trim()
            : 'internal_error'
        setSandboxErrorCode(null)
        setTrialSessionLoadError(trialWritingErrorMessageJa(errRaw))
        setTrialSubmitNotice(null)
        setTrialSubmitError(null)
        setCurrent(null)
        setAccessContext({ type: 'trial' })
        return
      }
      if (
        data &&
        'ok' in data &&
        data.ok === true &&
        'accessKind' in data &&
        (data as { accessKind?: string }).accessKind === 'admin_sandbox'
      ) {
        const d = data as CurrentSessionOk
        setSandboxErrorCode(null)
        setSandboxSubmitFieldError(null)
        setCurrent(d)
        const sm = d.sandboxMode
        if (sm === 'trial' || sm === 'regular' || sm === 'academy') {
          setAccessContext({ type: 'admin_sandbox', mode: sm })
        } else {
          setAccessContext({ type: 'student' })
        }
        return
      }
      if (data && 'ok' in data && data.ok === true && 'accessKind' in data && data.accessKind === 'trial') {
        const td = data as Partial<CurrentSessionOk> & {
          ok: true
          accessKind: 'trial'
          applicationId?: string
          courseId?: string
        }
        if (typeof td.courseId === 'string' && td.courseId.length > 0) {
          setSandboxErrorCode(null)
          setTrialSessionLoadError(null)
          setCurrent(td as CurrentSessionOk)
          setAccessContext({ type: 'trial' })
          return
        }
        setCurrent(null)
        setSandboxErrorCode(null)
        setTrialSessionLoadError(trialWritingErrorMessageJa('internal_error'))
        setAccessContext({ type: 'trial' })
        return
      }
      if (data && 'ok' in data && data.ok === true && 'courseId' in data && data.courseId) {
        const d = data as CurrentSessionOk
        setSandboxErrorCode(null)
        setTrialSessionLoadError(null)
        setCurrent(d)
        if (d.accessKind === 'regular') {
          setAccessContext({ type: 'regular' })
        } else {
          setAccessContext({ type: 'student' })
        }
        return
      }
      setCurrent(null)
      setSandboxErrorCode(null)
    } catch (e) {
      console.warn('[WritingPage] loadCurrent() failed', e)
    } finally {
      const tEnd =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()
      console.debug('[WritingPage] loadCurrent() finish', { ms: Math.round(tEnd - t0) })
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
    console.debug('[WritingPage] mount')
    void loadCurrent().finally(() => {
      const t2 =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()
      console.debug('[WritingPage] initial loadCurrent settled', { ms: Math.round(t2 - t) })
    })
  }, [loadCurrent])

  useEffect(() => {
    if (!sandboxSubmitNotice) return
    const t = window.setTimeout(() => setSandboxSubmitNotice(false), 6000)
    return () => window.clearTimeout(t)
  }, [sandboxSubmitNotice])

  /** When /sessions/current returned 404 (e.g. no course), still label trial/regular from dedicated cookies. */
  useEffect(() => {
    if (loading) return
    if (current != null) return
    if (sandboxErrorCode) return
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
  }, [loading, current, sandboxErrorCode])

  /** 管理者: プレビュー用に API で選んだコース／回次の theme_snapshot を優先 */
  const displaySession = useMemo((): CurrentSessionOk['session'] | null => {
    if (sandboxErrorCode) {
      return null
    }
    /**
     * Admin sandbox: NEVER fall through to adminPreview — preview uses synthetic `preview-…` ids and
     * breaks POST /sessions/:id/submission (cookie context expects real session UUID).
     */
    if (current?.accessKind === 'admin_sandbox') {
      return current.session ?? null
    }
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
  }, [sandboxErrorCode, isAdmin, adminPreview, current?.session, current?.accessKind])

  const session = displaySession
  const submission =
    current?.accessKind === 'admin_sandbox'
      ? (current.submission ?? null)
      : isAdmin && adminPreview
        ? null
        : (current?.submission ?? null)
  /** 管理者プレビュー: 一覧APIにセッション行があれば実際の sessionId で提出可能 */
  const canSubmit =
    current?.accessKind === 'admin_sandbox'
      ? Boolean(current.canSubmit)
      : isAdmin && adminPreview
        ? Boolean(adminPreview.sessionId?.trim())
        : (current?.canSubmit ?? false)

  /** Admin sandbox (no error) or real learner session payload — drives 提出 / 既提出 / 添削完了 tabs. */
  const useControlledAssignmentTabs = useMemo(
    () =>
      Boolean(
        (current?.accessKind === 'admin_sandbox' && !sandboxErrorCode) ||
          (current?.ok && !(isAdmin && adminPreview && current?.accessKind !== 'admin_sandbox')),
      ),
    [current?.accessKind, current?.ok, sandboxErrorCode, isAdmin, adminPreview],
  )

  const submittedTabStatusJa = useMemo(() => {
    if (!submission) return null
    if (submission.status === 'submitted' || submission.status === 'in_review') return '添削中'
    return null
  }, [submission])

  const correctionTabStatusJa = useMemo(() => {
    const rt = session?.runtimeStatus ?? ''
    const st = submission?.status ?? ''
    if (rt === 'missed' || st === 'missed') return '提出期限を過ぎたため、この課題は提出できません。'
    if (st === 'corrected' || rt === 'corrected') return '添削が完了しました。'
    if (st === 'published') return '添削結果を公開しました。結果をご確認ください。'
    return null
  }, [submission, session?.runtimeStatus])

  const showLearnerCorrectionTab = useMemo(() => {
    if (!useControlledAssignmentTabs) return false
    if (current?.accessKind === 'admin_sandbox') return false
    const rt = session?.runtimeStatus ?? ''
    const st = submission?.status ?? ''
    return (
      rt === 'missed' ||
      st === 'missed' ||
      st === 'corrected' ||
      st === 'published' ||
      rt === 'corrected'
    )
  }, [useControlledAssignmentTabs, current?.accessKind, session?.runtimeStatus, submission?.status])

  const correctionTabDetailSlot = useMemo(() => {
    if (!submission?.id || !showLearnerCorrectionTab) return undefined
    return (
      <StudentCorrectionResultInline submissionId={submission.id} fallbackBodyText={submission.bodyText} />
    )
  }, [submission?.id, submission?.bodyText, showLearnerCorrectionTab])

  /** Sync assignment tabs with GET /sessions/current (sandbox + learner pipeline). */
  useEffect(() => {
    if (!useControlledAssignmentTabs) return

    if (current?.accessKind === 'admin_sandbox') {
      const sub = current.submission
      const st = sub?.status
      if (st === 'draft') {
        setAssignmentTab('submit')
        return
      }
      if (sub && st && st !== 'draft') {
        setAssignmentTab('submitted')
      }
      return
    }

    setAssignmentTab(learnerAssignmentTabFromSession(session, submission))
  }, [
    useControlledAssignmentTabs,
    current?.accessKind,
    current?.submission?.id,
    current?.submission?.status,
    session?.id,
    session?.runtimeStatus,
    submission?.id,
    submission?.status,
  ])

  const studentBodyMaxChars = accessContext.type === 'admin_sandbox' ? undefined : 500
  const bodyOverStudentLimit = studentBodyMaxChars != null && content.length > studentBodyMaxChars

  const showSessionTable =
    !(isAdmin && adminPreview) &&
    current?.accessKind !== 'admin_sandbox' &&
    Boolean(current?.ok && current.session)
  const weekLabel =
    session != null
      ? current?.accessKind === 'admin_sandbox'
        ? `第${session.index}回 · Admin Sandbox（QA）`
        : isAdmin && adminPreview
          ? `第${session.index}回 · プレビュー`
          : `第${session.index}回 · ${formatUnlockLabel(session.unlockAt)}`
      : ''

  const assignUi = parseAssignmentSnapshotForUi(session?.themeSnapshot ?? null)
  const themeUiLegacy = parseThemeSnapshotForUi(session?.themeSnapshot ?? null)
  const activeSessionTitle =
    session != null
      ? (assignUi.displayTitle || themeUiLegacy.title)?.trim()
        ? String((assignUi.displayTitle || themeUiLegacy.title)?.trim())
        : `第${session.index}回作文`
      : '作文課題'
  const promptBody =
    (assignUi.prompt || assignUi.legacyInstruction || themeUiLegacy.instruction).trim() ||
    '今回の作文を下記入力欄に作成して提出してください。'
  const activeSessionDescription =
    assignUi.kind === 'structured' && assignUi.theme.trim()
      ? `${assignUi.theme.trim()}\n\n${promptBody}`.trim()
      : promptBody

  const hasSession = session != null

  const learnerSubmitGate = useMemo(() => {
    if (sandboxErrorCode != null) {
      return { ok: false as const, reasonCode: null as string | null }
    }
    if (isAdmin && adminPreview && current?.accessKind !== 'admin_sandbox') {
      const ok = Boolean(adminPreview.sessionId?.trim() && !refetchAfterSubmit && !bodyOverStudentLimit)
      return { ok, reasonCode: ok ? null : 'no_session' }
    }
    if (current?.accessKind === 'admin_sandbox') {
      const ok = Boolean(canSubmit && session?.id && !refetchAfterSubmit && !bodyOverStudentLimit)
      return { ok, reasonCode: ok ? null : 'session_locked' }
    }

    if (!current?.ok) {
      return { ok: false as const, reasonCode: null as string | null }
    }

    if (current.mode === 'all_done') {
      return { ok: false as const, reasonCode: current.reasonIfNot ?? 'all_sessions_completed' }
    }

    if (!session?.id) {
      return { ok: false as const, reasonCode: current.reasonIfNot ?? 'trial_session_missing' }
    }

    if (refetchAfterSubmit) {
      return { ok: false as const, reasonCode: null as string | null }
    }

    if (bodyOverStudentLimit) {
      return { ok: false as const, reasonCode: 'body_text_over_limit' }
    }

    const pipelineDraft =
      current.mode === 'pipeline' && current.submission?.status === 'draft'

    if (
      submission &&
      submission.status !== 'draft' &&
      !pipelineDraft
    ) {
      return { ok: false as const, reasonCode: 'session_already_submitted' }
    }

    if (!current.canSubmit) {
      return { ok: false as const, reasonCode: current.reasonIfNot ?? 'session_locked' }
    }

    if (current.accessKind === 'trial' && current.mode === 'fresh') {
      const rt = session.runtimeStatus
      if (rt != null && rt !== '' && rt !== 'available') {
        return { ok: false as const, reasonCode: 'fresh_runtime_not_available' }
      }
      const dueRaw = session.dueAt
      if (dueRaw && Date.now() >= new Date(dueRaw).getTime()) {
        return { ok: false as const, reasonCode: 'session_expired' }
      }
    }

    return { ok: true as const, reasonCode: null as string | null }
  }, [
    sandboxErrorCode,
    current,
    canSubmit,
    session,
    refetchAfterSubmit,
    bodyOverStudentLimit,
    isAdmin,
    adminPreview,
    submission,
  ])

  const canUseForm = learnerSubmitGate.ok

  const submissionBlockedJa =
    !loading &&
    learnerSubmitGate.reasonCode &&
    sandboxErrorCode == null &&
    (current?.accessKind ?? '') !== 'admin_sandbox' &&
    !(isAdmin && adminPreview)
      ? writingSessionReasonIfNotJa(learnerSubmitGate.reasonCode)
      : null

  const emptyAssignmentsText = (() => {
    if (current?.ok && current.mode === 'all_done') return 'すべての課題を完了しました。'
    if (
      current?.ok &&
      current.mode === 'fresh' &&
      current.session == null &&
      current.accessKind === 'trial' &&
      current.reasonIfNot === 'internal_error'
    ) {
      return '体験コースのセッションを読み込めませんでした。Vercel の環境変数 WRITING_TRIAL_COURSE_ID が、管理画面で課題を登録したコースの UUID と一致しているか、そのコースが有効（active）かどうかを確認してください。'
    }
    if (
      isAdmin &&
      adminPreview &&
      (!adminPreview.themeSnapshot || !String(adminPreview.themeSnapshot).trim())
    ) {
      return 'この回には課題が登録されていません。管理画面の「課題登録」でこのコース・回次に内容を保存してください。'
    }
    if (current?.ok && current.mode === 'fresh') return '最初の課題を開始してください。'
    return 'まだ課題がありません。'
  })()

  const submissionFlowKind = (() => {
    if (!submission) return null
    if (submission.status === 'draft') return 'draft' as const
    if (submission.status === 'published') return 'published' as const
    return 'in_progress' as const
  })()

  const cardDescription = hasSession
    ? activeSessionDescription
    : `${emptyAssignmentsText} 利用可能な課題が開くと、この欄に課題の案内が表示されます。`

  const handleSubmit = async () => {
    if (sandboxErrorCode) return
    if (studentBodyMaxChars != null && content.length > studentBodyMaxChars) return
    if (current?.accessKind !== 'admin_sandbox' && isAdmin && adminPreview && !adminPreview.sessionId?.trim()) return
    const isAdminSandboxFlow = current?.accessKind === 'admin_sandbox'
    const isTrialFlow = current?.accessKind === 'trial' && !isAdminSandboxFlow
    const sessionId =
      isAdminSandboxFlow && current?.session?.id
        ? current.session.id
        : (session?.id ?? null)
    if (!sessionId || !content.trim() || !learnerSubmitGate.ok || saving || submitLockRef.current) return
    if (isAdminSandboxFlow) {
      setSandboxSubmitFieldError(null)
    }
    if (isTrialFlow) {
      setTrialSubmitNotice(null)
      setTrialSubmitError(null)
    }
    submitLockRef.current = true
    setSaving(true)
    const bodyKeep = content.trim()
    try {
      const res = await fetch(apiUrl(`/api/writing/sessions/${sessionId}/submission`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', bodyText: bodyKeep }),
      })
      let data: {
        ok?: boolean
        submissionId?: string
        status?: string
        error?: string
        code?: string
        message?: string
        adminSandboxTest?: boolean
        alreadySubmitted?: boolean
      }
      try {
        data = (await res.json()) as typeof data
      } catch {
        if (isAdminSandboxFlow) {
          setSandboxSubmitFieldError(
            `サーバー応答を読み取れませんでした (HTTP ${res.status})。`
          )
        }
        if (isTrialFlow) {
          setTrialSubmitError('サーバー応答を読み取れませんでした。もう一度お試しください。')
        }
        return
      }
      if (!res.ok) {
        const errCodeRaw =
          (typeof data.error === 'string' && data.error.trim()) ||
          (typeof data.code === 'string' && data.code.trim()) ||
          ''
        if (isTrialFlow) {
          if (errCodeRaw === 'trial_session_stale') {
            setTrialSubmitError(null)
            setTrialSubmitNotice(TRIAL_SESSION_REFRESH_NOTICE_JA)
            await loadCurrent()
            return
          }
          setTrialSubmitNotice(null)
          setTrialSubmitError(trialWritingErrorMessageJa(errCodeRaw))
          return
        }
        const msg =
          (typeof data.message === 'string' && data.message.trim()) ||
          errCodeRaw ||
          `提出に失敗しました (HTTP ${res.status})`
        if (isAdminSandboxFlow) {
          setSandboxSubmitFieldError(msg)
        }
        return
      }
      if (data.error && !data.submissionId) {
        const errRaw =
          typeof data.error === 'string'
            ? data.error.trim()
            : typeof data.code === 'string'
              ? data.code.trim()
              : ''
        if (isTrialFlow) {
          setTrialSubmitNotice(null)
          setTrialSubmitError(trialWritingErrorMessageJa(errRaw))
          return
        }
        if (isAdminSandboxFlow) {
          setSandboxSubmitFieldError(
            typeof data.message === 'string' ? data.message : String(data.error)
          )
        }
        return
      }
      if (!data.submissionId || data.ok === false) {
        if (isTrialFlow) {
          setTrialSubmitNotice(null)
          setTrialSubmitError(trialWritingErrorMessageJa(typeof data.error === 'string' ? data.error : 'internal_error'))
          return
        }
        if (isAdminSandboxFlow) {
          setSandboxSubmitFieldError('提出応答に submissionId がありません。')
        }
        return
      }
      if (isAdminSandboxFlow && current?.accessKind === 'admin_sandbox' && current.session) {
        setCurrent((prev) => {
          if (!prev || prev.accessKind !== 'admin_sandbox' || !prev.session) return prev
          return {
            ...prev,
            mode: 'pipeline',
            submission: {
              id: data.submissionId!,
              status: data.status ?? 'submitted',
              bodyText: bodyKeep,
              imageStorageKey: null,
              imageMimeType: null,
              submittedAt: new Date().toISOString(),
            },
            canSubmit: false,
            reasonIfNot: 'sandbox_test_already_submitted',
          }
        })
        setAssignmentTab('submitted')
        setSandboxSubmitNotice(true)
      }
      if (!isAdminSandboxFlow && current?.ok) {
        setCurrent((prev) => {
          if (!prev?.ok) return prev
          return {
            ...prev,
            mode: 'pipeline',
            submission: {
              id: data.submissionId!,
              status: data.status ?? 'submitted',
              bodyText: bodyKeep,
              imageStorageKey: prev.submission?.imageStorageKey ?? null,
              imageMimeType: prev.submission?.imageMimeType ?? null,
              submittedAt: new Date().toISOString(),
            },
            canSubmit: false,
          }
        })
        setAssignmentTab('submitted')
      }
      if (isTrialFlow) {
        setTrialSubmitNotice(null)
        setTrialSubmitError(null)
      }
      setContent('')
      setRefetchAfterSubmit(true)
      clearWritingSessionCurrentBootstrap()
      await loadCurrent()
      if (isAdminSandboxFlow) {
        setAssignmentTab('submitted')
        setSandboxSubmitNotice(true)
      }
    } catch (e) {
      if (isTrialFlow) {
        console.warn('[WritingPage] trial submit network/unhandled', {
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        })
        setTrialSubmitNotice(null)
        setTrialSubmitError(trialWritingErrorMessageJa('internal_error'))
      }
      if (isAdminSandboxFlow) {
        setSandboxSubmitFieldError(
          e instanceof Error ? e.message : 'ネットワークエラーが発生しました。'
        )
      }
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
          読み込み中…
        </p>
      ) : null}
      {trialSubmitNotice ? (
        <p className="text-sm text-[#166534] mb-3 px-1 font-medium" role="status">
          {trialSubmitNotice}
        </p>
      ) : null}
      {trialSubmitError ? (
        <p className="text-sm text-[#b91c1c] mb-3 px-1 font-medium" role="alert">
          {trialSubmitError}
        </p>
      ) : null}
      {trialSessionLoadError ? (
        <p className="text-sm text-[#9a3412] mb-3 px-1 font-medium" role="alert">
          {trialSessionLoadError}
        </p>
      ) : null}
      {submissionBlockedJa ? (
        <p className="text-sm text-[#9a3412] mb-3 px-1 font-medium" role="status">
          {submissionBlockedJa}
        </p>
      ) : null}
      {current?.accessKind === 'admin_sandbox' && sandboxSubmitFieldError ? (
        <p className="text-sm text-[#b91c1c] mb-3 px-1 font-medium" role="alert">
          {sandboxSubmitFieldError}
        </p>
      ) : null}
      {current?.accessKind === 'admin_sandbox' && sandboxSubmitNotice ? (
        <p className="text-sm text-[#166534] mb-3 px-1 font-medium" role="status">
          QAサンドボックス: 提出が完了しました。「既提出」タブで内容を確認できます。
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
              提出後は本文を修正できません。
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
        課題要件
      </h3>
      <p className="text-sm text-[#454652] mb-4">以下の指示を確認したうえで、作文を作成してください。</p>
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
                <p className="text-xs text-[#595c5e] mt-2 italic">例：{item.exampleKo}</p>
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
      {current?.accessKind === 'admin_sandbox' ? (
        <p className="mb-3 text-[11px] leading-snug text-amber-900" role="note">
          QAサンドボックス: 提出は管理者テスト用のDBテーブルのみに保存され、教師キューや本番集計には含まれません。
        </p>
      ) : null}
      {hasSession && session && !learnerSubmitGate.ok && current?.accessKind === 'admin_sandbox' && !submissionBlockedJa ? (
        <p className="text-sm text-[#ba1a1a] mt-6" role="status">
          QAサンドボックス: この状態では提出できません。
        </p>
      ) : null}
      <p className="text-center text-[10px] text-[#454652] mt-6 mb-8 font-medium tracking-wide">
        提出後の講師確認・添削の進め方や所要時間は、各コースの案内に従ってください。
      </p>
    </>
  )

  const mainTopSlot =
    !isAdmin ? null : (
      <>
        {sandboxErrorCode ? (
          <div
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
            role="alert"
          >
            {adminSandboxErrorBannerText(sandboxErrorCode)}
          </div>
        ) : null}
        <details className="mb-3 rounded-lg border border-amber-600/25 bg-amber-50/50 shadow-sm open:bg-amber-50/80">
          <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-bold text-amber-950 marker:text-amber-800">
            QAツール · Admin Sandbox（内部検証 · テスト提出用）
          </summary>
          <div className="border-t border-amber-700/15 px-1 pb-2 pt-0">
            <AdminSandboxPanel
              embedded
              onSandboxChange={() => {
                void loadCurrent()
              }}
            />
          </div>
        </details>
        <WritingPageAdminPreview onPreview={onAdminPreview} />
      </>
    )

  return (
    <div className="writing-submit-page writing-stitch-root">
      <AssignmentSubmitScreen
        mainTopSlot={mainTopSlot}
        landingNavVariant={accessContext.type === 'trial' && !isAdmin ? 'minimal' : 'default'}
        accessContext={accessContext}
        sidebarAccountSlot={
          <StudentAccountPanel
            compact
            embedSidebar
            showAccountActions={!isAdmin}
            writingAppAccess={accessContext.type}
          />
        }
        studentBodyMaxChars={studentBodyMaxChars}
        text={content}
        onTextChange={setContent}
        onPrimarySubmit={() => void handleSubmit()}
        primarySubmitDisabled={saving || !content.trim() || !learnerSubmitGate.ok}
        primarySubmitLoading={saving || refetchAfterSubmit}
        textareaDisabled={!canUseForm}
        showDraftButton={false}
        assignmentTitle={activeSessionTitle}
        assignmentDescription={cardDescription}
        desktopTextareaPlaceholder={
          canUseForm
            ? 'ここに作文を入力してください…'
            : isAdmin && adminPreview && !adminPreview.sessionId?.trim()
              ? 'この回にはセッションがありません。管理画面で課題を登録してください。'
              : submissionBlockedJa ?? '現在は入力・提出できません。ページを更新してお試しください。'
        }
        mobileTextareaPlaceholder={
          canUseForm
            ? 'ここに作文を入力してください…'
            : isAdmin && adminPreview && !adminPreview.sessionId?.trim()
              ? 'この回にはセッションがありません。管理画面で課題を登録してください。'
              : submissionBlockedJa ?? '現在は入力・提出できません。ページを更新してお試しください。'
        }
        requirementBlockDesktop={requirementBlockDesktop}
        desktopSlotBelowTabs={desktopSlotBelowTabs}
        desktopAfterSubmitSlot={desktopAfterSubmitSlot}
        desktopSidebarRecentSlot={
          showSessionTable && session != null ? (
            <RecentSubmissionSidebarCard
              session={session}
              submission={submission}
              assignmentTitle={activeSessionTitle}
            />
          ) : undefined
        }
        mobileSlotBelowTabs={desktopSlotBelowTabs}
        {...(useControlledAssignmentTabs
          ? {
              controlledAssignmentTab: true as const,
              assignmentTab,
              onAssignmentTabChange: setAssignmentTab,
              submittedTabBody: submission?.bodyText ?? null,
              submittedTabStatusJa,
              correctionTabStatusJa,
              showLearnerCorrectionTab,
              correctionTabDetailSlot,
            }
          : {})}
      />
    </div>
  )
}

function SubmissionBanner({ kind }: { kind: 'draft' | 'in_progress' | 'published' }) {
  if (kind === 'draft') {
    return (
      <div className="writing-submission-banner writing-submission-banner--neutral">
        <p className="writing-submission-banner-title">作成中です</p>
        <p className="writing-submission-banner-desc">提出が完了すると講師が内容を確認できます。</p>
      </div>
    )
  }
  if (kind === 'published') {
    return (
      <div className="writing-submission-banner writing-submission-banner--success">
        <p className="writing-submission-banner-title">添削が完了しました</p>
        <p className="writing-submission-banner-desc">下のタブや一覧から結果を確認できます。</p>
      </div>
    )
  }
  return (
    <div className="writing-submission-banner writing-submission-banner--success">
      <p className="writing-submission-banner-title">課題を提出しました</p>
      <p className="writing-submission-banner-desc">講師による添削が完了すると、結果を確認できます。</p>
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
          <span className="writing-flow-label">提出</span>
        </div>
        <div className={`writing-flow-line writing-flow-line--${lineAfter1}`} />
        <div className={`writing-flow-step writing-flow-step--${s2}`}>
          <span className="writing-flow-dot" />
          <span className="writing-flow-label">添削中</span>
        </div>
        <div className={`writing-flow-line writing-flow-line--${lineAfter2}`} />
        <div className={`writing-flow-step writing-flow-step--${s3}`}>
          <span className="writing-flow-dot" />
          <span className="writing-flow-label">完了</span>
        </div>
      </div>
    </div>
  )
}

/** デスクトップ右サイドバー「最近提出リスト」— Stitch カード布局（クリックで結果ビューへ） */
function RecentSubmissionSidebarCard({
  session,
  submission,
  assignmentTitle,
}: {
  session: NonNullable<CurrentSessionOk['session']>
  submission: CurrentSessionOk['submission']
  assignmentTitle: string
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
  const canOpenResult = Boolean(
    submission?.id &&
      (rs === 'corrected' ||
        rs === 'missed' ||
        (rs == null || rs === '' ? isPublished || session.status === 'missed' : false)),
  )

  let statusBadgeClass =
    'bg-[#1e1b13]/10 text-[#1e1b13]/45 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight'
  let statusLabel = '—'

  if (!hasSubmission) {
    statusLabel = '未提出'
  } else if (isDraft) {
    statusBadgeClass =
      'bg-[#1e1b13]/12 text-[#454652] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight'
    statusLabel = '下書き'
  } else if (canOpenResult) {
    statusBadgeClass =
      'bg-[#1b6d24]/10 text-[#1b6d24] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight'
    statusLabel = '添削済み'
  } else if (inProgress) {
    statusBadgeClass =
      'bg-[#b45309]/12 text-[#b45309] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tight writing-status-badge-pulse'
    statusLabel = '添削中'
  }

  const dateLine = formatSidebarRecentDate(submission?.submittedAt)

  const cardBody = (
    <div className="bg-white/50 p-4 rounded-xl border border-[#c6c5d4]/10 transition-all group-hover:bg-white">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold font-['Manrope',sans-serif] tracking-widest text-[#1e1b13]/40 uppercase">
          {dateLine}
        </span>
        <span className={statusBadgeClass}>{statusLabel}</span>
      </div>
      <p className="font-bold text-sm text-[#1e1b13] group-hover:text-[#000666] transition-colors leading-snug">
        {assignmentTitle}
      </p>
    </div>
  )

  if (canOpenResult && submission?.id) {
    return (
      <Link
        to={`/writing/app/view/${submission.id}`}
        className="block group cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#000666]/35"
      >
        {cardBody}
      </Link>
    )
  }

  return <div className="group rounded-xl cursor-default">{cardBody}</div>
}

function formatSidebarRecentDate(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function formatUnlockLabel(iso: string | null | undefined): string {
  if (iso == null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
