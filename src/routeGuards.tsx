import { useEffect, useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { apiUrl } from './lib/apiUrl'

type StudentGuardState = 'loading' | 'ok' | 'unauthorized' | 'error'

/** 학생 화면: 로그인(세션) 여부만 확인. 401이 아니면 통과(200·404 등). */
export function StudentRouteGuard() {
  const [state, setState] = useState<StudentGuardState>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/writing/sessions/current'), {
          credentials: 'include',
        })
        if (cancelled) return
        if (res.status !== 401) {
          setState('ok')
          return
        }
        const trialRes = await fetch(apiUrl('/api/writing/trial/session/current'), {
          credentials: 'include',
        })
        if (cancelled) return
        if (trialRes.ok) {
          const data = (await trialRes.json()) as { ok?: boolean }
          if (data?.ok === true) {
            setState('ok')
            return
          }
        }
        const regularRes = await fetch(apiUrl('/api/writing/regular/session/current'), {
          credentials: 'include',
        })
        if (cancelled) return
        if (regularRes.ok) {
          const data = (await regularRes.json()) as { ok?: boolean }
          if (data?.ok === true) {
            setState('ok')
            return
          }
        }
        setState('unauthorized')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="writing-page">
        <p className="status pending">확인 중…</p>
      </div>
    )
  }
  if (state === 'unauthorized') {
    return (
      <div className="writing-page">
        <p className="status pending">
          로그인이 필요합니다. 체험은 메일의 접근 링크를 사용해 주세요. / ログインが必要です。体験はメールのリンクからアクセスしてください。
        </p>
      </div>
    )
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

type TeacherGuardState = 'loading' | 'ok' | 'unauthorized' | 'forbidden' | 'error'

/** 강사 화면: queue 조회로 권한 확인. 200만 통과. */
export function TeacherRouteGuard() {
  const [state, setState] = useState<TeacherGuardState>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/teacher/writing/submissions/queue'), {
          credentials: 'include',
        })
        if (cancelled) return
        if (res.status === 401) {
          setState('unauthorized')
          return
        }
        if (res.status === 403) {
          setState('forbidden')
          return
        }
        if (res.status === 200) {
          setState('ok')
          return
        }
        setState('error')
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="writing-page">
        <p className="status pending">확인 중…</p>
      </div>
    )
  }
  if (state === 'unauthorized') {
    return (
      <div className="writing-page">
        <p className="status pending">로그인이 필요합니다.</p>
      </div>
    )
  }
  if (state === 'forbidden') {
    return <Navigate to="/" replace />
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
