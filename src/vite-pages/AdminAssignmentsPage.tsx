import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminAssignmentsCsvImport from '../components/admin/AdminAssignmentsCsvImport'
import AdminAssignmentsList from '../components/admin/AdminAssignmentsList'
import AdminCourseEmptyBootstrap from '../components/admin/AdminCourseEmptyBootstrap'
import {
  assignmentsCompleteForCourseSessions,
  fetchAssignmentsCompleteForCourse,
  formatCourseLabelWithAssignmentCompletion,
  type ListSessionRow,
} from '../lib/adminAssignmentsCourseCompletion'
import {
  adminCourseSelectValue,
  type AdminOrphanCourse,
  type AdminTermTarget,
  parseAdminCourseSelectValue,
  pickDefaultCourseId,
} from '../lib/adminCourseTermSelect'
import { apiUrl } from '../lib/apiUrl'
import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  hasRegisteredThemeSnapshot,
  parseAssignmentSnapshotForUi,
} from '../lib/writingThemeSnapshot'

type AdminCourseOption = {
  courseId: string
  displayName: string
  status: string
  isAdminSandbox: boolean
  sessionCount: number
}

export default function AdminAssignmentsPage() {
  const [termTargets, setTermTargets] = useState<AdminTermTarget[]>([])
  const [orphanCourses, setOrphanCourses] = useState<AdminOrphanCourse[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState<string | null>(null)
  const [ensuringCourse, setEnsuringCourse] = useState(false)
  const [courseId, setCourseId] = useState('')

  const [sessions, setSessions] = useState<ListSessionRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  /** Per-course: all 10 sessions have theme_snapshot (for dropdown 「登録完了」). */
  const [assignmentCompleteByCourseId, setAssignmentCompleteByCourseId] = useState<Record<string, boolean>>({})

  const reloadCourses = useCallback(async (opts?: { lockedCourseId?: string }) => {
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
        setTermTargets([])
        setOrphanCourses([])
        setAssignmentCompleteByCourseId({})
        return
      }
      const rows = data.courses
      const terms = data.termTargets ?? []
      const orphans = data.orphanCourses ?? []
      setTermTargets(terms)
      setOrphanCourses(orphans)

      const allIds = new Set<string>()
      rows.forEach((c) => allIds.add(c.courseId))
      terms.forEach((t) => {
        if (t.courseId) allIds.add(t.courseId)
      })
      orphans.forEach((o) => allIds.add(o.courseId))

      const locked = opts?.lockedCourseId?.trim()
      setCourseId((prev) => {
        if (locked && allIds.has(locked)) return locked
        const keepPrev = prev && allIds.has(prev)
        if (keepPrev) return prev
        return pickDefaultCourseId('', terms, orphans, allIds)
      })

      const courseIds = [
        ...new Set(
          [
            ...terms.map((x) => x.courseId).filter((id): id is string => Boolean(id)),
            ...orphans.map((o) => o.courseId),
          ].filter(Boolean)
        ),
      ]
      if (courseIds.length === 0) {
        setAssignmentCompleteByCourseId({})
      } else {
        const pairs = await Promise.all(
          courseIds.map(async (id) => [id, await fetchAssignmentsCompleteForCourse(id)] as const)
        )
        setAssignmentCompleteByCourseId(Object.fromEntries(pairs))
      }
    } catch {
      setCoursesError('load_failed')
      setTermTargets([])
      setOrphanCourses([])
      setAssignmentCompleteByCourseId({})
    } finally {
      setCoursesLoading(false)
    }
  }, [])

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

  const loadList = useCallback(async (cid: string) => {
    if (!cid) return
    setListLoading(true)
    setListError(null)
    try {
      const q = new URLSearchParams({ courseId: cid })
      const res = await fetch(apiUrl(`/api/writing/admin/assignments/list?${q}`), {
        credentials: 'include',
      })
      const data = (await res.json()) as {
        ok?: boolean
        sessions?: ListSessionRow[]
        error?: string
      }
      if (!res.ok || !data.ok || !Array.isArray(data.sessions)) {
        setListError(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
        setSessions([])
        return
      }
      const listSessions = data.sessions
      setSessions(listSessions)
      setAssignmentCompleteByCourseId((prev) => ({
        ...prev,
        [cid]: assignmentsCompleteForCourseSessions(listSessions),
      }))
    } catch {
      setListError('load_failed')
      setSessions([])
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!courseId) return
    void loadList(courseId)
    setSelectedIndex(null)
  }, [courseId, loadList])

  /** Always 10 rows (1–10), even if the API returns fewer or no DB rows for some indices. */
  const displaySessions = useMemo((): ListSessionRow[] => {
    if (!courseId || listLoading || listError) return []
    const byIdx = new Map(sessions.map((s) => [s.sessionIndex, s]))
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
  }, [courseId, listLoading, listError, sessions])

  const selectedRow =
    selectedIndex != null ? displaySessions.find((s) => s.sessionIndex === selectedIndex) : null

  const detailUi = useMemo(() => {
    if (!selectedRow || !hasRegisteredThemeSnapshot(selectedRow.themeSnapshot)) return null
    return parseAssignmentSnapshotForUi(selectedRow.themeSnapshot)
  }, [selectedRow])

  const detailPanel =
    selectedIndex != null && selectedRow ? (
      <div className="rounded border border-[#c5c8cc] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">登録内容</p>
        <p className="mt-1 text-sm font-semibold text-[#2c2f32]">第{selectedIndex}回</p>
        <p className="mt-2">
          <Link
            to={`/writing/admin/assignments/new?courseId=${encodeURIComponent(courseId)}&sessionIndex=${selectedIndex}`}
            className="text-sm font-semibold text-[#4052b6] underline"
          >
            {hasRegisteredThemeSnapshot(selectedRow.themeSnapshot)
              ? 'この課題を編集する'
              : 'この回で課題を登録する'}
          </Link>
        </p>
        {!detailUi ? (
          <p className="mt-3 text-sm text-[#595c5e]">この回には課題が登録されていません。</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-xs font-bold text-[#595c5e]">theme</p>
              <p className="whitespace-pre-wrap text-[#2c2f32]">{detailUi.theme || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#595c5e]">title</p>
              <p className="whitespace-pre-wrap text-[#2c2f32]">{detailUi.displayTitle || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#595c5e]">prompt</p>
              <p className="whitespace-pre-wrap text-[#2c2f32]">{detailUi.prompt || detailUi.legacyInstruction || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#595c5e]">
                必須文法・表現（{ASSIGNMENT_REQUIREMENT_SLOT_COUNT}件）
              </p>
              <ol className="mt-1 list-decimal space-y-2 pl-5">
                {detailUi.requirements.slice(0, ASSIGNMENT_REQUIREMENT_SLOT_COUNT).map((r, i) => (
                  <li key={i} className="space-y-1">
                    <p>
                      <span className="text-[#595c5e]">レベル: </span>
                      {r.grammarLevel}
                    </p>
                    <p>
                      <span className="text-[#595c5e]">expressionLabel: </span>
                      {r.expressionLabel}
                    </p>
                    <p>
                      <span className="text-[#595c5e]">translationJa: </span>
                      {r.translationJa}
                    </p>
                    <p className="whitespace-pre-wrap">
                      <span className="text-[#595c5e]">exampleKo: </span>
                      {r.exampleKo}
                    </p>
                  </li>
                ))}
              </ol>
              {detailUi.requirements.length === 0 && detailUi.kind === 'legacy' ? (
                <p className="text-xs text-[#595c5e]">（レガシー形式のため要件ブロックはありません）</p>
              ) : null}
            </div>
            {detailUi.modelAnswer != null && String(detailUi.modelAnswer).trim() !== '' ? (
              <div>
                <p className="text-xs font-bold text-[#595c5e]">modelAnswer（管理者のみ）</p>
                <p className="mt-1 whitespace-pre-wrap rounded bg-[#f0f2f5] p-2 text-[#2c2f32]">
                  {detailUi.modelAnswer}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    ) : null

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-8 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32]">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Admin</p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">課題管理（一覧）</h1>
        <p className="mt-2 text-sm text-[#595c5e]">
          コースごとに回次（1〜10）の登録状況を確認し、プレビューまたは編集できます。各回のカードから登録・編集に進めます。
        </p>

        {coursesLoading ? (
          <p className="mt-6 text-sm text-[#595c5e]" role="status">
            コース一覧を読み込み中…
          </p>
        ) : null}
        {coursesError ? (
          <p className="mt-6 text-sm text-[#ba1a1a]" role="alert">
            コース一覧を取得できませんでした（{coursesError}）
          </p>
        ) : null}
        {termTargets.length === 0 && !coursesLoading && !coursesError ? (
          <div className="mt-6">
            <AdminCourseEmptyBootstrap onProvisioned={reloadCourses} />
          </div>
        ) : null}

        <div className="mt-8 space-y-4 text-sm">
          {ensuringCourse ? (
            <p className="text-sm text-[#595c5e]" role="status">
              選択した期のコースを準備中…
            </p>
          ) : null}
          <label className="block max-w-xl">
            <span className="font-semibold text-[#2c2f32]">対象コース（期）</span>
            <select
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={adminCourseSelectValue(courseId, termTargets, orphanCourses)}
              onChange={(e) => void handleCourseSelectChange(e.target.value)}
              disabled={coursesLoading || ensuringCourse || (termTargets.length === 0 && orphanCourses.length === 0)}
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
                      {t.courseId
                        ? formatCourseLabelWithAssignmentCompletion(
                            t.label,
                            assignmentCompleteByCourseId[t.courseId]
                          )
                        : t.label}
                    </option>
                  ))}
                  {orphanCourses.map((o) => (
                    <option key={o.courseId} value={`o:${o.courseId}`}>
                      {formatCourseLabelWithAssignmentCompletion(
                        o.displayName,
                        assignmentCompleteByCourseId[o.courseId]
                      )}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <AdminAssignmentsCsvImport
              courseId={courseId}
              disabled={coursesLoading || ensuringCourse || listLoading}
              onImported={async () => {
                await loadList(courseId)
                const ids = [
                  ...new Set([
                    ...termTargets.map((x) => x.courseId).filter((id): id is string => Boolean(id)),
                    ...orphanCourses.map((o) => o.courseId),
                  ]),
                ]
                if (ids.length === 0) return
                const pairs = await Promise.all(
                  ids.map(async (id) => [id, await fetchAssignmentsCompleteForCourse(id)] as const)
                )
                setAssignmentCompleteByCourseId(Object.fromEntries(pairs))
              }}
            />
          </div>

          <div className="space-y-6">
            <section className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">回次一覧</p>
              <AdminAssignmentsList
                courseId={courseId}
                displaySessions={displaySessions}
                selectedIndex={selectedIndex}
                onSelectSession={setSelectedIndex}
                listLoading={listLoading}
                listError={listError}
              />
            </section>

            <section className="min-w-0 space-y-4">
              {!listLoading && !listError && courseId ? (
                selectedIndex == null ? (
                  <div className="rounded border border-dashed border-[#c5c8cc] bg-white/60 px-4 py-3 text-sm text-[#595c5e]">
                    上の一覧から回次を選ぶと、ここに登録内容のプレビューが表示されます。
                  </div>
                ) : (
                  detailPanel
                )
              ) : null}
            </section>
          </div>
        </div>

        <p className="mt-8">
          <Link to="/writing/admin/assignments/new" className="text-sm font-semibold text-[#4052b6] underline">
            課題登録（新規）へ
          </Link>
        </p>
        <p className="mt-4">
          <Link to="/writing/admin" className="text-sm text-[#595c5e] underline">
            管理コンソールへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
