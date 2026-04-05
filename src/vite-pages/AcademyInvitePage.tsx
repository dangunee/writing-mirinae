import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuthMe } from '../hooks/useAuthMe'
import { apiUrl } from '../lib/apiUrl'
import {
  clearPendingAcademyInviteToken,
  stashPendingAcademyInviteTokenFromQuery,
} from '../lib/academyInviteFlow'

type ValidateOk = {
  valid: true
  invitedEmail: string | null
  invitedName: string | null
  academyLabel: string | null
}

type ValidateBad = {
  valid: false
  reason: 'expired' | 'used' | 'invalid'
}

type ValidateState = 'loading' | 'error' | ValidateOk | ValidateBad

export default function AcademyInvitePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

  const { me, loading: meLoading, refetch: refetchMe } = useAuthMe()
  const [validate, setValidate] = useState<ValidateState>('loading')
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    stashPendingAcademyInviteTokenFromQuery(token || null)
  }, [token])

  const loadValidate = useCallback(async () => {
    if (!token) {
      clearPendingAcademyInviteToken()
      setValidate({ valid: false, reason: 'invalid' })
      return
    }
    setValidate('loading')
    try {
      const res = await fetch(apiUrl(`/api/academy-invites/validate?token=${encodeURIComponent(token)}`), {
        credentials: 'include',
      })
      const data = (await res.json()) as ValidateOk | ValidateBad
      if (data && 'valid' in data && data.valid === true) {
        setValidate(data)
      } else if (data && 'valid' in data && data.valid === false) {
        clearPendingAcademyInviteToken()
        setValidate(data)
      } else {
        setValidate('error')
      }
    } catch {
      setValidate('error')
    }
  }, [token])

  useEffect(() => {
    void loadValidate()
  }, [loadValidate])

  const loggedIn = Boolean(me?.user)

  const onAccept = async () => {
    if (!token || accepting) return
    setAcceptError(null)
    setAccepting(true)
    try {
      const res = await fetch(apiUrl('/api/academy-invites/accept'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      })
      if (!res.ok) {
        setAcceptError('招待を受け付けできませんでした。リンクの有効期限や対象アカウントをご確認ください。')
        return
      }
      clearPendingAcademyInviteToken()
      await refetchMe()
      navigate('/writing/app', { replace: true })
    } catch {
      setAcceptError('通信に失敗しました。')
    } finally {
      setAccepting(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h1 className="text-xl font-extrabold text-[#000666]">招待リンクが見つかりません</h1>
          <p className="mt-4 text-sm text-[#1e1b13]/80">URL をご確認ください。</p>
          <p className="mt-8 text-center">
            <Link to="/writing" className="text-sm font-semibold text-[#000666] underline">
              トップへ
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (validate === 'loading' || validate === 'error') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-[#595c5e]" role="status">
            {validate === 'error' ? '確認に失敗しました。' : '確認中…'}
          </p>
          {validate === 'error' ? (
            <p className="mt-6 text-center">
              <button
                type="button"
                className="text-sm font-semibold text-[#000666] underline"
                onClick={() => void loadValidate()}
              >
                再試行
              </button>
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  if (validate.valid === false) {
    const copy =
      validate.reason === 'expired'
        ? 'この招待の有効期限が切れています。'
        : validate.reason === 'used'
          ? 'この招待はすでに使用済みです。'
          : 'この招待リンクは利用できません。'
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
        <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <h1 className="text-xl font-extrabold text-[#000666]">招待をご利用いただけません</h1>
          <p className="mt-4 text-sm text-[#1e1b13]/80">{copy}</p>
          <p className="mt-8 text-center">
            <Link to="/writing" className="text-sm font-semibold text-[#000666] underline">
              トップへ
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const v = validate

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-16 font-['Manrope',sans-serif] text-[#1e1b13]">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-[#1e1b13]/10 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <h1 className="text-xl font-extrabold text-[#000666]">アカデミー招待</h1>
        {v.academyLabel ? (
          <p className="mt-2 text-sm font-semibold text-[#000666]">{v.academyLabel}</p>
        ) : null}
        {v.invitedName ? (
          <p className="mt-4 text-sm text-[#1e1b13]/80">
            <span className="font-semibold">お名前（招待）</span>：{v.invitedName}
          </p>
        ) : null}
        {v.invitedEmail ? (
          <p className="mt-2 text-sm text-[#1e1b13]/80">
            <span className="font-semibold">メール（招待）</span>：{v.invitedEmail}
          </p>
        ) : null}

        <p className="mt-6 text-sm leading-relaxed text-[#1e1b13]/80">
          このリンク自体ではログインしません。続けるには、まずログインまたは新規登録を完了してください。
        </p>

        {meLoading ? (
          <p className="mt-8 text-sm text-[#595c5e]">確認中…</p>
        ) : !loggedIn ? (
          <div className="mt-8 space-y-3">
            <Link
              to="/writing/login"
              className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#000666] py-2.5 text-sm font-bold uppercase tracking-widest text-white hover:opacity-90"
            >
              ログイン
            </Link>
            <Link
              to="/writing/signup"
              className="flex min-h-[48px] w-full items-center justify-center rounded-lg border border-[#1e1b13]/15 bg-white py-2.5 text-sm font-bold text-[#1e1b13] shadow-sm hover:bg-[#fafafa]"
            >
              新規登録
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <p className="text-sm text-[#1e1b13]/80">
              ログイン済みです。招待を受け入れると、アカデミー向けの利用設定が有効になります。
            </p>
            {acceptError ? (
              <p className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-[#8b1a1a]" role="alert">
                {acceptError}
              </p>
            ) : null}
            <button
              type="button"
              disabled={accepting}
              onClick={() => void onAccept()}
              className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#000666] py-2.5 text-sm font-bold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
            >
              {accepting ? '処理中…' : '招待を受け入れる'}
            </button>
          </div>
        )}

        <p className="mt-8 text-center">
          <Link to="/writing" className="text-sm text-[#000666] underline">
            トップへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}
