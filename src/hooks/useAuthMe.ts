import { useCallback, useEffect, useState } from 'react'

import { apiUrl } from '../lib/apiUrl'
import type { AuthMePayload } from '../types/authMe'

export type UseAuthMeResult = {
  me: AuthMePayload | null
  loading: boolean
  error: boolean
  refetch: () => Promise<void>
}

/**
 * GET /api/auth/me — cookie session; never client userId.
 */
export function useAuthMe(): UseAuthMeResult {
  const [me, setMe] = useState<AuthMePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      if (!res.ok) {
        setMe(null)
        setError(true)
        return
      }
      const data = (await res.json()) as AuthMePayload
      setMe(data)
    } catch {
      setMe(null)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { me, loading, error, refetch }
}
