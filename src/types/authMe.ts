export type AuthRole = 'student' | 'teacher' | 'admin'

export type AuthEntitlements = {
  hasTrial: boolean
  hasActiveCourse: boolean
  isAcademyUnlimited: boolean
}

export type AuthMePayload = {
  user: { id: string; email: string | null } | null
  role: AuthRole | null
  entitlements: AuthEntitlements
}
