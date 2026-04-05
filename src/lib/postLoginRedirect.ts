import type { NavigateFunction } from 'react-router-dom'

import type { AuthMePayload } from '../types/authMe'

import { canAccessWritingStudentApp } from './authEntitlements'

/**
 * After successful login/signup session: server-driven redirect (no blind /app).
 */
export function postLoginRedirect(navigate: NavigateFunction, me: AuthMePayload): void {
  if (me.role === 'teacher' || me.role === 'admin') {
    navigate('/writing/teacher', { replace: true })
    return
  }
  if (canAccessWritingStudentApp(me.entitlements)) {
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
