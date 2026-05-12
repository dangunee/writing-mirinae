import { useState, useEffect, useCallback, useRef, useMemo, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminAssignmentsList from '../components/admin/AdminAssignmentsList'
import AdminCourseEmptyBootstrap from '../components/admin/AdminCourseEmptyBootstrap'
import type { ListSessionRow } from '../lib/adminAssignmentsCourseCompletion'
import { apiUrl } from '../lib/apiUrl'
import {
  adminCourseSelectValue,
  type AdminOrphanCourse,
  type AdminTermTarget,
  parseAdminCourseSelectValue,
  pickDefaultCourseId,
} from '../lib/adminCourseTermSelect'
import {
  ADMIN_ASSIGNMENT_REQUIRED_SLOT_COUNT,
  isRequirementSlotDuplicateOfPrevious,
  normalizeAdminAssignmentRequirementsPayload,
  requirementSlotHasAnyContent,
} from '../lib/adminAssignmentRequirements'
import { KOREAN_GRAMMAR_LEVELS_JA } from '../lib/koreanGrammarLevel'
import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  emptyAssignmentRequirement,
  padAssignmentRequirementsToSlotCount,
  parseAssignmentSnapshotForUi,
  type AssignmentRequirement,
} from '../lib/writingThemeSnapshot'

const REQ_SLOT_INDICES = Array.from(
  { length: ASSIGNMENT_REQUIREMENT_SLOT_COUNT },
  (_, i) => i
) as readonly number[]

type ReqTuple = [
  AssignmentRequirement,
  AssignmentRequirement,
  AssignmentRequirement,
  AssignmentRequirement,
  AssignmentRequirement,
]

type AdminCourseOption = {
  courseId: string
  displayName: string
  status: string
  isAdminSandbox: boolean
  sessionCount: number
}

const SESSION_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

const emptyReqTuple = (): ReqTuple =>
  Array.from({ length: ASSIGNMENT_REQUIREMENT_SLOT_COUNT }, () => emptyAssignmentRequirement()) as ReqTuple

export default function AdminAssignmentNewPage() {
  const [searchParams] = useSearchParams()
  const [courses, setCourses] = useState<AdminCourseOption[]>([])
  const [termTargets, setTermTargets] = useState<AdminTermTarget[]>([])
  const [orphanCourses, setOrphanCourses] = useState<AdminOrphanCourse[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState<string | null>(null)
  const [ensuringCourse, setEnsuringCourse] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [sessionIndex, setSessionIndex] = useState('1')
  const [theme, setTheme] = useState('')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [modelAnswer, setModelAnswer] = useState('')
  const [req, setReq] = useState<ReqTuple>(emptyReqTuple())
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Avoid re-applying list snapshot when courses refetch after user edits (same URL params). */
  const snapshotPrefillAppliedKey = useRef<string | null>(null)
  const [snapshotPrefillLoading, setSnapshotPrefillLoading] = useState(false)
  const [snapshotPrefilled, setSnapshotPrefilled] = useState(false)
  const [legacyMigrationHint, setLegacyMigrationHint] = useState(false)

  const [sidebarSessions, setSidebarSessions] = useState<ListSessionRow[]>([])
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [sidebarError, setSidebarError] = useState<string | null>(null)

  const reloadCourses = useCallback(
    async (opts?: { lockedCourseId?: string }) => {
      const urlCourseId = searchParams.get('courseId')?.trim() ?? ''
      const urlSessionRaw = searchParams.get('sessionIndex')
      setCoursesLoading(true)
      setCoursesError(null)
      try {
        const res = await fetch(apiUrl('/api/writing/admin/courses'), { credentials: 'include' })
        const data = (await res.json()) as {
          ok?: boolean
          courses?: AdminCourseOption[]
          termTargets?: AdminTermTarget[]
          orphanCourses?: AdminOrphanCourse[]
          error?: string
        }
        if (!res.ok || !data.ok || !Array.isArray(data.courses)) {
          setCoursesError(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
          setCourses([])
          setTermTargets([])
          setOrphanCourses([])
          return
        }
        const rows = data.courses
        const terms = data.termTargets ?? []
        const orphans = data.orphanCourses ?? []
        setCourses(rows)
        setTermTargets(terms)
        setOrphanCourses(orphans)

        const allIds = new Set<string>()
        rows.forEach((c) => allIds.add(c.courseId))
        terms.forEach((t) => {
          if (t.courseId) allIds.add(t.courseId)
        })
        orphans.forEach((o) => allIds.add(o.courseId))

        const locked = opts?.lockedCourseId?.trim()
        if (locked && allIds.has(locked)) {
          setCourseId(locked)
        } else {
          setCourseId(pickDefaultCourseId(urlCourseId, terms, orphans, allIds))
        }

        if (urlSessionRaw != null) {
          const n = parseInt(String(urlSessionRaw), 10)
          if (Number.isFinite(n) && n >= 1 && n <= 10) {
            setSessionIndex(String(n))
          }
        }
      } catch {
        setCoursesError('load_failed')
        setCourses([])
        setTermTargets([])
        setOrphanCourses([])
      } finally {
        setCoursesLoading(false)
      }
    },
    [searchParams]
  )

  async function handleCourseSelectChange(raw: string) {
    if (!raw.trim()) return
    const parsed = parseAdminCourseSelectValue(raw)
    if (parsed.kind === 'course') {
      setCourseId(parsed.courseId)
      return
    }
    setEnsuringCourse(true)
    setCoursesError(null)
    try {
      const res = await fetch(apiUrl('/api/writing/admin/courses/ensure-for-term'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termId: parsed.termId }),
      })
      const data = (await res.json()) as { ok?: boolean; courseId?: string; code?: string }
      if (!res.ok || !data.ok || !data.courseId) {
        setCoursesError(data.code ?? `HTTP ${res.status}`)
        return
      }
      await reloadCourses({ lockedCourseId: data.courseId })
    } catch {
      setCoursesError('request_failed')
    } finally {
      setEnsuringCourse(false)
    }
  }

  useEffect(() => {
    void reloadCourses()
  }, [reloadCourses])

  const loadSidebarSessions = useCallback(async (cid: string) => {
    if (!cid.trim()) {
      setSidebarSessions([])
      setSidebarLoading(false)
      setSidebarError(null)
      return
    }
    setSidebarLoading(true)
    setSidebarError(null)
    try {
      const q = new URLSearchParams({ courseId: cid.trim() })
      const res = await fetch(apiUrl(`/api/writing/admin/assignments/list?${q}`), {
        credentials: 'include',
      })
      const data = (await res.json()) as {
        ok?: boolean
        sessions?: ListSessionRow[]
        error?: string
      }
      if (!res.ok || !data.ok || !Array.isArray(data.sessions)) {
        setSidebarError(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
        setSidebarSessions([])
        return
      }
      setSidebarSessions(data.sessions)
    } catch {
      setSidebarError('load_failed')
      setSidebarSessions([])
    } finally {
      setSidebarLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSidebarSessions(courseId)
  }, [courseId, loadSidebarSessions])

  const displaySidebarSessions = useMemo((): ListSessionRow[] => {
    if (!courseId.trim() || sidebarLoading || sidebarError) return []
    const byIdx = new Map(sidebarSessions.map((s) => [s.sessionIndex, s]))
    return Array.from({ length: 10 }, (_, i) => {
      const sessionIndex = i + 1
      return (
        byIdx.get(sessionIndex) ?? {
          sessionIndex,
          sessionId: null,
          hasThemeSnapshot: false,
          themeSnapshot: null,
        }
      )
    })
  }, [courseId, sidebarLoading, sidebarError, sidebarSessions])

  const sidebarSelectedIndex = useMemo(() => {
    const n = parseInt(sessionIndex, 10)
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null
  }, [sessionIndex])

  const sessionSidebarHref = useCallback(
    (idx: number) =>
      `/writing/admin/assignments/new?courseId=${encodeURIComponent(courseId.trim())}&sessionIndex=${idx}`,
    [courseId]
  )

  useEffect(() => {
    const cid = searchParams.get('courseId')?.trim() ?? ''
    const siRaw = searchParams.get('sessionIndex')
    const prefillKey = cid && siRaw != null ? `${cid}|${siRaw}` : ''
    if (!prefillKey) {
      snapshotPrefillAppliedKey.current = null
      return
    }
    if (coursesLoading) return
    const has =
      courses.some((c) => c.courseId === cid) ||
      termTargets.some((t) => t.courseId === cid) ||
      orphanCourses.some((o) => o.courseId === cid)
    if (!has) return
    if (snapshotPrefillAppliedKey.current === prefillKey) return

    const si = parseInt(String(siRaw), 10)
    if (!Number.isFinite(si) || si < 1 || si > 10) return

    let cancelled = false

    void (async () => {
      setSnapshotPrefillLoading(true)
      setLegacyMigrationHint(false)
      try {
        const q = new URLSearchParams({ courseId: cid })
        const res = await fetch(apiUrl(`/api/writing/admin/assignments/list?${q}`), {
          credentials: 'include',
        })
        const data = (await res.json()) as {
          ok?: boolean
          sessions?: Array<{ sessionIndex: number; themeSnapshot: string | null }>
        }
        if (cancelled) return
        snapshotPrefillAppliedKey.current = prefillKey
        if (!res.ok || !data.ok || !Array.isArray(data.sessions)) {
          setSnapshotPrefilled(false)
          return
        }
        const row = data.sessions.find((s) => s.sessionIndex === si)
        const raw = row?.themeSnapshot
        if (!raw || !String(raw).trim()) {
          setSnapshotPrefilled(false)
          return
        }
        const u = parseAssignmentSnapshotForUi(raw)
        setTheme(u.theme || '')
        setTitle(u.displayTitle || '')
        setPrompt((u.prompt || u.legacyInstruction || '').trim())
        setModelAnswer(u.modelAnswer?.trim() ?? '')
        setReq(padAssignmentRequirementsToSlotCount(u.requirements) as ReqTuple)
        setSnapshotPrefilled(true)
        setLegacyMigrationHint(u.kind === 'legacy' && u.requirements.length === 0)
      } catch {
        if (!cancelled) {
          snapshotPrefillAppliedKey.current = prefillKey
          setSnapshotPrefilled(false)
        }
      } finally {
        if (!cancelled) setSnapshotPrefillLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [searchParams, coursesLoading, courses, termTargets, orphanCourses])

  function patchReq(i: number, field: keyof AssignmentRequirement, value: string) {
    setReq((prev) => {
      const next = [...prev] as AssignmentRequirement[]
      next[i] = { ...next[i], [field]: value }
      return next as ReqTuple
    })
  }

  function clearReqSlot(slotIndex: number) {
    setReq((prev) => {
      const next = [...prev] as AssignmentRequirement[]
      next[slotIndex] = emptyAssignmentRequirement()
      return next as ReqTuple
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)
    try {
      const normalizedReq = normalizeAdminAssignmentRequirementsPayload(req)
      if (!normalizedReq.ok) {
        setError(
          normalizedReq.code === 'invalid_requirements'
            ? '必須文法・表現: スロット1・2はすべて必須です。スロット3〜5はすべて空か、すべての項目を入力してください。'
            : normalizedReq.code === 'requirements_slot_count'
              ? '要件スロット数が不正です。'
              : normalizedReq.code
        )
        return
      }

      const idx = parseInt(sessionIndex, 10)
      const res = await fetch(apiUrl('/api/writing/admin/assignments/create'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseId.trim(),
          sessionIndex: Number.isFinite(idx) ? idx : 1,
          theme: theme.trim(),
          title: title.trim(),
          prompt: prompt.trim(),
          modelAnswer: modelAnswer.trim() || undefined,
          requirements: normalizedReq.requirements,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; code?: string }
      if (!res.ok || !data.ok) {
        setError(data.code ?? `HTTP ${res.status}`)
        return
      }
      const n = Number.isFinite(idx) ? idx : 1
      setMessage(`第${n}回の課題を保存しました。`)
      void loadSidebarSessions(courseId.trim())
    } catch {
      setError('request_failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-8 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32]">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Admin</p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">
          {snapshotPrefilled ? '課題の編集' : '課題登録'}
        </h1>
        <p className="mt-2 text-sm text-[#595c5e]">
          体験コースなど、対象コースの <code className="text-xs">writing.sessions</code>{' '}
          に課題文を保存します。一覧から開いた場合は既存内容を読み込み、上書き保存（再登録）できます。
        </p>
        {snapshotPrefillLoading ? (
          <p className="mt-3 text-sm text-[#595c5e]" role="status">
            登録済みの内容を読み込み中…
          </p>
        ) : null}
        {snapshotPrefilled ? (
          <p className="mt-3 rounded border border-[#c8e6c9] bg-[#e8f5e9] px-3 py-2 text-sm text-[#1b5e20]">
            既存の課題を読み込みました。変更後「保存」で更新されます。
          </p>
        ) : null}
        {legacyMigrationHint ? (
          <p className="mt-3 rounded border border-[#ffe082] bg-[#fff8e1] px-3 py-2 text-sm text-[#795548]">
            レガシー形式の課題です。保存するにはスロット1・2を入力してください。スロット3〜5は任意です（空のまま保存できます）。
          </p>
        ) : null}

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 w-full flex-1 lg:max-w-2xl">
            <form className="space-y-4 text-sm" onSubmit={onSubmit}>
          {coursesLoading ? (
            <p className="text-sm text-[#595c5e]" role="status">
              コース一覧を読み込み中…
            </p>
          ) : null}
          {coursesError ? (
            <p className="text-sm text-[#ba1a1a]" role="alert">
              コース一覧を取得できませんでした（{coursesError}）
            </p>
          ) : null}
          {termTargets.length === 0 && !coursesLoading && !coursesError ? (
            <AdminCourseEmptyBootstrap onProvisioned={reloadCourses} />
          ) : null}
          {ensuringCourse ? (
            <p className="text-sm text-[#595c5e]" role="status">
              選択した期のコースを準備中…
            </p>
          ) : null}
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">対象コース（期）</span>
            <select
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={adminCourseSelectValue(courseId, termTargets, orphanCourses)}
              onChange={(e) => void handleCourseSelectChange(e.target.value)}
              required
              disabled={
                coursesLoading || ensuringCourse || (termTargets.length === 0 && orphanCourses.length === 0)
              }
            >
              {termTargets.length === 0 && orphanCourses.length === 0 ? (
                <option value="">（期またはコースがありません）</option>
              ) : (
                <>
                  <option value="" disabled={Boolean(courseId)}>
                    期を選択…
                  </option>
                  {termTargets.map((t) => (
                    <option
                      key={t.termId}
                      value={t.courseId ? `c:${t.courseId}` : `e:${t.termId}`}
                    >
                      {t.label}
                    </option>
                  ))}
                  {orphanCourses.map((o) => (
                    <option key={o.courseId} value={`o:${o.courseId}`}>
                      {o.displayName}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">対象回차</span>
            <select
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={sessionIndex}
              onChange={(e) => setSessionIndex(e.target.value)}
              required
            >
              {SESSION_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>
                  第{n}回 · {n}회차
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">テーマ（theme）</span>
            <input
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">タイトル（title）</span>
            <input
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="font-semibold text-[#2c2f32]">課題文・指示（prompt）</span>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </label>

          <p className="pt-2 font-semibold text-[#2c2f32]">
            必須文法・表現（スロット1〜2必須、スロット3〜5は任意・最大 {ASSIGNMENT_REQUIREMENT_SLOT_COUNT}件）
          </p>
          {REQ_SLOT_INDICES.map((slot) => {
            const optionalSlot = slot >= ADMIN_ASSIGNMENT_REQUIRED_SLOT_COUNT
            return (
              <div key={slot} className="space-y-2 rounded border border-[#c5c8cc] bg-white/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#595c5e]">
                    スロット {slot + 1}
                    {optionalSlot ? (
                      <span className="ml-1 font-normal text-[#595c5e]">（任意）</span>
                    ) : null}
                  </p>
                  {optionalSlot && requirementSlotHasAnyContent(req[slot]) ? (
                    <button
                      type="button"
                      className="shrink-0 rounded border border-[#c5c8cc] bg-[#f5f7fa] px-2 py-1 text-xs font-semibold text-[#4052b6] hover:bg-[#eef0fb]"
                      onClick={() => clearReqSlot(slot)}
                    >
                      {isRequirementSlotDuplicateOfPrevious(slot, req)
                        ? '重複スロットを空にする'
                        : 'このスロットを空にする'}
                    </button>
                  ) : null}
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-[#2c2f32]">韓国語文法レベル</span>
                  <select
                    className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs text-[#2c2f32]"
                    value={req[slot].grammarLevel}
                    onChange={(e) => patchReq(slot, 'grammarLevel', e.target.value)}
                    required={!optionalSlot}
                  >
                    {KOREAN_GRAMMAR_LEVELS_JA.map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                  placeholder="expressionKey（集計用）"
                  value={req[slot].expressionKey}
                  onChange={(e) => patchReq(slot, 'expressionKey', e.target.value)}
                  required={!optionalSlot}
                />
                <input
                  className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                  placeholder="expressionLabel（韓国語ラベル）"
                  value={req[slot].expressionLabel}
                  onChange={(e) => patchReq(slot, 'expressionLabel', e.target.value)}
                  required={!optionalSlot}
                />
                <input
                  className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                  placeholder="pattern（本文照合用部分文字列）"
                  value={req[slot].pattern}
                  onChange={(e) => patchReq(slot, 'pattern', e.target.value)}
                  required={!optionalSlot}
                />
                <input
                  className="w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                  placeholder="translationJa"
                  value={req[slot].translationJa}
                  onChange={(e) => patchReq(slot, 'translationJa', e.target.value)}
                  required={!optionalSlot}
                />
                <textarea
                  className="min-h-[48px] w-full rounded border border-[#c5c8cc] bg-white px-2 py-1.5 text-xs"
                  placeholder="exampleKo"
                  value={req[slot].exampleKo}
                  onChange={(e) => patchReq(slot, 'exampleKo', e.target.value)}
                  required={!optionalSlot}
                />
              </div>
            )
          })}

          <label className="block">
            <span className="font-semibold text-[#2c2f32]">模範解答（modelAnswer・任意）</span>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
            />
          </label>

          {error ? (
            <p className="text-sm text-[#ba1a1a]" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-[#1b5e20]" role="status">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || coursesLoading || ensuringCourse || !courseId}
            className="rounded bg-[#4052b6] px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {submitting ? '保存中…' : '保存'}
          </button>
            </form>

            <p className="mt-8">
              <Link to="/writing/admin/assignments" className="text-sm font-semibold text-[#4052b6] underline">
                課題管理（一覧）
              </Link>
            </p>
            <p className="mt-4">
              <Link to="/writing/admin" className="text-sm text-[#595c5e] underline">
                管理コンソールへ戻る
              </Link>
            </p>
          </div>

          <aside className="w-full shrink-0 space-y-2 lg:sticky lg:top-6 lg:w-72 lg:self-start lg:max-h-[min(70vh,calc(100vh-8rem))] lg:overflow-y-auto xl:w-80">
            <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">回次一覧</p>
            <p className="text-xs text-[#595c5e] lg:hidden">
              別の回をタップすると、その回の編集・登録画面へ移動します。
            </p>
            <AdminAssignmentsList
              courseId={courseId}
              displaySessions={displaySidebarSessions}
              selectedIndex={sidebarSelectedIndex}
              listLoading={sidebarLoading}
              listError={sidebarError}
              sessionEditHref={courseId.trim() ? sessionSidebarHref : undefined}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}
