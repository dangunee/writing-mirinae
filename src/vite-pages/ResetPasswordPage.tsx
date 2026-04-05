import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { apiUrl } from '../lib/apiUrl'

type Phase = 'loading' | 'invalid' | 'form'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

  const [phase, setPhase] = useState<Phase>('loading')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const verify = useCallback(async () => {
    if (!token) {
      setPhase('invalid')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(apiUrl(`/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`), {
        credentials: 'include',
      })
      const data = (await res.json()) as { valid?: boolean }
      if (data.valid === true) {
        setPhase('form')
      } else {
        setPhase('invalid')
      }
    } catch {
      setPhase('invalid')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (!token) return
    void verify()
  }, [token, verify])

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h1 className="text-xl font-extrabold text-[#000666]">リンクを表示できません</h1>
          <p className="mt-4 text-sm leading-relaxed text-[#1e1b13]/80">
            リンクの有効期限が切れているか、すでに使用済みの可能性があります。お手数ですが、再度パスワード再設定をお申し込みください。
          </p>
          <p className="mt-8 text-center">
            <Link to="/writing/forgot-password" className="text-sm font-semibold text-[#000666] underline">
              パスワード再設定の申し込みへ
            </Link>
          </p>
          <p className="mt-6 text-center">
            <Link to="/writing/login" className="text-sm text-[#000666] underline">
              ログインへ
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || loading) return
    setError(null)
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません。')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(apiUrl('/api/auth/reset-password/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password, passwordConfirm }),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string }
      if (!res.ok || data.ok !== true) {
        if (data.error === 'password_policy' && data.message) {
          setError(data.message)
        } else {
          setError('リンクの有効期限が切れているか、すでに使用済みです。再度お手続きください。')
        }
        return
      }
      navigate('/writing/reset-password/complete', { replace: true })
    } catch {
      setError('通信に失敗しました。')
    } finally {
      setSubmitting(false)
    }
  }

  if (phase === 'invalid') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h1 className="text-xl font-extrabold text-[#000666]">リンクを表示できません</h1>
          <p className="mt-4 text-sm leading-relaxed text-[#1e1b13]/80">
            リンクの有効期限が切れているか、すでに使用済みの可能性があります。お手数ですが、再度パスワード再設定をお申し込みください。
          </p>
          <p className="mt-8 text-center">
            <Link to="/writing/forgot-password" className="text-sm font-semibold text-[#000666] underline">
              パスワード再設定の申し込みへ
            </Link>
          </p>
          <p className="mt-6 text-center">
            <Link to="/writing/login" className="text-sm text-[#000666] underline">
              ログインへ
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (phase === 'loading') {
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

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-xl font-extrabold text-[#000666]">新しいパスワード</h1>
        <p className="mt-2 text-sm text-[#1e1b13]/70">8文字以上・英字と数字を含めてください。</p>

        <form className="mt-8 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-semibold">
            新しいパスワード
            <div className="relative mt-1">
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-[#1e1b13]/20 px-3 py-2 pr-12 text-sm outline-none focus:border-[#000666]"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 min-h-[44px] min-w-[44px] -translate-y-1/2 rounded-md px-2 text-xs font-semibold text-[#000666]"
                onClick={() => setShowPw((v) => !v)}
                aria-pressed={showPw}
              >
                {showPw ? '隠す' : '表示'}
              </button>
            </div>
          </label>
          <label className="block text-sm font-semibold">
            パスワード（確認）
            <div className="relative mt-1">
              <input
                type={showPw2 ? 'text' : 'password'}
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-[#1e1b13]/20 px-3 py-2 pr-12 text-sm outline-none focus:border-[#000666]"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 min-h-[44px] min-w-[44px] -translate-y-1/2 rounded-md px-2 text-xs font-semibold text-[#000666]"
                onClick={() => setShowPw2((v) => !v)}
                aria-pressed={showPw2}
              >
                {showPw2 ? '隠す' : '表示'}
              </button>
            </div>
          </label>
          {error ? (
            <p className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-[#8b1a1a]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting || loading}
            className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#000666] py-2.5 text-sm font-bold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? '処理中…' : 'パスワードを設定する'}
          </button>
        </form>

        <p className="mt-8 text-center">
          <Link to="/writing/login" className="text-sm text-[#000666] underline">
            ログインへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
