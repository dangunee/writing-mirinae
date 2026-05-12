import { useMemo } from 'react'

import {
  adminCourseSelectValue,
  type AdminOrphanCourse,
  type AdminTermTarget,
} from '../../lib/adminCourseTermSelect'

/** Put sandbox / 体験など特殊コースを右端に寄せる（通常孤立コースより後ろ）。 */
function orphanSortScore(o: AdminOrphanCourse): number {
  if (o.isAdminSandbox) return 2
  if (o.displayName.includes('体験')) return 1
  return 0
}

export type AdminAssignmentsCoursePickerProps = {
  termTargets: AdminTermTarget[]
  orphanCourses: AdminOrphanCourse[]
  courseId: string
  assignmentCompleteByCourseId: Record<string, boolean>
  disabled: boolean
  onSelectCourse: (rawSelectValue: string) => void
}

/** Primary line shown on picker buttons (期名など). */
function orphanPrimaryLabel(displayName: string): string {
  const trimmed = displayName.trim()
  const idx = trimmed.indexOf(' · ')
  if (idx >= 0) return trimmed.slice(0, idx).trim() || trimmed
  return trimmed
}

export default function AdminAssignmentsCoursePicker({
  termTargets,
  orphanCourses,
  courseId,
  assignmentCompleteByCourseId,
  disabled,
  onSelectCourse,
}: AdminAssignmentsCoursePickerProps) {
  const selectValue = adminCourseSelectValue(courseId, termTargets, orphanCourses)

  const sortedTerms = useMemo(
    () => [...termTargets].sort((a, b) => a.sortOrder - b.sortOrder),
    [termTargets]
  )
  const sortedOrphans = useMemo(
    () => [...orphanCourses].sort((a, b) => orphanSortScore(a) - orphanSortScore(b)),
    [orphanCourses]
  )

  if (termTargets.length === 0 && orphanCourses.length === 0) {
    return <p className="text-xs text-[#595c5e]">（期またはコースがありません）</p>
  }

  const baseBtn =
    'inline-flex min-h-[2.75rem] flex-col justify-center rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50'
  const idleCls = `${baseBtn} border-[#c5c8cc] bg-white hover:bg-[#f5f7fa] hover:shadow-sm`
  const selectedCls = `${baseBtn} border-[#4052b6] bg-[#eef0fb] shadow-sm ring-2 ring-[#4052b6] ring-offset-2 ring-offset-[#f5f7fa]`

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="対象コース（期）">
      {sortedTerms.map((t) => {
        const raw = t.courseId ? `c:${t.courseId}` : `e:${t.termId}`
        const selected = selectValue === raw
        const hasCourse = Boolean(t.courseId)
        const complete = hasCourse ? assignmentCompleteByCourseId[t.courseId!] === true : false
        const statusLabel = complete ? '登録完了' : '準備中'
        const title = t.title.trim() || '（無題の期）'

        return (
          <button
            key={t.termId}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelectCourse(raw)}
            className={selected ? selectedCls : idleCls}
          >
            <span className="font-semibold text-[#2c2f32]">{title}</span>
            <span
              className={`mt-0.5 text-xs font-semibold ${complete ? 'text-[#1b5e20]' : 'text-[#595c5e]'}`}
            >
              {statusLabel}
            </span>
          </button>
        )
      })}
      {sortedOrphans.map((o) => {
        const raw = `o:${o.courseId}`
        const selected = selectValue === raw
        const complete = assignmentCompleteByCourseId[o.courseId] === true
        const statusLabel = complete ? '登録完了' : '準備中'
        const title = orphanPrimaryLabel(o.displayName)

        return (
          <button
            key={o.courseId}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onSelectCourse(raw)}
            className={selected ? selectedCls : idleCls}
          >
            <span className="font-semibold text-[#2c2f32]">{title}</span>
            <span
              className={`mt-0.5 text-xs font-semibold ${complete ? 'text-[#1b5e20]' : 'text-[#595c5e]'}`}
            >
              {statusLabel}
            </span>
          </button>
        )
      })}
    </div>
  )
}
