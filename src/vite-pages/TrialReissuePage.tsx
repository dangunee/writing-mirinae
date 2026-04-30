import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LandingNav from '../components/landing/LandingNav'
import { trialPaymentApiUrl } from '../lib/apiUrl'
import '../landing.css'

export default function TrialReissuePage() {
  const navigate = useNavigate()
  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setError('有効なメールアドレスを入力してください。')
      return
    }

    console.log('reissue clicked')

    setLoading(true)
    try {
      const res = await fetch(trialPaymentApiUrl('/api/writing/trial/reissue-link'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const json = (await res.json()) as { ok?: boolean; message?: string; code?: string }
      if (json.ok === true && typeof json.message === 'string') {
        setMessage(json.message)
        setDone(true)
        return
      }
      if (json.ok === false && json.code === 'expired_access') {
        setError('体験のご利用期限が切れています。お問い合わせください。')
        return
      }
      if (json.ok === false && json.code === 'email_send_failed') {
        setError('メールの送信に失敗しました。しばらくしてから再度お試しください。')
        return
      }
      if (json.ok === false && json.code === 'REQUEST_FAILED') {
        setError('しばらくしてから再度お試しください。')
        return
      }
      setError('しばらくしてから再度お試しください。')
    } catch {
      setError('通信に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32] antialiased">
      <LandingNav goApp={goApp} />
      <main className="mx-auto flex w-full max-w-lg flex-grow flex-col px-4 pb-16 pt-8 md:pt-12">
        <h1 className="mb-2 text-2xl font-bold text-[#2c2f32]">体験リンクの再発行</h1>
        <p className="mb-8 text-sm leading-relaxed text-[#595c5e]">
          決済済みのお申し込みに、登録メールアドレス宛に体験開始用のリンクを再送します（決済後7日間の利用期限内に限ります）。
        </p>
        {done ? (
          <div className="rounded-xl border border-[#abadb0]/20 bg-white p-6 shadow-sm">
            <p className="text-center font-medium text-[#2c2f32]">{message}</p>
            <p className="mt-4 text-center text-sm text-[#595c5e]">
              メールをご確認のうえ、15分以内にリンクを開いてください。
            </p>
            <Link
              to="/writing"
              className="mt-6 block text-center text-sm font-semibold text-[#4052b6] underline"
            >
              ホームへ
            </Link>
          </div>
        ) : (
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="trial-reissue-email" className="mb-1 block text-xs font-medium text-[#595c5e]">
                メールアドレス
              </label>
              <input
                id="trial-reissue-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[#abadb0]/25 bg-white px-4 py-3 text-[#2c2f32] outline-none focus:border-[#4052b6]"
              />
            </div>
            {error ? (
              <p className="text-sm text-[#b42318]" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-[#4052b6] px-8 py-3.5 text-sm font-bold text-white shadow-sm transition-opacity disabled:opacity-60"
            >
              {loading ? '送信中…' : '体験リンクを再発行する'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
