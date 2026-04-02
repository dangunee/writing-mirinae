import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import LandingNav from '../components/landing/LandingNav'
import { apiUrl, logApiFetch } from '../lib/apiUrl'
import '../landing.css'

type Phase =
  | 'loading'
  | 'invalid'
  | 'network_error'
  | 'ready'
  | 'consuming'
  | 'consume_error'

function isValidSuccess(
  json: unknown
): json is { ok: true; valid: true; application: { name: string; emailMasked: string } } {
  if (!json || typeof json !== 'object') return false
  const o = json as Record<string, unknown>
  if (o.ok !== true || o.valid !== true) return false
  const app = o.application
  if (!app || typeof app !== 'object') return false
  const a = app as Record<string, unknown>
  return typeof a.name === 'string' && typeof a.emailMasked === 'string'
}

export default function TrialStartPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

  const [phase, setPhase] = useState<Phase>('loading')
  const [applicantName, setApplicantName] = useState('')
  const [emailMasked, setEmailMasked] = useState('')
  const consumeLock = useRef(false)

  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])

  useEffect(() => {
    if (!token) {
      setPhase('invalid')
      return
    }

    let cancelled = false
    setPhase('loading')

    ;(async () => {
      try {
        const path = `/api/trial/access/validate?token=${encodeURIComponent(token)}`
        logApiFetch('GET', path)
        const res = await fetch(apiUrl(path), { credentials: 'omit' })
        const text = await res.text()
        let json: unknown = {}
        try {
          json = text ? JSON.parse(text) : {}
        } catch {
          if (!cancelled) setPhase('network_error')
          return
        }
        if (cancelled) return
        if (!res.ok) {
          setPhase('network_error')
          return
        }
        if (isValidSuccess(json)) {
          setApplicantName(json.application.name)
          setEmailMasked(json.application.emailMasked)
          setPhase('ready')
          return
        }
        setPhase('invalid')
      } catch {
        if (!cancelled) setPhase('network_error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  const onStart = useCallback(async () => {
    if (!token || consumeLock.current) return
    consumeLock.current = true
    setPhase('consuming')
    try {
      logApiFetch('POST', '/api/trial/access/consume')
      const res = await fetch(apiUrl('/api/trial/access/consume'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ token }),
      })
      const text = await res.text()
      let json: { ok?: boolean; redirectTo?: string; valid?: boolean } = {}
      try {
        json = text ? (JSON.parse(text) as typeof json) : {}
      } catch {
        setPhase('consume_error')
        return
      }
      if (json.ok === true && typeof json.redirectTo === 'string' && json.redirectTo.trim()) {
        let url = json.redirectTo.trim()
        if (url.includes('/writing/trial/submit')) {
          url = url.replace(/\/writing\/trial\/submit\b/, '/writing/app')
        }
        window.location.assign(url)
        return
      }
      setPhase('consume_error')
    } catch {
      setPhase('consume_error')
    }
  }, [token])

  return (
    <div className="trial-start-root min-h-screen bg-[#f5f7fa] text-[#2c2f32]">
      <LandingNav goApp={goApp} anchorBase="/writing" />

      <main className="mx-auto flex max-w-lg flex-col items-center px-6 pb-24 pt-28 text-center">
        {phase === 'loading' && (
          <>
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#eef1f4] text-[#4052b6]">
              <span className="material-symbols-outlined animate-pulse text-3xl">hourglass_top</span>
            </div>
            <p className="text-base leading-relaxed text-[#595c5e]">リンクを確認しています…</p>
          </>
        )}

        {phase === 'network_error' && (
          <>
            <p className="text-base leading-relaxed text-[#595c5e]">
              通信に失敗しました。しばらくしてからもう一度お試しください。
            </p>
          </>
        )}

        {(phase === 'invalid' || phase === 'consume_error') && (
          <>
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#fde8e8] text-[#c62828]">
              <span className="material-symbols-outlined text-3xl">link_off</span>
            </div>
            <h1 className="mb-3 text-xl font-bold text-[#2c2f32]">リンクを開けませんでした</h1>
            <p className="text-base leading-relaxed text-[#595c5e]">
              有効期限が切れているか、リンクが無効です。
              <br />
              お手数ですが、メールを再度ご確認いただくか、お問い合わせください。
            </p>
          </>
        )}

        {phase === 'ready' && (
          <>
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f5e9] text-[#2e7d32]">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                mark_email_read
              </span>
            </div>
            <h1 className="mb-3 text-xl font-bold text-[#2c2f32]">体験作文トレーニング</h1>
            <p className="mb-2 text-base leading-relaxed text-[#595c5e]">
              {applicantName ? `${applicantName} 様` : 'お客様'}
              <br />
              以下の内容で体験を開始できます。
            </p>
            <p className="mb-8 text-sm text-[#595c5e]">
              メール（マスク表示）: <span className="font-medium text-[#2c2f32]">{emailMasked}</span>
            </p>
            <button
              type="button"
              onClick={onStart}
              className="w-full max-w-sm rounded-full bg-[#4052b6] py-4 text-sm font-bold text-[#f3f1ff] shadow-lg shadow-[#4052b6]/25 transition hover:bg-[#3346a9]"
            >
              体験を始める
            </button>
          </>
        )}

        {phase === 'consuming' && (
          <>
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#eef1f4] text-[#4052b6]">
              <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
            </div>
            <p className="text-base leading-relaxed text-[#595c5e]">体験を準備しています…</p>
          </>
        )}
      </main>
    </div>
  )
}
