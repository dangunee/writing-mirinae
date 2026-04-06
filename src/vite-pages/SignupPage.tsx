import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useRedirectIfLoggedIn } from '../hooks/useRedirectIfLoggedIn'
import { tryAcceptPendingInviteAfterAuth } from '../lib/academyInviteFlow'
import { apiUrl } from '../lib/apiUrl'
import { startLineOAuth } from '../lib/startLineOAuth'
import { readJsonBody } from '../lib/readJsonBody'
import { postLoginRedirect } from '../lib/postLoginRedirect'
import type { AuthMePayload } from '../types/authMe'

const GOOGLE_G_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCmviG4XQxTz3uJuetH2atFYbIr3HNSGkL-uPRjD6rG6hzw53PESRMJsnTo6WretCjOFAsbZ0UiJeEz8228dLTOdOhLHZ0UMTepDZPTPzPqmUTs8GLWQEdwwM2xQm49Wt5uDnluHpVkzrXhfZd90eE79a2_aX91zP0EGvXMuGAo96UAReKv934VLZRc306w2_G4MGyk7Cj_yFTzi0mrwEQGeKOkhJKcBRBV864jKoDfgxAcMu72hWbqX4WKf3FF5wfqI2T9DaDE2d8'

export default function SignupPage() {
  const navigate = useNavigate()
  const checkingSession = useRedirectIfLoggedIn()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submitLockRef = useRef(false)

  const onLineOAuth = () => {
    void (async () => {
      setError(null)
      try {
        await startLineOAuth('/writing/app')
      } catch {
        setError('ログインを開始できませんでした。')
      }
    })()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || submitLockRef.current) return
    if (!termsAccepted) {
      setError('利用規約およびプライバシーに関する告知に同意してください。')
      return
    }
    submitLockRef.current = true
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          passwordConfirm,
          termsAccepted: true,
        }),
      })
      const data = await readJsonBody<{
        ok?: boolean
        needsEmailConfirmation?: boolean
        error?: string
        message?: string
      }>(res)
      if (!data) {
        setError('通信に失敗しました。')
        return
      }
      if (!res.ok || data.ok !== true) {
        if (data.error === 'password_policy' && data.message) {
          setError(data.message)
        } else if (data.error === 'password_mismatch') {
          setError('パスワードが一致しません。')
        } else if (data.error === 'terms_required') {
          setError('利用規約およびプライバシーに関する告知に同意してください。')
        } else {
          setError('登録を完了できませんでした。入力内容をご確認ください。')
        }
        return
      }
      if (data.needsEmailConfirmation) {
        setInfo('確認メールを送信しました。メール内の手順を完了したあと、ログインしてください。')
        return
      }
      await tryAcceptPendingInviteAfterAuth()
      const meRes = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      if (meRes.status === 401 || !meRes.ok) {
        setError('セッションの確認に失敗しました。ログイン画面からお試しください。')
        return
      }
      const me = await readJsonBody<AuthMePayload>(meRes)
      if (!me?.ok || !me.user || !me?.entitlements) {
        setError('セッションの確認に失敗しました。ログイン画面からお試しください。')
        return
      }
      postLoginRedirect(navigate, me)
    } catch {
      setError('通信に失敗しました。')
    } finally {
      setLoading(false)
      submitLockRef.current = false
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center px-6 py-12 font-body text-on-surface">
        <p className="text-sm text-on-surface-variant" role="status">
          確認中…
        </p>
      </div>
    )
  }

  const termsLabel = (
    <>
      <span className="font-semibold text-primary">必須</span>
      ：利用規約およびプライバシーに関する告知に同意します。
    </>
  )

  return (
    <div className="font-body text-on-surface selection:bg-primary-fixed-dim selection:text-on-primary-fixed min-h-screen min-h-[max(884px,100dvh)] flex flex-col bg-[#f6f6f8] lg:bg-[#f6f6f8]">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 w-full z-50 backdrop-blur-md px-6 py-6 flex justify-between items-center bg-[#f6f6f8]/80">
        <div className="font-headline text-xl font-extrabold tracking-tighter text-primary">
          ミリネ韓国語教室　作文トレーニング
        </div>
        <Link
          to="/writing"
          className="text-on-surface-variant hover:opacity-80 transition-opacity"
          aria-label="閉じる"
        >
          <span className="material-symbols-outlined">close</span>
        </Link>
      </header>

      <header className="hidden lg:block fixed top-0 w-full z-50 dark:bg-stone-950/80 backdrop-blur-md shadow-[0_10px_40px_rgba(30,27,19,0.04)] bg-[#f6f6f8]/80">
        <nav className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="font-['Manrope'] text-xl font-extrabold tracking-tighter text-[#000666] dark:text-indigo-300">
            ミリネ韓国語教室　作文トレーニング
          </div>
          <div className="flex items-center gap-6">
            <span className="material-symbols-outlined text-stone-500 dark:text-stone-400 cursor-pointer hover:opacity-80 transition-opacity" aria-hidden>
              help_outline
            </span>
          </div>
        </nav>
      </header>

      <main className="flex flex-col flex-grow">
      <div className="lg:hidden min-h-screen pt-24 pb-12 px-6 max-w-md mx-auto flex flex-col">
        <div className="mb-10">
          <span className="font-label text-[10px] uppercase tracking-[0.2em] font-bold text-on-surface-variant block mb-2">
            Registration
          </span>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-primary leading-tight">
            新しい学びの扉を
            <br />
            開く
          </h1>
          <p className="text-on-surface-variant mt-3 text-sm font-medium">
            ミリネ韓国語教室　作文トレーニングへようこそ。あなたの学習の旅をここから始めましょう。
          </p>
        </div>

        <form className="flex flex-col gap-6" onSubmit={onSubmit}>
          <div className="space-y-5">
            <div className="relative">
              <label
                className="font-label text-[11px] uppercase tracking-wider font-bold text-on-surface-variant mb-1.5 block ml-1"
                htmlFor="signup-name-mobile"
              >
                氏名
              </label>
              <input
                id="signup-name-mobile"
                autoComplete="name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="山田 太郎"
                className="w-full border-none rounded-lg px-4 py-3.5 text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary-fixed-dim transition-all shadow-[0_2px_15px_rgba(30,27,19,0.02)] bg-white"
              />
            </div>
            <div className="relative">
              <label
                className="font-label text-[11px] uppercase tracking-wider font-bold text-on-surface-variant mb-1.5 block ml-1"
                htmlFor="signup-email-mobile"
              >
                メールアドレス
              </label>
              <input
                id="signup-email-mobile"
                autoComplete="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="w-full border-none rounded-lg px-4 py-3.5 text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary-fixed-dim transition-all shadow-[0_2px_15px_rgba(30,27,19,0.02)] bg-white"
              />
            </div>
            <div className="relative">
              <label
                className="font-label text-[11px] uppercase tracking-wider font-bold text-on-surface-variant mb-1.5 block ml-1"
                htmlFor="signup-password-mobile"
              >
                パスワード
              </label>
              <div className="relative">
                <input
                  id="signup-password-mobile"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full border-none rounded-lg px-4 py-3.5 pr-12 text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary-fixed-dim transition-all shadow-[0_2px_15px_rgba(30,27,19,0.02)] bg-white"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant"
                  onClick={() => setShowPw((v) => !v)}
                  aria-pressed={showPw}
                  aria-label={showPw ? 'パスワードを隠す' : 'パスワードを表示'}
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </div>
              <p className="mt-2 text-[11px] text-on-surface-variant leading-relaxed px-1">
                <span className="material-symbols-outlined text-[12px] align-middle mr-1">info</span>
                8文字以上、英数字と記号を組み合わせてください。
              </p>
            </div>
            <div className="relative">
              <label
                className="font-label text-[11px] uppercase tracking-wider font-bold text-on-surface-variant mb-1.5 block ml-1"
                htmlFor="signup-password2-mobile"
              >
                パスワード（確認）
              </label>
              <div className="relative">
                <input
                  id="signup-password2-mobile"
                  type={showPw2 ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full border-none rounded-lg px-4 py-3.5 pr-12 text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary-fixed-dim transition-all shadow-[0_2px_15px_rgba(30,27,19,0.02)] bg-white"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant"
                  onClick={() => setShowPw2((v) => !v)}
                  aria-pressed={showPw2}
                  aria-label={showPw2 ? '確認用パスワードを隠す' : '確認用パスワードを表示'}
                >
                  <span className="material-symbols-outlined text-[20px]">visibility</span>
                </button>
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 px-1 mt-2 cursor-pointer group">
            <input
              className="mt-1 w-4 h-4 rounded-sm border-outline-variant text-primary focus:ring-primary transition-colors cursor-pointer bg-white"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              required
            />
            <span className="text-xs text-on-surface-variant leading-relaxed">{termsLabel}</span>
          </label>

          {error ? (
            <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="rounded-lg bg-secondary-container/40 px-3 py-2 text-sm text-on-secondary-container" role="status">
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary font-headline font-bold py-4 rounded-lg shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
            ) : null}
            <span>アカウントを作成する</span>
            {!loading ? (
              <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">
                arrow_forward
              </span>
            ) : null}
          </button>
        </form>

        <div className="relative my-10 flex items-center justify-center">
          <div className="w-full h-px bg-outline-variant opacity-20" />
          <span className="absolute px-4 text-[10px] font-label font-bold text-outline uppercase tracking-widest bg-[#f6f6f8]">
            Or Register With
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <a
            href={apiUrl('/api/auth/oauth/google')}
            className="flex items-center justify-center gap-3 border border-outline-variant/10 py-3.5 rounded-lg hover:bg-white transition-colors active:scale-95 bg-white"
          >
            <div className="w-5 h-5 flex items-center justify-center">
              <svg height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <span className="text-xs font-bold font-headline text-on-surface">Google</span>
          </a>
          <button
            type="button"
            onClick={onLineOAuth}
            className="flex items-center justify-center gap-3 border border-outline-variant/10 py-3.5 rounded-lg hover:bg-white transition-colors active:scale-95 bg-white"
          >
            <svg fill="none" height="20" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M24 10.3043H18.2609V4.56522C18.2609 2.04348 16.2174 0 13.6957 0H10.3043C7.78261 0 5.73913 2.04348 5.73913 4.56522V10.3043H0V13.6957H5.73913V19.4348C5.73913 21.9565 7.78261 24 10.3043 24H13.6957C16.2174 24 18.2609 21.9565 18.2609 19.4348V13.6957H24V10.3043Z"
                fill="#06C755"
              />
            </svg>
            <span className="text-xs font-bold font-headline text-on-surface">LINE</span>
          </button>
        </div>

        <p className="text-center mt-10 text-sm text-on-surface-variant">
          すでにアカウントをお持ちですか？{' '}
          <Link to="/writing/login" className="text-primary font-bold hover:underline underline-offset-4">
            ログイン
          </Link>
        </p>

        <div className="fixed -bottom-20 -right-20 w-64 h-64 opacity-5 pointer-events-none select-none z-0">
          <div className="w-full h-full bg-primary rounded-full blur-3xl" />
        </div>
        <div className="fixed -top-10 -left-10 w-48 h-48 opacity-5 pointer-events-none select-none z-0">
          <div className="w-full h-full bg-secondary rounded-full blur-3xl" />
        </div>
      </div>

      <div className="hidden lg:flex min-h-screen pt-24 pb-12 items-center justify-center px-4 flex-grow">
        <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="hidden lg:block space-y-8">
            <div className="relative group">
              <div className="absolute -inset-4 bg-surface-container-low rounded-xl -z-10 transition-transform duration-500 group-hover:scale-105" />
              <h1 className="font-headline text-5xl font-extrabold text-primary leading-tight tracking-tighter">
                言葉を磨き、
                <br />
                知性を紡ぐ。
              </h1>
              <p className="mt-6 text-on-surface-variant font-medium leading-relaxed max-w-md">
                ミリネ韓国語教室　作文トレーニングは、書くことを通じて深い思考を育むための学習の場です。あなたの学びを、より洗練されたものへ。
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-secondary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <span className="font-label text-xs uppercase tracking-widest font-bold">精緻な添削システム</span>
              </div>
              <div className="flex items-center gap-4 text-secondary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <span className="font-label text-xs uppercase tracking-widest font-bold">パーソナライズされた学習計画</span>
              </div>
              <div className="flex items-center gap-4 text-secondary">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <span className="font-label text-xs uppercase tracking-widest font-bold">学術的なコミュニティ</span>
              </div>
            </div>
            <div className="pt-8 opacity-40">
              <div className="h-px bg-outline-variant w-32 mb-4" />
              <p className="font-label text-[10px] tracking-[0.15em] font-bold text-on-surface-variant">
                ミリネ作文トレーニング
              </p>
            </div>
          </div>

          <div className="w-full max-w-md mx-auto">
            <div className="bg-surface-container-lowest p-8 lg:p-10 rounded-xl shadow-[0_10px_40px_rgba(30,27,19,0.04)] relative">
              <div className="mb-8">
                <h2 className="font-headline text-2xl font-bold text-primary tracking-tight">アカウント作成</h2>
                <p className="text-on-surface-variant text-sm mt-1">アカウント作成のお手続きを始めましょう。</p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label
                    className="block font-label text-xs font-bold text-on-surface-variant tracking-wider uppercase"
                    htmlFor="signup-name-desktop"
                  >
                    氏名
                  </label>
                  <input
                    id="signup-name-desktop"
                    autoComplete="name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="山田 太郎"
                    className="w-full bg-surface-container px-4 py-3 rounded-lg border-none focus:ring-2 focus:ring-primary/20 placeholder:text-outline-variant text-on-surface transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="block font-label text-xs font-bold text-on-surface-variant tracking-wider uppercase"
                    htmlFor="signup-email-desktop"
                  >
                    メールアドレス
                  </label>
                  <input
                    id="signup-email-desktop"
                    autoComplete="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full bg-surface-container px-4 py-3 rounded-lg border-none focus:ring-2 focus:ring-primary/20 placeholder:text-outline-variant text-on-surface transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className="block font-label text-xs font-bold text-on-surface-variant tracking-wider uppercase"
                    htmlFor="signup-password-desktop"
                  >
                    パスワード
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password-desktop"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      className="w-full bg-surface-container px-4 py-3 pr-12 rounded-lg border-none focus:ring-2 focus:ring-primary/20 placeholder:text-outline-variant text-on-surface transition-all"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary"
                      onClick={() => setShowPw((v) => !v)}
                      aria-pressed={showPw}
                      aria-label={showPw ? 'パスワードを隠す' : 'パスワードを表示'}
                    >
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-on-surface-variant/70 font-medium">8文字以上・英数字を含めてください</p>
                </div>
                <div className="space-y-2">
                  <label
                    className="block font-label text-xs font-bold text-on-surface-variant tracking-wider uppercase"
                    htmlFor="signup-password2-desktop"
                  >
                    パスワード（確認）
                  </label>
                  <div className="relative">
                    <input
                      id="signup-password2-desktop"
                      type={showPw2 ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      className="w-full bg-surface-container px-4 py-3 pr-12 rounded-lg border-none focus:ring-2 focus:ring-primary/20 placeholder:text-outline-variant text-on-surface transition-all"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary"
                      onClick={() => setShowPw2((v) => !v)}
                      aria-pressed={showPw2}
                      aria-label={showPw2 ? '確認用パスワードを隠す' : '確認用パスワードを表示'}
                    >
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3 py-2">
                  <input
                    className="mt-1 w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                    id="terms-desktop"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    required
                  />
                  <label className="text-xs text-on-surface-variant leading-relaxed" htmlFor="terms-desktop">
                    {termsLabel}
                  </label>
                </div>

                {error ? (
                  <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
                    {error}
                  </p>
                ) : null}
                {info ? (
                  <p
                    className="rounded-lg bg-secondary-container/40 px-3 py-2 text-sm text-on-secondary-container"
                    role="status"
                  >
                    {info}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-primary text-on-primary font-bold rounded-lg shadow-sm hover:opacity-90 transition-all active:scale-[0.98] flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  ) : null}
                  <span>アカウントを作成する</span>
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-variant" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-surface-container-lowest px-4 text-on-surface-variant font-label tracking-widest uppercase font-bold">
                    または他サービスで登録
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <a
                  href={apiUrl('/api/auth/oauth/google')}
                  className="flex items-center justify-center gap-3 py-3 border border-surface-variant rounded-lg hover:bg-surface-container transition-colors active:scale-[0.98]"
                >
                  <img alt="" className="w-5 h-5" src={GOOGLE_G_IMG} />
                  <span className="text-xs font-bold text-on-surface-variant">Google</span>
                </a>
                <button
                  type="button"
                  onClick={onLineOAuth}
                  className="flex items-center justify-center gap-3 py-3 bg-[#06C755] text-white rounded-lg hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    chat
                  </span>
                  <span className="text-xs font-bold">LINE</span>
                </button>
              </div>

              <p className="mt-8 text-center text-xs text-on-surface-variant">
                既にアカウントをお持ちですか？{' '}
                <Link to="/writing/login" className="text-primary font-bold hover:underline">
                  ログイン
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      </main>

      <footer className="w-full border-t border-stone-200/15 dark:border-stone-800/15 bg-[#f6f6f8] mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-8 gap-4 max-w-7xl mx-auto">
          <div className="font-['Manrope'] text-[10px] uppercase tracking-[0.05em] font-semibold text-stone-400 dark:text-stone-600 text-center md:text-left">
            © 2024 ミリネ韓国語教室　作文トレーニング
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            <a
              className="font-['Manrope'] text-[10px] uppercase tracking-[0.05em] font-semibold text-stone-400 dark:text-stone-600 hover:text-[#000666] transition-colors"
              href="#"
            >
              Privacy Policy
            </a>
            <a
              className="font-['Manrope'] text-[10px] uppercase tracking-[0.05em] font-semibold text-stone-400 dark:text-stone-600 hover:text-[#000666] transition-colors"
              href="#"
            >
              Terms of Service
            </a>
            <a
              className="font-['Manrope'] text-[10px] uppercase tracking-[0.05em] font-semibold text-stone-400 dark:text-stone-600 hover:text-[#000666] transition-colors"
              href="#"
            >
              Security Guidelines
            </a>
          </div>
        </div>
        <p className="pb-6 text-center">
          <Link to="/writing" className="text-xs text-primary font-semibold hover:underline">
            トップへ戻る
          </Link>
        </p>
      </footer>
    </div>
  )
}
