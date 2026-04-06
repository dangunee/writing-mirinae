import { useEffect, useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'

import { apiUrl } from './lib/apiUrl'
import { canAccessWritingStudentApp } from './lib/authEntitlements'
import type { AuthMePayload } from './types/authMe'

type AuthGuardState = 'loading' | 'ok' | 'unauthorized' | 'error'

function loginPathWithNext(location: Pick<Location, 'pathname' | 'search'>): string {
  const next = encodeURIComponent(`${location.pathname}${location.search}`)
  return `/writing/login?next=${next}`
}

async function fetchAuthMeWithRetry(): Promise<Response> {
  let res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
  if (res.status === 401) {
    await new Promise((r) => setTimeout(r, 120))
    res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
  }
  return res
}

/** True when GET /api/writing/sessions/current returns 200 and JSON { ok: true } (trial / student / grant). */
async function checkWritingSessionGate(): Promise<{
  allowed: boolean
  httpStatus: number
  bodyOk: boolean | undefined
}> {
  const curRes = await fetch(apiUrl('/api/writing/sessions/current'), { credentials: 'include' })
  let json: { ok?: boolean } = {}
  try {
    const text = await curRes.text()
    if (text.trim()) {
      json = JSON.parse(text) as { ok?: boolean }
    }
  } catch {
    /* ignore parse errors */
  }
  const bodyOk = json.ok === true
  const allowed = curRes.status === 200 && bodyOk
  return { allowed, httpStatus: curRes.status, bodyOk }
}

/**
 * 로그인(세션) 필수 — GET /api/auth/me 의 user 로만 판단.
 */
export function AuthRouteGuard() {
  const [state, setState] = useState<AuthGuardState>('loading')
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        console.log('[StudentRouteGuard] auth check', { path: location.pathname })
        const res = await fetchAuthMeWithRetry()
        if (cancelled) return
        console.log('[StudentRouteGuard] auth check result', { path: location.pathname, status: res.status })
        if (res.status === 401) {
          setState('unauthorized')
          return
        }
        if (!res.ok) {
          setState('error')
          return
        }
        const data = (await res.json()) as AuthMePayload
        if (!data.ok || !data.user) {
          setState('unauthorized')
          return
        }
        setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search])

  if (state === 'loading') {
    return (
      <div className="writing-page">
        <p className="status pending">확인 중…</p>
      </div>
    )
  }
  if (state === 'unauthorized') {
    return <Navigate to={loginPathWithNext(location)} replace />
  }
  if (state === 'error') {
    return (
      <div className="writing-page">
        <p className="status pending">일시적으로 확인할 수 없습니다.</p>
      </div>
    )
  }
  return <Outlet />
}

type EntitlementState =
  | 'loading'
  | 'ok'
  | 'unauthorized'
  | 'no_entitlement'
  | 'teacher_no_student_access'
  | 'error'

/**
 * 체험 / 유료 코스 / academy_unlimited / trial cookie session.
 * /api/auth/me entitlements may all be false for trial-mail users; always fall back to sessions/current.
 */
export function EntitlementRouteGuard() {
  const [state, setState] = useState<EntitlementState>('loading')
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const meRes = await fetchAuthMeWithRetry()
        if (cancelled) return

        if (meRes.status === 401) {
          const gate = await checkWritingSessionGate()
          if (cancelled) return
          console.info('trial_session_check_result', {
            context: 'me_401',
            ...gate,
          })
          if (gate.allowed) {
            console.info('entitlement_guard_final_decision', { decision: 'allow', reason: 'trial_session_after_401' })
            setState('ok')
            return
          }
          console.info('entitlement_guard_final_decision', { decision: 'unauthorized', reason: 'no_me_no_session' })
          setState('unauthorized')
          return
        }

        if (!meRes.ok) {
          setState('error')
          return
        }

        const data = (await meRes.json()) as AuthMePayload
        if (!data.ok || !data.user) {
          setState('unauthorized')
          return
        }

        if (canAccessWritingStudentApp(data.entitlements)) {
          console.info('entitlement_guard_final_decision', { decision: 'allow', reason: 'me_entitlements' })
          setState('ok')
          return
        }

        console.info('entitlement_guard_no_access', {
          path: location.pathname,
          userId: data.user.id,
          entitlements: data.entitlements,
        })

        const gate = await checkWritingSessionGate()
        if (cancelled) return
        console.info('trial_session_check_result', {
          context: 'me_200_weak_entitlements',
          ...gate,
        })

        if (gate.allowed) {
          console.info('entitlement_guard_final_decision', {
            decision: 'allow',
            reason: 'trial_or_session_current_despite_me_entitlements',
          })
          setState('ok')
          return
        }

        if (data.role === 'teacher' || data.role === 'admin') {
          console.info('entitlement_guard_final_decision', { decision: 'teacher_redirect', reason: 'role' })
          setState('teacher_no_student_access')
          return
        }

        console.info('entitlement_guard_final_decision', { decision: 'no_entitlement', reason: 'me_and_session_denied' })
        setState('no_entitlement')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search])

  if (state === 'loading') {
    return (
      <div className="writing-page">
        <p className="status pending">확인 중…</p>
      </div>
    )
  }
  if (state === 'unauthorized') {
    return <Navigate to={loginPathWithNext(location)} replace />
  }
  if (state === 'teacher_no_student_access') {
    return <Navigate to="/writing/teacher" replace />
  }
  if (state === 'no_entitlement') {
    return <Navigate to="/writing/intro" replace />
  }
  if (state === 'error') {
    return (
      <div className="writing-page">
        <p className="status pending">일시적으로 확인할 수 없습니다.</p>
      </div>
    )
  }
  return <Outlet />
}

/** Alias for spec naming */
export { EntitlementRouteGuard as EntitlementGuard }

/** @deprecated Use AuthRouteGuard */
export { AuthRouteGuard as StudentRouteGuard }

type TeacherGuardState = 'loading' | 'ok' | 'unauthorized' | 'forbidden' | 'error'

/** 강사/관리자: GET /api/auth/me 의 role 로만 판단. */
export function TeacherRouteGuard() {
  const [state, setState] = useState<TeacherGuardState>('loading')
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetchAuthMeWithRetry()
        if (cancelled) return
        if (res.status === 401) {
          setState('unauthorized')
          return
        }
        if (!res.ok) {
          setState('error')
          return
        }
        const data = (await res.json()) as AuthMePayload
        if (!data.ok || !data.user) {
          setState('unauthorized')
          return
        }
        if (data.role !== 'teacher' && data.role !== 'admin') {
          setState('forbidden')
          return
        }
        setState('ok')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search])

  if (state === 'loading') {
    return (
      <div className="writing-page">
        <p className="status pending">확인 중…</p>
      </div>
    )
  }
  if (state === 'unauthorized') {
    return <Navigate to={loginPathWithNext(location)} replace />
  }
  if (state === 'forbidden') {
    return <Navigate to="/writing" replace />
  }
  if (state === 'error') {
    return (
      <div className="writing-page">
        <p className="status pending">일시적으로 확인할 수 없습니다.</p>
      </div>
    )
  }
  return <Outlet />
}
