import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AdminAssignmentsList from '../components/admin/AdminAssignmentsList'
import AdminAssignmentSnapshotFieldsForm, {
  emptyAssignmentSnapshotSeed,
  type AssignmentSnapshotFormSeed,
} from '../components/admin/AdminAssignmentSnapshotFieldsForm'
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
import { padAssignmentRequirementsToSlotCount, parseAssignmentSnapshotForUi } from '../lib/writingThemeSnapshot'

type AdminCourseOption = {
  courseId: string
  displayName: string
  status: string
  isAdminSandbox: boolean
  sessionCount: number
}

const SESSION_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

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
  const [formSeed, setFormSeed] = useState<AssignmentSnapshotFormSeed>(() => emptyAssignmentSnapshotSeed())
  const [seedVersion, setSeedVersion] = useState(0)
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
          setFormSeed(emptyAssignmentSnapshotSeed())
          setSeedVersion((v) => v + 1)
          return
        }
        const u = parseAssignmentSnapshotForUi(raw)
        setFormSeed({
          theme: u.theme || '',
          title: u.displayTitle || '',
          prompt: (u.prompt || u.legacyInstruction || '').trim(),
          modelAnswer: u.modelAnswer?.trim() ?? '',
          requirements: padAssignmentRequirementsToSlotCount(u.requirements),
        })
        setSeedVersion((v) => v + 1)
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

  const sessionIndexNum = useMemo(() => {
    const n = parseInt(sessionIndex, 10)
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : 1
  }, [sessionIndex])

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

        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 w-full flex-1 lg:max-w-2xl">
            <div className="space-y-4 text-sm">
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

          <AdminAssignmentSnapshotFieldsForm
            courseId={courseId.trim()}
            sessionIndex={sessionIndexNum}
            seed={formSeed}
            seedVersion={seedVersion}
            legacyMigrationHint={legacyMigrationHint}
            disabled={coursesLoading || ensuringCourse || !courseId.trim()}
            actionsVariant="standalone"
            onSaved={async () => {
              void loadSidebarSessions(courseId.trim())
            }}
          />
            </div>

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
