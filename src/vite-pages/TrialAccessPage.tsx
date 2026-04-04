import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl, logApiFetch } from '../lib/apiUrl'

type Phase = 'loading' | 'consuming' | 'invalid' | 'network_error' | 'done'

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
        let json: { ok?: boolean; redirectTo?: string; error?: string } = {}
        try {
          json = text ? (JSON.parse(text) as typeof json) : {}
        } catch {
          setPhase('network_error')
          return
        }
        if (json.ok === true && typeof json.redirectTo === 'string' && json.redirectTo.trim()) {
          const url = json.redirectTo.trim()
          setPhase('done')
          window.location.assign(url)
          return
        }
        setPhase('invalid')
      } catch {
        setPhase('network_error')
      }
    })()
  }, [token, navigate])

  const message = (() => {
    if (phase === 'loading' || phase === 'consuming') return 'アクセスを確認しています…'
    if (phase === 'invalid')
      return 'リンクが無効または期限切れです。新しいリンクが必要な場合は下のボタンから再発行ページへお進みください。'
    if (phase === 'network_error') return '通信に失敗しました。しばらくしてから再度お試しください。'
    if (phase === 'done') return 'リダイレクト中…'
    return ''
  })()

  return (
    <div className="writing-page min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
      <p className="text-on-surface font-body leading-relaxed max-w-md">{message}</p>
      {phase === 'invalid' ? (
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
