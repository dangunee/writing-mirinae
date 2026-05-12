import { apiUrl } from './apiUrl'
import { hasRegisteredThemeSnapshot } from './writingThemeSnapshot'

export type ListSessionRow = {
  sessionIndex: number
  sessionId: string | null
  hasThemeSnapshot: boolean
  themeSnapshot: string | null
}

/** True when sessions 1–10 all have a registered theme_snapshot. */
export function assignmentsCompleteForCourseSessions(sessions: ListSessionRow[]): boolean {
  const byIdx = new Map(sessions.map((s) => [s.sessionIndex, s]))
  for (let i = 1; i <= 10; i++) {
    const row = byIdx.get(i)
    if (!hasRegisteredThemeSnapshot(row?.themeSnapshot ?? null)) return false
  }
  return true
}

export async function fetchAssignmentsCompleteForCourse(courseId: string): Promise<boolean> {
  const q = new URLSearchParams({ courseId })
  const res = await fetch(apiUrl(`/api/writing/admin/assignments/list?${q}`), {
    credentials: 'include',
  })
  const data = (await res.json()) as {
    ok?: boolean
    sessions?: ListSessionRow[]
  }
  if (!res.ok || !data.ok || !Array.isArray(data.sessions)) return false
  return assignmentsCompleteForCourseSessions(data.sessions)
}

/**
 * When all 10 assignments are registered, show 「登録完了」instead of API suffix 「準備中」or 「active」.
 */
export function formatCourseLabelWithAssignmentCompletion(
  apiLabel: string,
  assignmentsComplete: boolean | undefined
): string {
  if (assignmentsComplete !== true) return apiLabel
  return apiLabel.replace(/ · (準備中|active)$/u, ' · 登録完了')
}
