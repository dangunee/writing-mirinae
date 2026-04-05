import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiUrl } from '../lib/apiUrl'

const SUCCESS_COPY =
  'このメールアドレスにアカウントが登録されている場合、パスワード再設定用のリンクをお送りしました。メールが届かない場合は、迷惑メールフォルダもご確認ください。'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const submitLockRef = useRef(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || submitLockRef.current) return
    submitLockRef.current = true
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        setError('送信を完了できませんでした。しばらくしてからお試しください。')
        return
      }
      setDone(true)
    } catch {
      setError('通信に失敗しました。')
    } finally {
      setLoading(false)
      submitLockRef.current = false
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-xl font-extrabold text-[#000666]">パスワード再設定</h1>
        <p className="mt-2 text-sm text-[#1e1b13]/70">登録のメールアドレスに再設定用のリンクを送ります。</p>

        {done ? (
          <p className="mt-8 rounded-lg bg-[#e8f8ec] px-3 py-3 text-sm leading-relaxed text-[#0d5c24]" role="status">
            {SUCCESS_COPY}
          </p>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm font-semibold" htmlFor="forgot-email">
              メールアドレス
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full min-h-[44px] rounded-lg border border-[#1e1b13]/20 px-3 py-2 text-sm outline-none focus:border-[#000666]"
              />
            </label>
            {error ? (
              <p className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-[#8b1a1a]" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#000666] py-2.5 text-sm font-bold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? '送信中…' : '送信する'}
            </button>
          </form>
        )}

        <p className="mt-8 text-center">
          <Link to="/writing/login" className="text-sm font-semibold text-[#000666] underline">
            ログインへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
