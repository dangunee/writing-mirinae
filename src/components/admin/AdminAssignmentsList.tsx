import { Link } from 'react-router-dom'

import { assignmentListPreviewLine, hasRegisteredThemeSnapshot } from '../../lib/writingThemeSnapshot'
import type { ListSessionRow } from '../../lib/adminAssignmentsCourseCompletion'

export type AdminAssignmentsListProps = {
  courseId: string
  displaySessions: ListSessionRow[]
  selectedIndex: number | null
  listLoading: boolean
  listError: string | null
  /** 一覧ページ: クリックで選択のみ */
  onSelectSession?: (sessionIndex: number) => void
  /** 編集ページ: クリックでその回の URL に遷移（設定時は onSelectSession より優先） */
  sessionEditHref?: (sessionIndex: number) => string
}

export default function AdminAssignmentsList({
  courseId,
  displaySessions,
  selectedIndex,
  onSelectSession,
  sessionEditHref,
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

  const hrefFn = sessionEditHref

  return (
    <ul className="flex w-full flex-col gap-2">
      {displaySessions.map((s) => {
        const registered = hasRegisteredThemeSnapshot(s.themeSnapshot)
        const preview = assignmentListPreviewLine(s.themeSnapshot)
        const rowInner = (
          <>
            <p className="font-semibold text-[#2c2f32]">第{s.sessionIndex}回</p>
            <p className="mt-1 break-words text-xs text-[#595c5e]">
              {registered ? (
                <>
                  <span className="text-[#1b5e20]">登録済み</span>
                  {preview ? ` — ${preview}` : ''}
                </>
              ) : (
                <span className="text-[#ba1a1a]">未登録</span>
              )}
            </p>
          </>
        )
        return (
          <li
            key={s.sessionIndex}
            className={`w-full rounded border border-[#c5c8cc] bg-white/80 p-3 shadow-sm transition-colors hover:bg-white hover:shadow-md ${
              selectedIndex === s.sessionIndex ? 'ring-2 ring-[#4052b6]' : ''
            }`}
          >
            {hrefFn ? (
              <Link
                to={hrefFn(s.sessionIndex)}
                className="block w-full rounded text-left text-inherit no-underline outline-none focus-visible:ring-2 focus-visible:ring-[#4052b6] focus-visible:ring-offset-2"
              >
                {rowInner}
              </Link>
            ) : (
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelectSession?.(s.sessionIndex)}
              >
                {rowInner}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
