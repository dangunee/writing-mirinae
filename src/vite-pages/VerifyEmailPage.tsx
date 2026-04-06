import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiUrl } from '../lib/apiUrl'
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser'

/**
 * Consumes one-time email verification token (LINE onboarding / email link).
 */
export default function VerifyEmailPage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'err'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token')?.trim() ?? ''
      if (!token) {
        if (!cancelled) {
          setStatus('err')
          setMessage('リンクが無効です。')
        }
        return
      }
      try {
        const res = await fetch(apiUrl('/api/auth/verify-email/complete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        })
        const data = (await res.json()) as { ok?: boolean; error?: string }
        if (cancelled) return
        if (res.ok && data.ok === true) {
          try {
            const supabase = getSupabaseBrowserClient()
            await supabase.auth.refreshSession()
          } catch {
            /* session refresh best-effort */
          }
          setStatus('ok')
          setMessage('メールアドレスを確認しました。')
          return
        }
        setStatus('err')
        setMessage('リンクの有効期限が切れたか、既に使用されています。')
      } catch {
        if (!cancelled) {
          setStatus('err')
          setMessage('通信に失敗しました。')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        {status === 'loading' ? (
          <p className="text-sm text-[#595c5e]" role="status">
            確認中…
          </p>
        ) : null}
        {status !== 'loading' && message ? (
          <p
            className={`text-sm ${status === 'ok' ? 'text-[#1e5d2a]' : 'text-[#8b1a1a]'}`}
            role={status === 'err' ? 'alert' : 'status'}
          >
            {message}
          </p>
        ) : null}
        <p className="mt-8 text-center">
          <Link to="/writing/login" className="text-sm font-semibold text-[#000666] underline">
            ログインへ
          </Link>
        </p>
      </div>
    </div>
  )
}
