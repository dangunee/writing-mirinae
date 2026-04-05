import type { AuthEntitlements } from '../types/authMe'

export function canAccessWritingStudentApp(e: AuthEntitlements): boolean {
  return e.hasTrial || e.hasActiveCourse || e.isAcademyUnlimited
}
