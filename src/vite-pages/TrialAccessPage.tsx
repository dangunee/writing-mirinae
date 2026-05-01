import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl, logApiFetch } from '../lib/apiUrl'

type Phase =
  | 'loading'
  | 'consuming'
  | 'invalid'
  | 'network_error'
  | 'done'
  | 'resume_submitted'
  | 'trial_no_submission'
  | 'needs_reissue'
  | 'consume_expired_link'
  | 'consume_submitted'
  | 'consume_used_other'
  | 'consume_application_expired'
  | 'consume_application_not_ready'

type SessionsCurrentBody = {
  ok?: boolean
  accessKind?: string
  submission?: {
    id?: string
    status?: string
  } | null
  mode?: string
  error?: string
}

async function parseSessionsCurrent(text: string): Promise<SessionsCurrentBody | null> {
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as SessionsCurrentBody
  } catch {
    return null
  }
}

async function fetchSessionsCurrent(): Promise<{ res: Response; body: SessionsCurrentBody | null }> {
  const res = await fetch(apiUrl('/api/writing/sessions/current'), { credentials: 'include' })
  const text = await res.text()
  const body = await parseSessionsCurrent(text)
  return { res, body }
}

/** 提出済み相当（draft 以外に submission がある） */
function submissionIndicatesSubmitted(sub: SessionsCurrentBody['submission']): boolean {
  if (!sub || typeof sub.status !== 'string') return false
  return sub.status !== 'draft'
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
 * Cookie / ログイン済みならトークンなしでも続行。POST consume は必要時のみ。
 */
export default function TrialAccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])
  const [phase, setPhase] = useState<Phase>('loading')
  const lock = useRef(false)

  useEffect(() => {
    if (lock.current) return
    lock.current = true

    ;(async () => {
      setPhase('loading')

      let initial: { res: Response; body: SessionsCurrentBody | null };
      try {
        initial = await fetchSessionsCurrent()
      } catch {
        initial = { res: new Response(null, { status: 0 }), body: null }
      }

      const trialOk = initial.res.ok && initial.body?.ok === true && initial.body.accessKind === 'trial'

      if (trialOk && submissionIndicatesSubmitted(initial.body!.submission)) {
        setPhase('resume_submitted')
        return
      }

      if (trialOk) {
        setPhase('trial_no_submission')
        return
      }

      if (!token) {
        setPhase('needs_reissue')
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
        const json = (await parseSessionsCurrent(text)) as
          | (SessionsCurrentBody & {
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

        let after: { res: Response; body: SessionsCurrentBody | null };
        try {
          after = await fetchSessionsCurrent()
        } catch {
          after = { res: new Response(null, { status: 0 }), body: null }
        }

        const trialAfter =
          after.res.ok && after.body?.ok === true && after.body.accessKind === 'trial'

        if (trialAfter && submissionIndicatesSubmitted(after.body!.submission)) {
          setPhase('resume_submitted')
          return
        }

        if (trialAfter) {
          setPhase('trial_no_submission')
          return
        }

        setPhase(phaseFromConsumeError(json.error, json.alreadySubmitted === true))
      } catch {
        setPhase('network_error')
      }
    })()
  }, [token])

  const submittedMessage =
    '提出済みです。結果はマイページまたは作成アプリで確認できます。'

  const message = (() => {
    if (phase === 'loading' || phase === 'consuming') return 'アクセスを確認しています…'
    if (phase === 'resume_submitted' || phase === 'consume_submitted') return submittedMessage
    if (phase === 'trial_no_submission')
      return 'リンクの有効期限が切れているか、既に別の環境で開いています。体験を続けるにはログインするか、新しいリンクを発行してください。続きから作成する場合は作成アプリを開いてください。'
    if (phase === 'needs_reissue' || phase === 'invalid')
      return 'リンクが無効か、トークンがありません。新しいリンクが必要な場合は再発行ページへお進みください。'
    if (phase === 'network_error') return '通信に失敗しました。しばらくしてから再度お試しください。'
    if (phase === 'done') return 'リダイレクト中…'
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

  const showSubmittedActions = phase === 'resume_submitted' || phase === 'consume_submitted'

  const showTrialContinueActions = phase === 'trial_no_submission'

  const showReissue =
    phase === 'needs_reissue' ||
    phase === 'invalid' ||
    phase === 'consume_expired_link' ||
    phase === 'consume_used_other'

  return (
    <div className="writing-page min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-on-surface font-body leading-relaxed max-w-md">{message}</p>

      {showSubmittedActions ? (
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            to="/writing/app"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#4052b6] px-6 py-2.5 text-sm font-bold text-white"
          >
            作成アプリへ
          </Link>
          <Link
            to="/writing/app/mypage"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#4052b6] px-6 py-2.5 text-sm font-bold text-[#4052b6]"
          >
            マイページへ
          </Link>
        </div>
      ) : null}

      {showTrialContinueActions ? (
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <Link
            to="/writing/app"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#4052b6] px-6 py-2.5 text-sm font-bold text-white"
          >
            作成アプリへ
          </Link>
          <Link
            to="/writing/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#4052b6] px-6 py-2.5 text-sm font-bold text-[#4052b6]"
          >
            ログインする
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

      {(showReissue || showTrialContinueActions) ? (
        <div
          className={`mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center ${showTrialContinueActions && !showReissue ? 'mt-6' : ''}`}
        >
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
