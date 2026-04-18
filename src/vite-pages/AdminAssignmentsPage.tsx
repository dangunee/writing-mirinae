import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminCourseEmptyBootstrap from '../components/admin/AdminCourseEmptyBootstrap'
import { apiUrl } from '../lib/apiUrl'
import {
  ASSIGNMENT_REQUIREMENT_SLOT_COUNT,
  assignmentListPreviewLine,
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

type ListSessionRow = {
  sessionIndex: number
  sessionId: string | null
  hasThemeSnapshot: boolean
  themeSnapshot: string | null
}

export default function AdminAssignmentsPage() {
  const [courses, setCourses] = useState<AdminCourseOption[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState<string | null>(null)
  const [courseId, setCourseId] = useState('')

  const [sessions, setSessions] = useState<ListSessionRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const reloadCourses = useCallback(async () => {
    setCoursesLoading(true)
    setCoursesError(null)
    try {
      const res = await fetch(apiUrl('/api/writing/admin/courses'), { credentials: 'include' })
      const data = (await res.json()) as { ok?: boolean; courses?: AdminCourseOption[]; error?: string }
      if (!res.ok || !data.ok || !Array.isArray(data.courses)) {
        setCoursesError(typeof data.error === 'string' ? data.error : `HTTP ${res.status}`)
        setCourses([])
        return
      }
      setCourses(data.courses)
      if (data.courses.length > 0) {
        setCourseId((prev) => (prev ? prev : data.courses![0].courseId))
      }
    } catch {
      setCoursesError('load_failed')
      setCourses([])
    } finally {
      setCoursesLoading(false)
    }
  }, [])

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
      setSessions(data.sessions)
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
    ) : (
      <div className="rounded border border-dashed border-[#c5c8cc] bg-white/60 p-6 text-sm text-[#595c5e]">
        回次をリストから選ぶと、ここに登録内容が表示されます。
      </div>
    )

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-8 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32]">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Admin</p>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">課題管理（一覧）</h1>
        <p className="mt-2 text-sm text-[#595c5e]">
          コースごとに回次（1〜10）の登録状況を確認し、プレビューまたは編集できます。右のリンクからも登録・編集に進めます。
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
        {courses.length === 0 && !coursesLoading && !coursesError ? (
          <div className="mt-6">
            <AdminCourseEmptyBootstrap onProvisioned={reloadCourses} />
          </div>
        ) : null}

        <div className="mt-8 space-y-4 text-sm">
          <label className="block max-w-xl">
            <span className="font-semibold text-[#2c2f32]">対象コース</span>
            <select
              className="mt-1 w-full rounded border border-[#c5c8cc] bg-white px-3 py-2 text-[#2c2f32]"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              disabled={courses.length === 0}
            >
              {courses.length === 0 ? (
                <option value="">（アクティブなコースがありません）</option>
              ) : (
                courses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.displayName}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1 space-y-4 order-1">
              {listLoading ? (
                <p className="text-sm text-[#595c5e]" role="status">
                  セッション一覧を読み込み中…
                </p>
              ) : null}
              {listError ? (
                <p className="text-sm text-[#ba1a1a]" role="alert">
                  一覧を取得できませんでした（{listError}）
                </p>
              ) : null}
              {!listLoading && !listError ? detailPanel : null}
            </div>

            <aside className="w-full shrink-0 space-y-2 lg:w-72 order-2 lg:order-2">
              <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">回次一覧</p>
              {!listLoading && !listError && courseId ? (
                <ul className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                  {displaySessions.map((s) => {
                    const registered = hasRegisteredThemeSnapshot(s.themeSnapshot)
                    const preview = assignmentListPreviewLine(s.themeSnapshot)
                    const createHref = `/writing/admin/assignments/new?courseId=${encodeURIComponent(courseId)}&sessionIndex=${s.sessionIndex}`
                    return (
                      <li
                        key={s.sessionIndex}
                        className={`rounded border border-[#c5c8cc] bg-white/80 p-3 ${
                          selectedIndex === s.sessionIndex ? 'ring-2 ring-[#4052b6]' : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => setSelectedIndex(s.sessionIndex)}
                        >
                          <p className="font-semibold text-[#2c2f32]">第{s.sessionIndex}回</p>
                          <p className="mt-1 text-xs text-[#595c5e]">
                            {registered ? (
                              <>
                                <span className="text-[#1b5e20]">登録済み</span>
                                {preview ? ` — ${preview}` : ''}
                              </>
                            ) : (
                              <span className="text-[#ba1a1a]">未登録</span>
                            )}
                          </p>
                        </button>
                        <div className="mt-2">
                          <Link
                            to={createHref}
                            className="inline-block rounded bg-[#4052b6] px-3 py-1.5 text-xs font-semibold !text-white hover:!text-white focus-visible:!text-white"
                          >
                            {registered ? '編集/再登録' : '新規登録'}
                          </Link>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : !courseId && !listLoading && !listError ? (
                <p className="text-xs text-[#595c5e]">コースを選んでください。</p>
              ) : null}
            </aside>
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
