import { useEffect, useState } from 'react'
import { Outlet, Navigate, useLocation } from 'react-router-dom'

import { apiUrl } from './lib/apiUrl'
import { canAccessWritingStudentApp } from './lib/authEntitlements'
import { setWritingSessionCurrentBootstrap } from './lib/writingSessionCurrentBootstrap'
import { writingSessionCurrentAllowsStudentApp } from './lib/writingSessionCurrentGate'
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

/**
 * Trial / student / regular-grant access from server only (writing_trial_access cookie, DB session).
 * Does NOT use Supabase /api/auth/me — matches GET /api/writing/sessions/current contract.
 */
async function fetchWritingSessionGate(): Promise<{
  allowed: boolean
  httpStatus: number
  bodyOk: boolean | undefined
}> {
  const curRes = await fetch(apiUrl('/api/writing/sessions/current'), { credentials: 'include' })
  let parsed: { ok?: boolean } | null = null
  try {
    const text = await curRes.text()
    if (text.trim()) {
      parsed = JSON.parse(text) as { ok?: boolean }
    }
  } catch {
    /* ignore parse errors */
  }
  if (curRes.status === 200 && parsed != null) {
    setWritingSessionCurrentBootstrap(parsed)
  }
  const allowed = curRes.status === 200 && writingSessionCurrentAllowsStudentApp(parsed)
  const bodyOk = parsed?.ok === true
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
 * /writing/app + /writing/app/complete
 *
 * Order (trial is independent of /api/auth/me):
 * 1) GET /api/writing/sessions/current — trial cookie, student course, or regular grant (200 + ok:true).
 * 2) /writing/app/complete — allow shell for card/bank without login (PaymentCompleteView / poll).
 * 3) Logged-in users only: /api/auth/me + entitlements / teacher / intro.
 */
export function EntitlementRouteGuard() {
  const [state, setState] = useState<EntitlementState>('loading')
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sessionGate = await fetchWritingSessionGate()
        if (cancelled) return
        console.info('trial_session_check_result', { context: 'session_first', ...sessionGate })

        if (sessionGate.allowed) {
          console.info('entitlement_guard_final_decision', {
            decision: 'allow',
            reason: 'writing_session_current',
          })
          setState('ok')
          return
        }

        if (location.pathname === '/writing/app/complete') {
          console.info('entitlement_guard_final_decision', {
            decision: 'allow',
            reason: 'payment_complete_shell',
          })
          setState('ok')
          return
        }

        const meRes = await fetchAuthMeWithRetry()
        if (cancelled) return

        if (meRes.status === 401) {
          console.info('entitlement_guard_final_decision', { decision: 'unauthorized', reason: 'no_writing_session_no_me' })
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

        if (data.role === 'teacher') {
          console.info('entitlement_guard_final_decision', { decision: 'teacher_redirect', reason: 'role' })
          setState('teacher_no_student_access')
          return
        }

        if (data.role === 'admin') {
          console.info('entitlement_guard_final_decision', { decision: 'allow', reason: 'admin_session_or_sandbox' })
          setState('ok')
          return
        }

        console.info('entitlement_guard_no_access', {
          path: location.pathname,
          userId: data.user.id,
          entitlements: data.entitlements,
        })
        console.info('entitlement_guard_final_decision', { decision: 'no_entitlement', reason: 'logged_in_no_entitlement' })
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

type AdminGuardState = 'loading' | 'ok' | 'unauthorized' | 'forbidden' | 'error'

/** ADMIN_USER_IDS のみ。GET /api/auth/me の role === admin */
export function AdminRouteGuard() {
  const [state, setState] = useState<AdminGuardState>('loading')
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
        if (data.role !== 'admin') {
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
