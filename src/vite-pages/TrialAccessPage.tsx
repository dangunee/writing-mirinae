import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl, logApiFetch } from '../lib/apiUrl'

type Phase =
  | 'loading'
  | 'consuming'
  | 'invalid'
  | 'network_error'
  | 'done'
  | 'consume_expired_link'
  | 'consume_submitted'
  | 'consume_used_other'
  | 'consume_application_expired'
  | 'consume_application_not_ready'

type SessionsCurrentProbe = {
  ok?: boolean
  accessKind?: string
}

async function parseJsonSafe(text: string): Promise<SessionsCurrentProbe | null> {
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as SessionsCurrentProbe
  } catch {
    return null
  }
}

/** Cookie or logged-in trial_application.user_id — server decides (GET /sessions/current). */
async function redirectIfTrialSessionAvailable(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/writing/sessions/current'), { credentials: 'include' })
    const text = await res.text()
    const j = await parseJsonSafe(text)
    if (res.ok && j?.ok === true && j.accessKind === 'trial') {
      window.location.assign(new URL('/writing/app', window.location.origin).href)
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function phaseFromConsumeError(error: string | undefined, alreadySubmitted: boolean): Phase {
  switch (error) {
    case 'trial_access_token_expired':
      return 'consume_expired_link'
    case 'trial_access_token_already_used':
      return alreadySubmitted ? 'consume_submitted' : 'consume_used_other'
    case 'trial_application_access_expired':
      return 'consume_application_expired'
    case 'trial_application_access_not_ready':
      return 'consume_application_not_ready'
    default:
      return 'invalid'
  }
}

/**
 * 体験メールのリンク — /writing/trial/access?token=…
 * POST /api/writing/trial/access/consume → Cookie → /writing/app
 */
export default function TrialAccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])
  const [phase, setPhase] = useState<Phase>('loading')
  const lock = useRef(false)

  useEffect(() => {
    if (!token) {
      setPhase('invalid')
      return
    }

    if (lock.current) return
    lock.current = true

    ;(async () => {
      setPhase('loading')
      if (await redirectIfTrialSessionAvailable()) {
        setPhase('done')
        return
      }

      setPhase('consuming')
      try {
        logApiFetch('POST', '/api/writing/trial/access/consume')
        const res = await fetch(apiUrl('/api/writing/trial/access/consume'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ token }),
        })
        const text = await res.text()
        const json = (await parseJsonSafe(text)) as
          | (SessionsCurrentProbe & {
              redirectTo?: string
              error?: string
              alreadySubmitted?: boolean
            })
          | null

        if (!json) {
          setPhase('network_error')
          return
        }

        if (json.ok === true) {
          setPhase('done')
          const raw =
            typeof json.redirectTo === 'string' && json.redirectTo.trim()
              ? json.redirectTo.trim()
              : '/writing/app'
          const path = raw.startsWith('/') ? raw : '/writing/app'
          const safe =
            path === '/writing/intro' || path.startsWith('/writing/intro?') ? '/writing/app' : path
          window.location.assign(new URL(safe, window.location.origin).href)
          return
        }

        if (await redirectIfTrialSessionAvailable()) {
          setPhase('done')
          return
        }

        setPhase(
          phaseFromConsumeError(json.error, json.alreadySubmitted === true)
        )
      } catch {
        setPhase('network_error')
      }
    })()
  }, [token])

  const message = (() => {
    if (phase === 'loading' || phase === 'consuming') return 'アクセスを確認しています…'
    if (phase === 'invalid')
      return 'リンクが無効です。新しいリンクが必要な場合は下のボタンから再発行ページへお進みください。'
    if (phase === 'network_error') return '通信に失敗しました。しばらくしてから再度お試しください。'
    if (phase === 'done') return 'リダイレクト中…'
    if (phase === 'consume_submitted')
      return 'この体験課題はすでに提出済みです。提出内容はマイページから確認できます。'
    if (phase === 'consume_expired_link')
      return 'リンクの有効期限が切れています。提出済みの内容を確認する場合はログインしてください。新しいリンクが必要な場合は再発行してください。'
    if (phase === 'consume_used_other')
      return 'このリンクはすでに使用されています。提出済みの内容を確認する場合はログインしてください。別のブラウザや端末から続ける場合は、再発行リンクをご利用ください。'
    if (phase === 'consume_application_expired')
      return 'この体験の利用期限が終了しています。ご不明点はサポートまでお問い合わせください。'
    if (phase === 'consume_application_not_ready')
      return '現在この体験へのアクセスを開始できません。しばらくしてから再度お試しいただくか、再発行ページからお問い合わせください。'
    return ''
  })()

  const showReissue =
    phase === 'invalid' || phase === 'consume_expired_link' || phase === 'consume_used_other'

  return (
    <div className="writing-page min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-on-surface font-body leading-relaxed max-w-md">{message}</p>

      {phase === 'consume_submitted' ? (
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            to="/writing/app"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#4052b6] px-6 py-2.5 text-sm font-bold text-white"
          >
            作文アプリを開く
          </Link>
          <Link
            to="/writing/app/mypage"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#4052b6] px-6 py-2.5 text-sm font-bold text-[#4052b6]"
          >
            マイページへ
          </Link>
        </div>
      ) : null}

      {(phase === 'consume_expired_link' || phase === 'consume_used_other') ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            to="/writing/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#4052b6] px-6 py-2.5 text-sm font-bold text-white"
          >
            ログインする
          </Link>
        </div>
      ) : null}

      {showReissue ? (
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/writing/trial/reissue"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#4052b6] px-6 py-2.5 text-sm font-bold text-white"
          >
            新しいリンクを受け取る
          </Link>
          <button
            type="button"
            className="text-sm font-medium text-[#4052b6] underline"
            onClick={() => navigate('/writing')}
          >
            トップへ
          </button>
        </div>
      ) : null}

      {phase === 'consume_application_expired' || phase === 'consume_application_not_ready' ? (
        <button
          type="button"
          className="mt-8 text-sm font-medium text-[#4052b6] underline"
          onClick={() => navigate('/writing')}
        >
          トップへ
        </button>
      ) : null}

      {phase === 'network_error' ? (
        <button
          type="button"
          className="mt-6 text-primary underline"
          onClick={() => navigate('/writing')}
        >
          トップへ
        </button>
      ) : null}
    </div>
  )
}
