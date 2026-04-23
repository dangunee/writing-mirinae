import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../../lib/apiUrl'

type SandboxMode = 'trial' | 'regular' | 'academy'

type CourseRow = {
  courseId: string
  displayName: string
  status: string
  isAdminSandbox: boolean
  sessionCount: number
  termId?: string | null
}

type Hints = {
  trialCourseId: string | null
  regularAllowlistActive: boolean
  academyAllowlist: string | null
}

type SandboxGet =
  | {
      ok: true
      active: false
      hints?: Hints
    }
  | {
      ok: true
      active: true
      context: {
        id: string
        mode: string
        courseId: string
        sessionId: string
        termId: string | null
        expiresAt: string
      }
      hints?: Hints
    }

type ListSession = { sessionIndex: number; sessionId: string | null }

type ResultBanner = { tone: 'success' | 'error'; text: string }

function formatSandboxActivateError(code: string): string {
  const c = code.trim()
  const labels: Record<string, string> = {
    course_not_active: 'コースがアクティブではありません',
    trial_course_mismatch: '体験コースが一致しません',
    session_not_found: 'セッションが見つかりません',
    invalid_course_for_mode: 'このモードでは選べないコースです',
    course_not_allowlisted: 'このコースは regular サンドボックスの許可リストにありません',
    academy_course_invalid: 'アカデミー対象のコースではありません',
    invalid_body: 'リクエスト内容が不正です',
    unauthorized: '認可されませんでした',
    forbidden: '権限がありません',
  }
  const human = labels[c] ?? '有効化に失敗しました'
  return `${human}（${c}）`
}

let adminCoursesCache: { at: number; courses: CourseRow[] } | null = null
const ADMIN_COURSES_CACHE_TTL_MS = 60_000

async function fetchAdminCoursesCached(): Promise<CourseRow[]> {
  const now = Date.now()
  if (adminCoursesCache && now - adminCoursesCache.at < ADMIN_COURSES_CACHE_TTL_MS) {
    return adminCoursesCache.courses
  }
  const r = await fetch(apiUrl('/api/writing/admin/courses'), { credentials: 'include' })
  const j = (await r.json()) as { courses?: CourseRow[]; ok?: boolean }
  const courses = Array.isArray(j.courses) ? j.courses : []
  adminCoursesCache = { at: Date.now(), courses }
  return courses
}

/**
 * Admin-only QA sandbox activator. Server validates all targets.
 */
export default function AdminSandboxPanel({
  onSandboxChange,
  embedded = false,
}: {
  onSandboxChange: () => void
  /** Wrapped in a details/summary block on WritingPage — omit outer margin */
  embedded?: boolean
}) {
  const [status, setStatus] = useState<SandboxGet | null>(null)
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [hints, setHints] = useState<Hints | null>(null)
  /** Default regular: trial mode requires WRITING_TRIAL_COURSE_ID hint or the course list is empty. */
  const [mode, setMode] = useState<SandboxMode>('regular')
  const [courseId, setCourseId] = useState('')
  const [sessionIndex, setSessionIndex] = useState(1)
  const [sessions, setSessions] = useState<ListSession[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  /** Last activate outcome (green / red). Cleared when mode or course changes. */
  const [lastResult, setLastResult] = useState<ResultBanner | null>(null)

  const refresh = useCallback(async () => {
    const r = await fetch(apiUrl('/api/writing/admin/sandbox/context'), { credentials: 'include' })
    const j = (await r.json()) as SandboxGet & { ok?: boolean }
    if (j.ok) setStatus(j as SandboxGet)
    const h = (j as { hints?: Hints }).hints
    if (h) setHints(h)
  }, [])

  useEffect(() => {
    let cancelled = false
    const t0 = performance.now()
    console.debug('[AdminSandboxPanel] mount parallel: context + courses')
    void (async () => {
      try {
        const [ctxRes, courseList] = await Promise.all([
          fetch(apiUrl('/api/writing/admin/sandbox/context'), { credentials: 'include' }),
          fetchAdminCoursesCached(),
        ])
        if (cancelled) return
        setCourses(courseList)
        const j = (await ctxRes.json()) as SandboxGet & { ok?: boolean }
        if (j.ok) setStatus(j as SandboxGet)
        const h = (j as { hints?: Hints }).hints
        if (h) setHints(h)
      } finally {
        console.debug('[AdminSandboxPanel] mount load ms', {
          ms: Math.round(performance.now() - t0),
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredCourses = useMemo(() => {
    const trialId = hints?.trialCourseId ?? null
    const academyCsv = hints?.academyAllowlist?.split(',').map((s) => s.trim()).filter(Boolean) ?? []

    if (mode === 'trial') {
      if (!trialId) return []
      return courses.filter((c) => c.courseId === trialId && !c.isAdminSandbox)
    }
    if (mode === 'regular') {
      return courses.filter((c) => {
        if (c.isAdminSandbox) return false
        if (trialId && c.courseId === trialId) return false
        // Match GET /api/writing/admin/courses + listActiveWritingCoursesWithTerm (active | pending_setup).
        return c.status === 'active' || c.status === 'pending_setup'
      })
    }
    return courses.filter((c) => {
      if (c.isAdminSandbox) return false
      if (academyCsv.length > 0 && academyCsv.includes(c.courseId)) return true
      return Boolean(c.termId)
    })
  }, [courses, hints, mode])

  /** Trial: allow empty local courseId — use server hint for assignments + POST (same as WRITING_TRIAL_COURSE_ID). */
  const effectiveCourseId = useMemo(() => {
    if (mode === 'trial') {
      const fromUi = courseId.trim()
      if (fromUi) return fromUi
      return hints?.trialCourseId?.trim() ?? ''
    }
    return courseId.trim()
  }, [mode, courseId, hints?.trialCourseId])

  useEffect(() => {
    if (!courseId && filteredCourses.length > 0) {
      setCourseId(filteredCourses[0].courseId)
    }
  }, [filteredCourses, courseId])

  useEffect(() => {
    if (!effectiveCourseId) {
      setSessions([])
      setAssignmentsLoading(false)
      return
    }
    let cancelled = false
    setAssignmentsLoading(true)
    const q = new URLSearchParams({ courseId: effectiveCourseId })
    void fetch(apiUrl(`/api/writing/admin/assignments/list?${q}`), { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { sessions?: { sessionIndex: number; sessionId: string | null }[] }) => {
        if (cancelled || !Array.isArray(data.sessions)) return
        setSessions(
          data.sessions.map((s) => ({
            sessionIndex: Number(s.sessionIndex),
            sessionId: s.sessionId,
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
      .finally(() => {
        if (!cancelled) setAssignmentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [effectiveCourseId])

  useEffect(() => {
    setLastResult(null)
  }, [mode, courseId])

  /** Trial: auto-pick first row with a real session UUID so 有効化 enables without manual 回 selection. */
  useEffect(() => {
    if (mode !== 'trial') return
    if (sessions.length === 0) return
    const usable = sessions.find((s) => (s.sessionId ?? '').trim().length > 0)
    if (!usable) return
    setSessionIndex(usable.sessionIndex)
  }, [mode, sessions])

  const selectedSessionId = useMemo(() => {
    const row = sessions.find((s) => s.sessionIndex === sessionIndex)
    return row?.sessionId?.trim() ?? null
  }, [sessions, sessionIndex])

  const activationBlockedReason = useMemo((): string | null => {
    const sandboxActive = status != null && 'active' in status && status.active === true
    if (sandboxActive || loading) return null
    if (mode === 'trial' && !effectiveCourseId) {
      return '体験コースが見つかりません（trial設定またはコース状態を確認してください）'
    }
    if (mode !== 'trial' && !courseId.trim()) {
      return 'コースを選択してください'
    }
    if (!effectiveCourseId) {
      return 'コースを選択してください'
    }
    if (assignmentsLoading) {
      return 'セッション情報を読み込み中です…'
    }
    if (sessions.length === 0) {
      return 'セッション一覧を取得できていません。コースを確認してください。'
    }
    const hasValid = sessions.some((s) => (s.sessionId ?? '').trim().length > 0)
    if (!hasValid) {
      return '有効なセッションがありません（コースが未セットアップの可能性があります）'
    }
    if (!selectedSessionId) {
      return '回（セッション）が選択されていません'
    }
    return null
  }, [
    status,
    loading,
    mode,
    courseId,
    effectiveCourseId,
    assignmentsLoading,
    sessions,
    selectedSessionId,
  ])

  function runActivatePrecheck(): string | null {
    if (mode === 'trial' && !effectiveCourseId) {
      return '体験コースが見つかりません（trial設定またはコース状態を確認してください）'
    }
    if (mode !== 'trial' && !courseId.trim()) {
      return 'コースを選択してください'
    }
    if (!effectiveCourseId) {
      return 'コースを選択してください'
    }
    if (assignmentsLoading) {
      return 'セッション情報を読み込み中です。完了してから再度お試しください。'
    }
    if (sessions.length === 0) {
      return 'セッション一覧を取得できていません。コースを確認してください。'
    }
    const hasValid = sessions.some((s) => (s.sessionId ?? '').trim().length > 0)
    if (!hasValid) {
      return '有効なセッションがありません（コースが未セットアップの可能性があります）'
    }
    if (!selectedSessionId) {
      return '回（セッション）が選択されていません'
    }
    return null
  }

  async function activate() {
    setLoading(true)
    setLastResult(null)
    try {
      const pre = runActivatePrecheck()
      if (pre) {
        setLastResult({ tone: 'error', text: pre })
        return
      }
      const cid = effectiveCourseId
      const sid = selectedSessionId!
      const res = await fetch(apiUrl('/api/writing/admin/sandbox/context'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, courseId: cid, sessionId: sid }),
      })
      const j = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !j.ok) {
        const raw = typeof j.error === 'string' ? j.error.trim() : `HTTP_${res.status}`
        setLastResult({ tone: 'error', text: formatSandboxActivateError(raw) })
        return
      }
      setLastResult({ tone: 'success', text: 'Sandboxが有効化されました' })
      await refresh()
      onSandboxChange()
    } finally {
      setLoading(false)
    }
  }

  async function clearSandbox() {
    setLoading(true)
    setLastResult(null)
    try {
      await fetch(apiUrl('/api/writing/admin/sandbox/context'), {
        method: 'DELETE',
        credentials: 'include',
      })
      await refresh()
      onSandboxChange()
    } finally {
      setLoading(false)
    }
  }

  async function resetSandboxAttempt() {
    if (!window.confirm('この回のSandbox提出を削除して、最初からやり直しますか？')) {
      return
    }
    const ctxSnapshot =
      status != null && 'active' in status && status.active === true && 'context' in status
        ? status.context
        : null
    setLoading(true)
    setLastResult(null)
    try {
      const res = await fetch(apiUrl('/api/writing/admin/sandbox/reset'), {
        method: 'POST',
        credentials: 'include',
      })
      const j = (await res.json()) as { ok?: boolean }
      if (!res.ok || !j.ok) {
        setLastResult({ tone: 'error', text: 'リセットに失敗しました' })
        return
      }
      setSessionIndex(1)
      setLastResult({ tone: 'success', text: 'Sandbox提出をリセットしました' })
      await refresh()
      onSandboxChange()
      const courseIdToReload = ctxSnapshot?.courseId?.trim()
      if (courseIdToReload) {
        setAssignmentsLoading(true)
        try {
          const q = new URLSearchParams({ courseId: courseIdToReload })
          const r = await fetch(apiUrl(`/api/writing/admin/assignments/list?${q}`), {
            credentials: 'include',
          })
          const data = (await r.json()) as {
            sessions?: { sessionIndex: number; sessionId: string | null }[]
          }
          if (Array.isArray(data.sessions)) {
            setSessions(
              data.sessions.map((s) => ({
                sessionIndex: Number(s.sessionIndex),
                sessionId: s.sessionId,
              }))
            )
          }
        } catch {
          /* list refresh is best-effort */
        } finally {
          setAssignmentsLoading(false)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const active = status && 'active' in status && status.active === true
  const expires =
    active && 'context' in status ? new Date(status.context.expiresAt).toLocaleString() : ''

  return (
    <div
      className={`${embedded ? 'mb-0' : 'mb-3'} rounded-lg border border-amber-500/40 bg-amber-50/90 px-3 py-2 text-xs text-amber-950`}
    >
      <p className="font-bold text-amber-900">Admin Sandbox（QA）</p>
      {active && 'context' in status && status.active ? (
        <div className="mt-2 space-y-2">
          <p>
            有効: mode={status.context.mode} · course={status.context.courseId.slice(0, 8)}… · session=
            {status.context.sessionId.slice(0, 8)}…
          </p>
          <p className="text-[10px] opacity-90">期限: {expires} · 本番の学習者提出とは別テーブルに保存されます。</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void clearSandbox()}
            className="rounded border border-amber-700/30 bg-white px-2 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            サンドボックスを解除
          </button>
          <div className="mt-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void resetSandboxAttempt()}
              className="rounded border border-red-600 bg-white px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              この回をリセットしてやり直す
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide opacity-80">Mode</span>
            <select
              value={mode}
              onChange={(e) => {
                setLastResult(null)
                setMode(e.target.value as SandboxMode)
                setCourseId('')
              }}
              className="rounded border border-amber-800/20 bg-white px-2 py-1 text-[11px]"
            >
              <option value="trial">trial</option>
              <option value="regular">regular</option>
              <option value="academy">academy</option>
            </select>
          </label>
          <label className="flex min-w-[8rem] flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide opacity-80">Course</span>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="max-w-[14rem] rounded border border-amber-800/20 bg-white px-2 py-1 text-[11px]"
            >
              <option value="">—</option>
              {filteredCourses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.displayName.slice(0, 48)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wide opacity-80">回</span>
            <select
              value={sessionIndex}
              onChange={(e) => setSessionIndex(Number(e.target.value))}
              className="rounded border border-amber-800/20 bg-white px-2 py-1 text-[11px]"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  第{n}回
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={loading || (mode !== 'trial' && !courseId.trim()) || !selectedSessionId}
            onClick={() => void activate()}
            className="rounded bg-amber-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            有効化
          </button>
        </div>
      )}
      {lastResult ? (
        <p
          className={`mt-2 text-[11px] font-medium ${
            lastResult.tone === 'success' ? 'text-green-800' : 'text-red-700'
          }`}
          role={lastResult.tone === 'success' ? 'status' : 'alert'}
        >
          {lastResult.text}
        </p>
      ) : activationBlockedReason ? (
        <p className="mt-2 text-[11px] font-medium text-amber-900" role="note">
          {activationBlockedReason}
        </p>
      ) : null}
    </div>
  )
}
