import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useRedirectIfLoggedIn } from '../hooks/useRedirectIfLoggedIn'
import { tryAcceptPendingInviteAfterAuth } from '../lib/academyInviteFlow'
import { apiUrl } from '../lib/apiUrl'
import { readJsonBody } from '../lib/readJsonBody'
import { postLoginRedirect } from '../lib/postLoginRedirect'
import type { AuthMePayload } from '../types/authMe'

const GENERIC_LOGIN_ERROR = 'メールアドレスまたはパスワードが正しくありません。'

const INK_GRADIENT =
  'bg-gradient-to-br from-[#000666] to-[#1a237e] shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const checkingSession = useRedirectIfLoggedIn()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submitLockRef = useRef(false)

  const oauthError = searchParams.get('error') === 'oauth'

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || submitLockRef.current) return
    submitLockRef.current = true
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await readJsonBody<{ ok?: boolean; error?: string }>(res)
      if (!data) {
        setError('通信に失敗しました。')
        return
      }
      if (!res.ok || data.ok !== true) {
        setError(GENERIC_LOGIN_ERROR)
        return
      }
      await tryAcceptPendingInviteAfterAuth()
      const meRes = await fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      if (!meRes.ok) {
        setError('セッションの確認に失敗しました。しばらくしてからお試しください。')
        return
      }
      const me = await readJsonBody<AuthMePayload>(meRes)
      if (!me?.entitlements) {
        setError('セッションの確認に失敗しました。しばらくしてからお試しください。')
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
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-6 py-12 font-body text-on-surface">
        <p className="text-sm text-on-surface-variant" role="status">
          確認中…
        </p>
      </div>
    )
  }

  return (
    <div className="font-body text-on-surface min-h-screen min-h-[max(884px,100dvh)] flex flex-col bg-[#f6f6f8] md:bg-[#f3f4f6]">
      <header className="md:hidden fixed top-0 w-full z-50 bg-[#f6f6f8]/80 backdrop-blur-md border-b border-stone-200/50">
        <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
          <div className="font-headline text-xl font-extrabold tracking-tighter text-primary">
            ミリネ韓国語教室　作文トレーニング
          </div>
          <span className="material-symbols-outlined text-primary" aria-hidden>
            help_outline
          </span>
        </div>
      </header>

      <main className="flex-grow flex flex-col md:items-center md:justify-center px-6 pt-24 pb-12 md:pt-12 md:pb-12 md:py-24">
        {/* Mobile: card stack */}
        <div className="md:hidden w-full max-w-md mx-auto bg-white p-8 md:p-10 rounded-2xl shadow-xl shadow-stone-200/50 space-y-8">
          <div className="space-y-3 text-center">
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">
              Welcome Back
            </span>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-primary leading-tight">
              修練の場へ
              <br />
              お帰りなさい
            </h1>
            <p className="text-on-surface-variant text-sm opacity-80">あなたの筆致を、さらに洗練させるために。</p>
          </div>

          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className="font-label text-xs font-bold text-primary tracking-wider uppercase ml-1"
                  htmlFor="login-email"
                >
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    className="w-full px-5 py-4 bg-surface-container-lowest border-none rounded-lg ring-1 ring-outline-variant/30 focus:ring-2 focus:ring-primary transition-all duration-300 placeholder:text-outline/50 text-on-surface"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-end ml-1">
                  <label
                    className="font-label text-xs font-bold text-primary tracking-wider uppercase"
                    htmlFor="login-password"
                  >
                    Password
                  </label>
                  <Link
                    to="/writing/forgot-password"
                    className="text-[10px] font-bold text-secondary uppercase tracking-tighter hover:opacity-70"
                  >
                    Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full px-5 py-4 bg-surface-container-lowest border-none rounded-lg ring-1 ring-outline-variant/30 focus:ring-2 focus:ring-primary transition-all duration-300 placeholder:text-outline/50 text-on-surface pr-12"
                  />
                  <button
                    type="button"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-pressed={showPassword}
                    aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  >
                    <span className="material-symbols-outlined">visibility</span>
                  </button>
                </div>
              </div>
            </div>

            {oauthError ? (
              <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
                ログインに失敗しました。しばらくしてからお試しください。
              </p>
            ) : null}
            {error ? (
              <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={`${INK_GRADIENT} w-full py-4 rounded-lg text-on-primary font-headline font-bold text-lg shadow-lg shadow-primary/10 disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
              ) : null}
              <span>ログイン</span>
            </button>
          </form>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-outline-variant/20" />
            <span className="flex-shrink mx-4 text-[10px] font-bold text-outline uppercase tracking-widest">または</span>
            <div className="flex-grow border-t border-outline-variant/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a
              href={apiUrl('/api/auth/oauth/google')}
              className="flex items-center justify-center gap-2 py-3.5 px-4 bg-surface-container-low rounded-lg border border-outline-variant/10 hover:bg-surface-container transition-colors active:scale-95 duration-200"
            >
              <img
                alt=""
                className="w-5 h-5"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBt7c6LeRoYnx6tuWw18h5ZuyR1cQ-mUt__1qrKfSQf2o0tfHuKhVutpReA5lF4jTDr6BYTAtHFkHaQAx5PnAu2gJBteu-pfl_0OLpcSaBGU5Ng2pgfsrmHCr0E075hPxcXdCyqBlco-NMeeo03gxbqBsy_3ee8DnVe074WuEh6bRjCAL5up9lj3xlqNvHxFroQQt5ZYHHVZ52SKSocVCXCFlIIVkjTuJjkMIRs-TiEZqU0DG8-gZpMUt3D3KgCNMBiv1ngFx6zZg4"
              />
              <span className="text-sm font-bold text-on-surface-variant">Google</span>
            </a>
            <a
              href={apiUrl('/api/auth/oauth/line')}
              className="flex items-center justify-center gap-2 py-3.5 px-4 bg-[#06C755] rounded-lg hover:opacity-90 transition-opacity active:scale-95 duration-200"
            >
              <img
                alt=""
                className="w-5 h-5"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD3_gKAGnzM1QwAFhQB_gBr6jGczekVDR7WGemfwwbXDDCaxN2hNLz778dwhtEZ3RJHbYUcDDamkVYwJcLWk-_jjyXtbEFAoqe5nc5dgb8YxgZFSmNxl9bIk2ATaaS7rQm1lsxYfxZfMsqr-4rv7bu1G10N57DZaJOboDGXx3W__luGbU4zp0YTRDI7K0Rd7o7VYLRFkmPydZcmSwigeH_8TUE6fwqjjXc8j4cJKLCeCHRmjO_ojmAaW0vjzKqzreDTxJv5nF67TZA"
              />
              <span className="text-sm font-bold text-white">LINE</span>
            </a>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm text-on-surface-variant font-medium">
              アカウントをお持ちでないですか？{' '}
              <Link
                to="/writing/signup"
                className="text-primary font-bold border-b-2 border-primary-fixed-dim hover:border-primary transition-all ml-1"
              >
                新規登録
              </Link>
            </p>
          </div>
        </div>

        {/* Desktop: split editorial layout */}
        <div className="hidden md:grid max-w-5xl w-full grid-cols-12 gap-0 overflow-hidden bg-surface-container-lowest shadow-[0_10px_40px_rgba(30,27,19,0.04)] rounded-xl">
          <div className="md:col-span-5 bg-primary-container relative p-12 flex flex-col justify-between overflow-hidden">
            <div className="relative z-10">
              <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-surface-bright mb-4">
                ミリネ韓国語教室　作文トレーニング
              </h1>
              <p className="text-on-primary-container font-medium text-lg max-w-xs leading-relaxed opacity-90">
                書を嗜む、静謐な時間。
                <br />
                言葉の美しさを探求する、現代の学舎へ。
              </p>
            </div>
            <div className="absolute inset-0 z-0">
              <img
                alt=""
                className="w-full h-full object-cover mix-blend-overlay opacity-30"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCXeQi85Fl0MQQfYiHVnrmEyXiJm-S_TKSPophmBhpLE3PbHato9G_OLhHt4VsgmB6aAdNbN5bl2tVcqshq0C5NC25f9lOty-TZm92MhiVFDGX-YI5Tn8whrUYL7Af16HeHj-t9snac7UT2lX3LPN7LBC0ikUWmpvynjTeHC4N8piJbz5htrSCu5rNmyUNVuudGnMIEend8IwCsBxzqDQNt7iOa7Y0jhhdbrqyK6z0cYlCkdJqCT3OzrRyHaFWiwabgGBNJlgExhqs"
              />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-[2px] bg-secondary-fixed-dim mb-4" />
              <p className="font-label text-[10px] tracking-[0.15em] text-on-primary-container">
                ミリネ作文トレーニング
              </p>
            </div>
          </div>

          <div className="md:col-span-7 p-8 md:p-16 lg:p-20 flex flex-col justify-center">
            <div className="max-w-md mx-auto w-full">
              <header className="mb-10 text-left">
                <h2 className="font-headline font-bold text-2xl text-primary tracking-tight mb-2">ログイン</h2>
                <p className="text-on-surface-variant text-sm">おかえりなさい。学習を再開しましょう。</p>
              </header>

              <form className="space-y-6" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <label
                    className="font-label text-[11px] font-bold text-on-surface uppercase tracking-wider"
                    htmlFor="login-email-desktop"
                  >
                    メールアドレス
                  </label>
                  <div className="relative">
                    <input
                      id="login-email-desktop"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="name@example.com"
                      className="w-full px-4 py-3 bg-surface border-none ring-1 ring-outline-variant/30 focus:ring-2 focus:ring-primary rounded-lg transition-all duration-300 placeholder:text-stone-300"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label
                      className="font-label text-[11px] font-bold text-on-surface uppercase tracking-wider"
                      htmlFor="login-password-desktop"
                    >
                      パスワード
                    </label>
                    <Link
                      to="/writing/forgot-password"
                      className="text-[11px] font-semibold text-primary hover:opacity-70 transition-opacity"
                    >
                      パスワードを忘れた場合
                    </Link>
                  </div>
                  <div className="relative group">
                    <input
                      id="login-password-desktop"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-surface border-none ring-1 ring-outline-variant/30 focus:ring-2 focus:ring-primary rounded-lg transition-all duration-300 placeholder:text-stone-300 pr-12"
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-pressed={showPassword}
                      aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                    >
                      <span className="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                  </div>
                </div>

                {oauthError ? (
                  <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
                    ログインに失敗しました。しばらくしてからお試しください。
                  </p>
                ) : null}
                {error ? (
                  <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full ${INK_GRADIENT} text-on-primary py-4 px-6 rounded-lg font-bold tracking-tight text-sm flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-on-primary/30 border-t-on-primary rounded-full animate-spin" />
                  ) : null}
                  <span>ログイン</span>
                </button>
              </form>

              <div className="relative my-10">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline-variant/20" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-outline">
                  <span className="bg-surface-container-lowest px-4">または他でログイン</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <a
                  href={apiUrl('/api/auth/oauth/google')}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-surface ring-1 ring-outline-variant/20 rounded-lg hover:bg-surface-container-low transition-colors duration-300"
                >
                  <img
                    alt=""
                    className="w-5 h-5 grayscale opacity-70"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0hvUXzdt37uZMkV8lZX-2ela1NuiUgR2Pg6-6XFKnDjMFW8NeS7Rv6hZAsvXXpdqvr3f4ChJb1_fmAj4ZQD9tdHE6kG76seyLBY6aPCUsauLkaii-x67WdrJHVXoDOhfd5iLARor9kIVIQWQ6y7tFuwM5DIitvFs_-X7WPezDgPRBybYj8Ea7EUn_-6kV4OwuMqPYffuyYlbrUBUBALFxCMKgw6UaHP2MVPXPFHYDAS2bHuXAA7Uf7Rnrs64eX7ouOhe_XNJ28aw"
                  />
                  <span className="font-label text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    Google
                  </span>
                </a>
                <a
                  href={apiUrl('/api/auth/oauth/line')}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-surface ring-1 ring-outline-variant/20 rounded-lg hover:bg-surface-container-low transition-colors duration-300"
                >
                  <div className="w-5 h-5 bg-[#06C755] flex items-center justify-center rounded-[2px]">
                    <span className="text-white text-[10px] font-bold">L</span>
                  </div>
                  <span className="font-label text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    LINE
                  </span>
                </a>
              </div>

              <footer className="mt-12 text-center">
                <p className="text-xs text-on-surface-variant">
                  アカウントをお持ちでないですか？{' '}
                  <Link to="/writing/signup" className="text-primary font-bold hover:underline underline-offset-4">
                    新規登録
                  </Link>
                </p>
              </footer>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-stone-200/50 bg-[#f6f6f8] md:bg-[#f3f4f6]">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-8 gap-4 max-w-7xl mx-auto w-full">
          <div className="font-['Manrope'] text-[10px] uppercase tracking-[0.05em] font-semibold text-stone-400 text-center md:text-left">
            © 2024 ミリネ韓国語教室　作文トレーニング
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            <a
              className="font-['Manrope'] text-[10px] uppercase tracking-[0.05em] font-semibold text-stone-400 hover:text-[#000666] transition-colors"
              href="#"
            >
              Privacy Policy
            </a>
            <a
              className="font-['Manrope'] text-[10px] uppercase tracking-[0.05em] font-semibold text-stone-400 hover:text-[#000666] transition-colors"
              href="#"
            >
              Terms of Service
            </a>
            <a
              className="font-['Manrope'] text-[10px] uppercase tracking-[0.05em] font-semibold text-stone-400 hover:text-[#000666] transition-colors"
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
