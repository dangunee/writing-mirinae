export type AuthRole = 'student' | 'teacher' | 'admin'

export type AuthEntitlements = {
  hasTrial: boolean
  hasActiveCourse: boolean
  isAcademyUnlimited: boolean
}

/** Authenticated GET /api/auth/me response (401 uses { ok: false } only). */
export type AuthMePayload = {
  ok: true
  user: { id: string; email: string | null }
  role: AuthRole | null
  entitlements: AuthEntitlements
}
