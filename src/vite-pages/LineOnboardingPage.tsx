import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthMe } from '../hooks/useAuthMe'
import { apiUrl } from '../lib/apiUrl'
import { postLoginRedirectAsync } from '../lib/postLoginRedirect'
import { readJsonBody } from '../lib/readJsonBody'
import type { AuthMePayload } from '../types/authMe'

const LINE_CONFLICT_MSG =
  'このメールアドレスは既に別のログイン方法で登録されています。先にその方法でログインし、LINE連携を行ってください。'

/**
 * LINE OAuth users: required email + profile after verification.
 */
export default function LineOnboardingPage() {
  const navigate = useNavigate()
  const { me, loading, error, refetch } = useAuthMe()

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [koreanLevel, setKoreanLevel] = useState('')
  const [terms, setTerms] = useState(false)
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [submitState, setSubmitState] = useState<'idle' | 'submitting'>('idle')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!me?.ok || !me.user) return
    if (!me.needsEmailOnboarding) {
      void postLoginRedirectAsync(navigate, me)
    }
  }, [me, navigate])

  useEffect(() => {
    if (me?.user?.email) {
      setEmail(me.user.email)
    }
  }, [me?.user?.email])

  const onSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSendState('sending')
    try {
      await fetch(apiUrl('/api/auth/onboarding/line/send-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim() }),
      })
      setSendState('sent')
    } catch {
      setFormError('送信に失敗しました。')
      setSendState('idle')
    }
  }

  const onComplete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!terms || !name.trim() || !email.trim()) {
      setFormError('必須項目を入力してください。')
      return
    }
    setFormError(null)
    setSubmitState('submitting')
    try {
      const res = await fetch(apiUrl('/api/auth/onboarding/line/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          koreanLevel: koreanLevel.trim() || undefined,
          termsAccepted: true,
        }),
      })
      const data = await readJsonBody<{ ok?: boolean; error?: string }>(res)
      if (data?.error === 'email_conflict_existing_account') {
        setFormError(LINE_CONFLICT_MSG)
        setSubmitState('idle')
        return
      }
      if (!res.ok || data?.ok !== true) {
        if (data?.error === 'email_not_verified') {
          setFormError('メールアドレスの確認が完了していません。メール内のリンクを開いてください。')
        } else {
          setFormError('登録を完了できませんでした。')
        }
        setSubmitState('idle')
        return
      }
      await refetch()
      const meRes = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      const fresh = await readJsonBody<AuthMePayload>(meRes)
      if (fresh?.ok && fresh.user) {
        await postLoginRedirectAsync(navigate, fresh)
      } else {
        navigate('/writing/app', { replace: true })
      }
    } catch {
      setFormError('通信に失敗しました。')
      setSubmitState('idle')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
        <p className="text-sm text-[#595c5e]">読み込み中…</p>
      </div>
    )
  }

  if (error || !me?.ok) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
        <p className="text-sm text-[#8b1a1a]">セッションを確認できませんでした。</p>
      </div>
    )
  }

  const emailVerifiedOnAuth = Boolean(me.user.email?.trim())
  const showProfileForm = emailVerifiedOnAuth

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-12 font-['Manrope',sans-serif] text-[#1e1b13]">
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-lg font-bold text-[#000666]">アカウント登録を完了してください</h1>
        <p className="mt-2 text-sm text-[#595c5e]">
          LINEログインのため、メールアドレスの確認とプロフィール入力が必要です。
        </p>

        {!showProfileForm ? (
          <form className="mt-8 space-y-4" onSubmit={onSendEmail}>
            <div>
              <label className="block text-xs font-bold text-[#595c5e]" htmlFor="ob-email">
                メールアドレス
              </label>
              <input
                id="ob-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#1e1b13]/15 px-4 py-3 text-sm"
              />
            </div>
            {sendState === 'sent' ? (
              <div className="space-y-3">
                <p className="text-sm text-[#1e5d2a]">
                  確認メールを送信しました。メール内のリンクを開いたあと、下のボタンで状態を更新してください。
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="w-full rounded-lg border border-[#000666]/30 py-2 text-sm font-semibold text-[#000666]"
                >
                  メールを確認した（更新）
                </button>
              </div>
            ) : null}
            {formError ? (
              <p className="text-sm text-[#8b1a1a]" role="alert">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={sendState === 'sending'}
              className="w-full rounded-lg bg-[#000666] py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sendState === 'sending' ? '送信中…' : '確認メールを送信'}
            </button>
          </form>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={onComplete}>
            <div>
              <label className="block text-xs font-bold text-[#595c5e]" htmlFor="ob-name">
                お名前 <span className="text-[#8b1a1a]">*</span>
              </label>
              <input
                id="ob-name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#1e1b13]/15 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#595c5e]" htmlFor="ob-email2">
                メールアドレス（確認済み）
              </label>
              <input
                id="ob-email2"
                type="email"
                readOnly
                value={email}
                className="mt-1 w-full rounded-lg border border-[#1e1b13]/10 bg-[#f5f5f5] px-4 py-3 text-sm text-[#595c5e]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#595c5e]" htmlFor="ob-kr">
                韓国語レベル（任意）
              </label>
              <input
                id="ob-kr"
                type="text"
                value={koreanLevel}
                onChange={(e) => setKoreanLevel(e.target.value)}
                placeholder="例: 初級"
                className="mt-1 w-full rounded-lg border border-[#1e1b13]/15 px-4 py-3 text-sm"
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
                className="mt-1"
              />
              <span>利用規約に同意します</span>
            </label>
            {formError ? (
              <p className="text-sm text-[#8b1a1a]" role="alert">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitState === 'submitting'}
              className="w-full rounded-lg bg-[#000666] py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitState === 'submitting' ? '送信中…' : '登録を完了'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
