import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { tryAcceptPendingInviteAfterAuth } from '../lib/academyInviteFlow'
import { apiUrl } from '../lib/apiUrl'
import { postLoginRedirectAsync } from '../lib/postLoginRedirect'
import type { AuthMePayload } from '../types/authMe'

/**
 * After OAuth callback sets cookies, client loads /writing/oauth-complete and routes by /api/auth/me.
 */
export default function OAuthCompletePage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
        if (cancelled) return
        if (res.status === 401 || !res.ok) {
          setError('セッションを確認できませんでした。')
          return
        }
        let me = (await res.json()) as AuthMePayload
        if (!me.ok || !me.user) {
          setError('ログインを完了できませんでした。')
          return
        }
        if (me.needsEmailOnboarding) {
          navigate('/writing/onboarding', { replace: true })
          return
        }
        await tryAcceptPendingInviteAfterAuth()
        const me2 = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
        if (me2.ok) {
          const parsed = (await me2.json()) as AuthMePayload
          if (parsed.ok && parsed.user) {
            me = parsed
          }
        }
        await postLoginRedirectAsync(navigate, me)
      } catch {
        if (!cancelled) setError('通信に失敗しました。')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-[#8b1a1a]" role="alert">
            {error}
          </p>
          <p className="mt-8 text-center">
            <Link to="/writing/login" className="text-sm font-semibold text-[#000666] underline">
              ログインへ
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <p className="text-sm text-[#595c5e]" role="status">
          確認中…
        </p>
      </div>
    </div>
  )
}
