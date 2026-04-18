import { useCallback, useEffect, useMemo, useState } from 'react'
import AdminCourseEmptyBootstrap from '../admin/AdminCourseEmptyBootstrap'
import {
  adminCourseSelectValue,
  type AdminOrphanCourse,
  type AdminTermTarget,
  parseAdminCourseSelectValue,
  pickDefaultCourseId,
} from '../../lib/adminCourseTermSelect'
import { apiUrl } from '../../lib/apiUrl'

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

export type WritingAdminPreviewPayload = {
  courseId: string
  sessionIndex: number
  themeSnapshot: string | null
  sessionId: string | null
}

type Props = {
  onPreview: (data: WritingAdminPreviewPayload | null) => void
}

const SESSION_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1)

/**
 * 管理画面と同じ API でコース＋回次を選び、theme_snapshot を親に渡す（学習者画面のプレビュー用）。
 */
export default function WritingPageAdminPreview({ onPreview }: Props) {
  const [termTargets, setTermTargets] = useState<AdminTermTarget[]>([])
  const [orphanCourses, setOrphanCourses] = useState<AdminOrphanCourse[]>([])
  const [coursesLoading, setCoursesLoading] = useState(true)
  const [coursesError, setCoursesError] = useState<string | null>(null)
  const [ensuringCourse, setEnsuringCourse] = useState(false)
  const [courseId, setCourseId] = useState('')
  const [sessionIndex, setSessionIndex] = useState(1)
  const [sessions, setSessions] = useState<ListSessionRow[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

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
    } catch {
      setCoursesError('load_failed')
      setTermTargets([])
      setOrphanCourses([])
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
      const data = (await res.json()) as { ok?: boolean; sessions?: ListSessionRow[]; error?: string }
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
  }, [courseId, loadList])

  const displayRows = useMemo((): ListSessionRow[] => {
    if (!courseId || listLoading || listError) return []
    const byIdx = new Map(sessions.map((s) => [s.sessionIndex, s]))
    return Array.from({ length: 10 }, (_, i) => {
      const idx = i + 1
      return (
        byIdx.get(idx) ?? {
          sessionIndex: idx,
          sessionId: null,
          hasThemeSnapshot: false,
          themeSnapshot: null,
        }
      )
    })
  }, [courseId, listLoading, listError, sessions])

  const selectedRow = useMemo(() => {
    return displayRows.find((s) => s.sessionIndex === sessionIndex) ?? null
  }, [displayRows, sessionIndex])

  useEffect(() => {
    if (!courseId || listError) {
      onPreview(null)
      return
    }
    if (listLoading) {
      onPreview(null)
      return
    }
    if (!selectedRow) {
      onPreview(null)
      return
    }
    onPreview({
      courseId,
      sessionIndex,
      themeSnapshot: selectedRow.themeSnapshot,
      sessionId: selectedRow.sessionId,
    })
  }, [courseId, sessionIndex, selectedRow, listLoading, listError, onPreview])

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

  return (
    <div
      className="mb-4 rounded-xl border border-[#4052b6]/30 bg-[#f5f7ff] px-4 py-3 text-sm text-[#1e1b13] shadow-sm"
      role="region"
      aria-label="管理者プレビュー"
    >
      <p className="text-xs font-bold uppercase tracking-wider text-[#4052b6]">管理者プレビュー</p>
      <p className="mt-1 text-xs text-[#454652]">
        コース・回次を選ぶと、DB に保存された課題（theme_snapshot）をこの画面に表示します。提出はできません。
      </p>
      {coursesLoading ? (
        <p className="mt-2 text-xs text-[#595c5e]" role="status">
          コース一覧を読み込み中…
        </p>
      ) : null}
      {coursesError ? (
        <p className="mt-2 text-xs text-[#ba1a1a]" role="alert">
          {coursesError}
        </p>
      ) : null}
      {termTargets.length === 0 && !coursesLoading && !coursesError ? (
        <div className="mt-2">
          <AdminCourseEmptyBootstrap onProvisioned={reloadCourses} />
        </div>
      ) : null}
      {ensuringCourse ? (
        <p className="mt-2 text-xs text-[#595c5e]" role="status">
          コースを準備中…
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block min-w-[200px] flex-1 text-xs font-semibold text-[#2c2f32]">
          対象コース（期）
          <select
            className="mt-1 w-full rounded-lg border border-[#c5c8cc] bg-white px-3 py-2 text-sm text-[#2c2f32]"
            value={adminCourseSelectValue(courseId, termTargets, orphanCourses)}
            onChange={(e) => void handleCourseSelectChange(e.target.value)}
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
        <label className="block w-full min-w-[140px] sm:w-40 text-xs font-semibold text-[#2c2f32]">
          回次
          <select
            className="mt-1 w-full rounded-lg border border-[#c5c8cc] bg-white px-3 py-2 text-sm text-[#2c2f32]"
            value={sessionIndex}
            onChange={(e) => setSessionIndex(parseInt(e.target.value, 10) || 1)}
            disabled={!courseId || listLoading}
          >
            {SESSION_OPTIONS.map((n) => (
              <option key={n} value={n}>
                第{n}回
              </option>
            ))}
          </select>
        </label>
      </div>
      {listLoading ? (
        <p className="mt-2 text-xs text-[#595c5e]" role="status">
          課題データを読み込み中…
        </p>
      ) : null}
      {listError ? (
        <p className="mt-2 text-xs text-[#ba1a1a]" role="alert">
          一覧を取得できませんでした（{listError}）
        </p>
      ) : null}
    </div>
  )
}
