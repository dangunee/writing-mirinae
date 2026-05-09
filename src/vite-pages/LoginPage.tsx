import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useRedirectIfLoggedIn } from '../hooks/useRedirectIfLoggedIn'
import { parseAuthUrlParams } from '../lib/authUrlParams'
import { apiUrl } from '../lib/apiUrl'
import { completeSessionLoginFlow } from '../lib/completeSessionLoginFlow'
import { readJsonBody } from '../lib/readJsonBody'
import { getSupabaseBrowserClient } from '../lib/supabaseBrowser'
import { startLineOAuth } from '../lib/startLineOAuth'

const GENERIC_LOGIN_ERROR = 'メールアドレスまたはパスワードが正しくありません。'
/** Session/me step failed after sign-in returned ok (no account-enumerating detail). */
const LOGIN_SESSION_GENERIC_ERROR = 'ログインに失敗しました。入力内容をご確認ください。'
/** OAuth callback redirect (?error=oauth) — keep distinct from password generic */
const OAUTH_CALLBACK_ERROR_MSG = 'ログインに失敗しました。しばらくしてからお試しください。'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: '로그인이 취소되었습니다.',
  exchange_failed: '세션 생성에 실패했습니다.',
  missing_code: '로그인 응답 오류',
}

const INK_GRADIENT =
  'bg-gradient-to-br from-[#000666] to-[#1a237e] shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-200'

/** One login form in the DOM at a time — avoids duplicate password fields + broken browser autofill. */
function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = () => setNarrow(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return narrow
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const parsedAuth = useMemo(
    () => parseAuthUrlParams(location.search, location.hash),
    [location.search, location.hash]
  )

  const oauthCode = useMemo(() => {
    if (parsedAuth.error || parsedAuth.errorCode) return ''
    return parsedAuth.code?.trim() ?? ''
  }, [parsedAuth])

  const skipSessionCheckWhileCode = oauthCode.length > 0
  const checkingSession = useRedirectIfLoggedIn(!skipSessionCheckWhileCode)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const submitLockRef = useRef(false)
  const codeExchangeStartedForRef = useRef<string | null>(null)
  const authUrlHandledRef = useRef<string | null>(null)
  const [codeExchangeFinished, setCodeExchangeFinished] = useState(() => oauthCode.length === 0)

  const narrow = useNarrowScreen()

  const authErrorFromQuery = useMemo(() => {
    const p = new URLSearchParams(location.search)
    const key = p.get('auth_error')?.trim() ?? ''
    return AUTH_ERROR_MESSAGES[key] ?? null
  }, [location.search])

  const oauthGoogleConflictError = useMemo(() => {
    const p = new URLSearchParams(location.search)
    if (p.get('error') === 'email_conflict_existing_account') {
      return 'このメールアドレスは既にメールログインで登録されています。ログイン後、設定画面からGoogle連携を行ってください。'
    }
    return null
  }, [location.search])

  const displayError = error ?? authErrorFromQuery ?? oauthGoogleConflictError

  /** Supabase / OAuth redirect errors in search or hash — never show raw Supabase text */
  useEffect(() => {
    const { code, error, errorCode } = parseAuthUrlParams(location.search, location.hash)
    const hasErr = Boolean(error || errorCode)
    const hasCode = Boolean(code?.trim())

    if (!hasErr && !hasCode) return
    if (!hasErr && hasCode) return

    const urlKey = `${location.pathname}${location.search}${location.hash}`
    if (authUrlHandledRef.current === urlKey) return
    authUrlHandledRef.current = urlKey

    if (hasErr && hasCode) {
      setError(GENERIC_LOGIN_ERROR)
      setCodeExchangeFinished(true)
      navigate('/writing/login', { replace: true })
      return
    }

    if (hasErr) {
      if (error === 'oauth' && !errorCode) {
        setError(OAUTH_CALLBACK_ERROR_MSG)
      } else {
        setError(GENERIC_LOGIN_ERROR)
      }
      setCodeExchangeFinished(true)
      navigate('/writing/login', { replace: true })
    }
  }, [location.pathname, location.search, location.hash, navigate])

  useEffect(() => {
    if (oauthCode) {
      setCodeExchangeFinished(false)
    } else {
      codeExchangeStartedForRef.current = null
      setCodeExchangeFinished(true)
    }
  }, [oauthCode])

  useEffect(() => {
    if (!oauthCode) return
    if (codeExchangeStartedForRef.current === oauthCode) return
    codeExchangeStartedForRef.current = oauthCode

    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(oauthCode)
        if (cancelled) return
        if (exchangeErr) {
          setError(GENERIC_LOGIN_ERROR)
          setCodeExchangeFinished(true)
          navigate('/writing/login', { replace: true })
          return
        }
        const result = await completeSessionLoginFlow(navigate)
        if (cancelled) return
        if (!result.ok) {
          setError('セッションの確認に失敗しました。しばらくしてからお試しください。')
          setCodeExchangeFinished(true)
          navigate('/writing/login', { replace: true })
          return
        }
        /* postLoginRedirectAsync navigates away; avoid setState after unmount */
      } catch {
        if (cancelled) return
        setError(GENERIC_LOGIN_ERROR)
        setCodeExchangeFinished(true)
        navigate('/writing/login', { replace: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [oauthCode, navigate])

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
      const data = await readJsonBody<{
        ok?: boolean
        error?: string
        expected?: 'google' | 'line'
      }>(res)

      // Primary failure: POST /api/auth/login (do not rely on /api/auth/me for wrong password).
      if (res.status === 401 || res.status === 403) {
        if (data?.error === 'wrong_login_method') {
          if (data.expected === 'google') {
            setError('Googleでログインしてください。')
          } else if (data.expected === 'line') {
            setError('LINEでログインしてください。')
          } else {
            setError(GENERIC_LOGIN_ERROR)
          }
        } else {
          setError(GENERIC_LOGIN_ERROR)
        }
        return
      }

      if (!res.ok) {
        if (res.status >= 500) {
          setError('通信に失敗しました。')
          return
        }
        if (!data) {
          setError('通信に失敗しました。')
          return
        }
        setError(GENERIC_LOGIN_ERROR)
        return
      }

      if (!data || data.ok !== true) {
        setError(GENERIC_LOGIN_ERROR)
        return
      }

      const sessionResult = await completeSessionLoginFlow(navigate)
      if (!sessionResult.ok) {
        setError(LOGIN_SESSION_GENERIC_ERROR)
        return
      }
    } catch {
      setError('通信に失敗しました。')
    } finally {
      setLoading(false)
      submitLockRef.current = false
    }
  }

  const showBlockingLoader = checkingSession || (skipSessionCheckWhileCode && !codeExchangeFinished)

  if (showBlockingLoader) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center px-6 py-12 font-body text-on-surface">
        <p className="text-sm text-on-surface-variant" role="status">
          {skipSessionCheckWhileCode ? 'ログイン処理中…' : '確認中…'}
        </p>
      </div>
    )
  }

  return (
    <div className="font-body text-on-surface min-h-screen min-h-[max(884px,100dvh)] flex flex-col bg-[#f6f6f8] md:bg-[#f3f4f6]">
      {narrow ? (
        <header className="fixed top-0 w-full z-50 bg-[#f6f6f8]/80 backdrop-blur-md border-b border-stone-200/50">
          <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
            <div className="font-headline text-xl font-extrabold tracking-tighter text-primary">
              ミリネ韓国語教室　作文トレーニング
            </div>
            <span className="material-symbols-outlined text-primary" aria-hidden>
              help_outline
            </span>
          </div>
        </header>
      ) : null}

      <main
        className={
          narrow
            ? 'flex-grow flex flex-col px-6 pt-24 pb-12'
            : 'flex-grow flex flex-col items-center justify-center px-6 py-12 md:py-24'
        }
      >
        {narrow ? (
        <div className="w-full max-w-md mx-auto bg-white p-8 md:p-10 rounded-2xl shadow-xl shadow-stone-200/50 space-y-8">
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
                    name="username"
                    type="email"
                    autoComplete="username"
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
                    name="password"
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

            {displayError ? (
              <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
                {displayError}
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
            <span className="flex-shrink mx-4 text-[10px] font-bold text-outline uppercase tracking-widest">
              または
            </span>
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
              <span className="text-sm font-bold text-on-surface-variant">Googleで続ける</span>
            </a>
            <button
              type="button"
              onClick={onLineOAuth}
              className="flex items-center justify-center gap-2 py-3.5 px-4 bg-[#06C755] rounded-lg hover:opacity-90 transition-opacity active:scale-95 duration-200"
            >
              <img
                alt=""
                className="w-5 h-5"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD3_gKAGnzM1QwAFhQB_gBr6jGczekVDR7WGemfwwbXDDCaxN2hNLz778dwhtEZ3RJHbYUcDDamkVYwJcLWk-_jjyXtbEFAoqe5nc5dgb8YxgZFSmNxl9bIk2ATaaS7rQm1lsxYfxZfMsqr-4rv7bu1G10N57DZaJOboDGXx3W__luGbU4zp0YTRDI7K0Rd7o7VYLRFkmPydZcmSwigeH_8TUE6fwqjjXc8j4cJKLCeCHRmjO_ojmAaW0vjzKqzreDTxJv5nF67TZA"
              />
              <span className="text-sm font-bold text-white">LINEで続ける</span>
            </button>
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
        ) : (
        <div className="grid max-w-5xl w-full grid-cols-12 gap-0 overflow-hidden bg-surface-container-lowest shadow-[0_10px_40px_rgba(30,27,19,0.04)] rounded-xl">
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
                      name="username"
                      type="email"
                      autoComplete="username"
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
                      name="password"
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

                {displayError ? (
                  <p className="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container" role="alert">
                    {displayError}
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
                  <span className="bg-surface-container-lowest px-4">または</span>
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
                    Googleで続ける
                  </span>
                </a>
                <button
                  type="button"
                  onClick={onLineOAuth}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-surface ring-1 ring-outline-variant/20 rounded-lg hover:bg-surface-container-low transition-colors duration-300"
                >
                  <div className="w-5 h-5 bg-[#06C755] flex items-center justify-center rounded-[2px]">
                    <span className="text-white text-[10px] font-bold">L</span>
                  </div>
                  <span className="font-label text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                    LINEで続ける
                  </span>
                </button>
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
        )}
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
