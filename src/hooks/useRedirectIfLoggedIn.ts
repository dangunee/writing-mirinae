import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { apiUrl } from '../lib/apiUrl'
import { postLoginRedirectAsync } from '../lib/postLoginRedirect'
import type { AuthMePayload } from '../types/authMe'

/**
 * For public auth routes: if a session already exists, follow the same routing as post-login.
 * @param enabled — when false, skip the /me check (e.g. OAuth/email `code` exchange handles session first).
 */
export function useRedirectIfLoggedIn(enabled = true): boolean {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(() => enabled)

  useEffect(() => {
    if (!enabled) {
      setChecking(false)
      return
    }

    let cancelled = false
    setChecking(true)
    ;(async () => {
      let redirected = false
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
        if (cancelled || res.status === 401 || !res.ok) return
        const me = (await res.json()) as AuthMePayload
        if (me.ok && me.user) {
          await postLoginRedirectAsync(navigate, me)
          redirected = true
          /* Keep checking=true until route unmounts — avoids flashing signup while navigating. */
          return
        }
      } catch {
        /* stay on page */
      } finally {
        if (!cancelled && !redirected) setChecking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate, enabled])

  return checking
}
