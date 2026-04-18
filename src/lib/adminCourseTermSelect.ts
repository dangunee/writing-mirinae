/** GET /api/writing/admin/courses の termTargets / orphanCourses 用（UI と ensure 連携） */

export type AdminTermTarget = {
  termId: string
  title: string
  sortOrder: number
  courseId: string | null
  label: string
}

export type AdminOrphanCourse = {
  courseId: string
  displayName: string
  status: string
  isAdminSandbox: boolean
  sessionCount: number
}

/** `<select>` の value（コース UUID 直置きではなくプレフィックスで ensure 行を判別） */
export function adminCourseSelectValue(
  courseId: string,
  termTargets: AdminTermTarget[],
  orphanCourses: AdminOrphanCourse[]
): string {
  if (!courseId) return ''
  if (termTargets.some((t) => t.courseId === courseId)) return `c:${courseId}`
  if (orphanCourses.some((o) => o.courseId === courseId)) return `o:${courseId}`
  return `c:${courseId}`
}

export type AdminCourseSelectParsed =
  | { kind: 'ensure'; termId: string }
  | { kind: 'course'; courseId: string }

export function parseAdminCourseSelectValue(raw: string): AdminCourseSelectParsed {
  if (raw.startsWith('e:')) {
    return { kind: 'ensure', termId: raw.slice(2) }
  }
  if (raw.startsWith('c:') || raw.startsWith('o:')) {
    return { kind: 'course', courseId: raw.slice(2) }
  }
  return { kind: 'course', courseId: raw }
}

/** 最初に選ぶコース: URL > 最初の期に紐づくコース > 孤立コース */
export function pickDefaultCourseId(
  urlCourseId: string,
  termTargets: AdminTermTarget[],
  orphanCourses: AdminOrphanCourse[],
  allCourseIds: Set<string>
): string {
  const url = urlCourseId.trim()
  if (url.length > 0 && allCourseIds.has(url)) return url
  const fromTerm = termTargets.find((t) => t.courseId)?.courseId
  if (fromTerm) return fromTerm
  return orphanCourses[0]?.courseId ?? ''
}
