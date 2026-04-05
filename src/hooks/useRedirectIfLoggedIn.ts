import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { apiUrl } from '../lib/apiUrl'
import { postLoginRedirect } from '../lib/postLoginRedirect'
import type { AuthMePayload } from '../types/authMe'

/**
 * For public auth routes: if a session already exists, follow the same routing as post-login.
 */
export function useRedirectIfLoggedIn(): boolean {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
        if (cancelled || !res.ok) return
        const me = (await res.json()) as AuthMePayload
        if (me.user) {
          postLoginRedirect(navigate, me)
        }
      } catch {
        /* stay on page */
      } finally {
        if (!cancelled) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return checking
}
