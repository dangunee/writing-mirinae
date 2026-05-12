import { Link } from 'react-router-dom'

import { assignmentListPreviewLine, hasRegisteredThemeSnapshot } from '../../lib/writingThemeSnapshot'
import type { ListSessionRow } from '../../lib/adminAssignmentsCourseCompletion'

export type AdminAssignmentsListProps = {
  courseId: string
  displaySessions: ListSessionRow[]
  selectedIndex: number | null
  onSelectSession: (sessionIndex: number) => void
  listLoading: boolean
  listError: string | null
}

export default function AdminAssignmentsList({
  courseId,
  displaySessions,
  selectedIndex,
  onSelectSession,
  listLoading,
  listError,
}: AdminAssignmentsListProps) {
  if (listLoading) {
    return (
      <p className="text-sm text-[#595c5e]" role="status">
        セッション一覧を読み込み中…
      </p>
    )
  }

  if (listError) {
    return (
      <p className="text-sm text-[#ba1a1a]" role="alert">
        一覧を取得できませんでした（{listError}）
      </p>
    )
  }

  if (!courseId) {
    return <p className="text-xs text-[#595c5e]">コースを選んでください。</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {displaySessions.map((s) => {
        const registered = hasRegisteredThemeSnapshot(s.themeSnapshot)
        const preview = assignmentListPreviewLine(s.themeSnapshot)
        const createHref = `/writing/admin/assignments/new?courseId=${encodeURIComponent(courseId)}&sessionIndex=${s.sessionIndex}`
        return (
          <li
            key={s.sessionIndex}
            className={`rounded border border-[#c5c8cc] bg-white/80 p-3 shadow-sm transition-colors hover:bg-white hover:shadow-md ${
              selectedIndex === s.sessionIndex ? 'ring-2 ring-[#4052b6]' : ''
            }`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => onSelectSession(s.sessionIndex)}
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
  )
}
