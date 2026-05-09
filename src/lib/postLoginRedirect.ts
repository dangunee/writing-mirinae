import type { NavigateFunction } from 'react-router-dom'

import type { AuthMePayload } from '../types/authMe'

import { apiUrl } from './apiUrl'
import { canAccessWritingStudentApp } from './authEntitlements'
import { setWritingSessionCurrentBootstrap } from './writingSessionCurrentBootstrap'
import { writingSessionCurrentAllowsStudentApp } from './writingSessionCurrentGate'

/**
 * After successful login/signup session: server-driven redirect (no blind /app).
 *
 * Decision order:
 * 1. Email onboarding required → /writing/onboarding
 * 2. Admin → /writing (unchanged; no forced learner app)
 * 3. Teacher → /writing/teacher
 * 4. Learner writing access → /writing/app if either:
 *    - GET /api/writing/sessions/current allows app (ok:true or trial shell with applicationId), or
 *    - /api/auth/me entitlements (hasTrial | hasActiveCourse | isAcademyUnlimited)
 * 5. Else → /writing/intro (+ session banner)
 *
 * Never trusts client userId — uses cookie session only on fetch.
 */
export async function postLoginRedirectAsync(navigate: NavigateFunction, me: AuthMePayload): Promise<void> {
  if (me.needsEmailOnboarding) {
    navigate('/writing/onboarding', { replace: true })
    return
  }
  if (me.role === 'admin') {
    navigate('/writing', { replace: true })
    return
  }
  if (me.role === 'teacher') {
    navigate('/writing/teacher', { replace: true })
    return
  }

  let sessionAllowsApp = false
  try {
    const curRes = await fetch(apiUrl('/api/writing/sessions/current'), { credentials: 'include' })
    if (curRes.status === 200) {
      const text = await curRes.text()
      let parsed: unknown = null
      if (text.trim()) {
        try {
          parsed = JSON.parse(text) as unknown
        } catch {
          parsed = null
        }
      }
      if (parsed != null) {
        setWritingSessionCurrentBootstrap(parsed)
      }
      sessionAllowsApp = writingSessionCurrentAllowsStudentApp(parsed)
    }
  } catch {
    /* ignore — fall back to entitlements */
  }

  if (sessionAllowsApp || canAccessWritingStudentApp(me.entitlements)) {
    navigate('/writing/app', { replace: true })
    return
  }

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem('writing_intro_login_banner', '1')
    } catch {
      /* ignore */
    }
  }
  navigate('/writing/intro', { replace: true })
}
