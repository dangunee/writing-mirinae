export type AuthRole = 'student' | 'teacher' | 'admin'

export type AuthEntitlements = {
  hasTrial: boolean
  hasActiveCourse: boolean
  isAcademyUnlimited: boolean
}

export type LoginMethods = {
  email: boolean
  google: boolean
  line: boolean
}

/** Authenticated GET /api/auth/me response (401 uses { ok: false } only). */
export type AuthMePayload = {
  ok: true
  user: { id: string; email: string | null }
  role: AuthRole | null
  entitlements: AuthEntitlements
  loginMethods: LoginMethods
  needsEmailOnboarding: boolean
  profile: {
    name: string | null
    koreanLevel: string | null
    emailVerified: boolean
  } | null
}
