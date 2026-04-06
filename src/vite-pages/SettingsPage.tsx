import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuthMe } from '../hooks/useAuthMe'
import { apiUrl } from '../lib/apiUrl'
import { readJsonBody } from '../lib/readJsonBody'

/**
 * ログイン方法 — server truth from GET /api/auth/me only.
 */
export default function SettingsPage() {
  const { me, loading, error, refetch } = useAuthMe()
  const [linkEmail, setLinkEmail] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const linked = p.get('linked')
    const linkErr = p.get('link_error')
    if (linked === 'google' || linked === 'line') {
      setBanner({ kind: 'ok', text: '連携が完了しました。' })
      void refetch()
    }
    if (linkErr === 'already_linked') {
      setBanner({ kind: 'err', text: '既に連携済みです。' })
    } else if (linkErr === 'provider_already_used') {
      setBanner({
        kind: 'err',
        text: 'このログイン方法は別のアカウントで使用されています。',
      })
    } else if (linkErr === 'oauth_cancel') {
      setBanner({ kind: 'err', text: '連携がキャンセルされました。' })
    } else if (linkErr) {
      setBanner({ kind: 'err', text: '連携に失敗しました。' })
    }
  }, [refetch])

  const onLinkEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setBanner(null)
    setLinkBusy(true)
    try {
      const res = await fetch(apiUrl('/api/auth/link/email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: linkEmail.trim(), password: linkPassword }),
      })
      const data = await readJsonBody<{ ok?: boolean; error?: string }>(res)
      if (data?.error === 'already_linked') {
        setBanner({ kind: 'err', text: 'メールログインは既に追加済みです。' })
        setLinkBusy(false)
        return
      }
      setBanner({
        kind: 'ok',
        text: '確認メールを送信しました。メール内のリンクを開いてください。',
      })
      setLinkPassword('')
    } catch {
      setBanner({ kind: 'err', text: '送信に失敗しました。' })
    } finally {
      setLinkBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-12 font-['Manrope',sans-serif] text-[#1e1b13]">
        <p className="text-sm text-[#595c5e]">読み込み中…</p>
      </div>
    )
  }

  if (error || !me?.ok) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] px-4 py-12 font-['Manrope',sans-serif] text-[#1e1b13]">
        <p className="text-sm text-[#8b1a1a]">アカウント情報を取得できませんでした。</p>
      </div>
    )
  }

  const lm = me.loginMethods

  return (
    <div className="min-h-screen bg-[#F5F5F5] px-4 py-12 font-['Manrope',sans-serif] text-[#1e1b13]">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-[#000666]">設定</h1>
          <Link to="/writing/app/mypage" className="text-sm font-semibold text-[#000666] underline">
            マイページへ
          </Link>
        </div>

        {banner ? (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              banner.kind === 'ok' ? 'bg-[#e8f5e9] text-[#1e5d2a]' : 'bg-[#fde8e8] text-[#8b1a1a]'
            }`}
            role={banner.kind === 'err' ? 'alert' : 'status'}
          >
            {banner.text}
          </p>
        ) : null}

        <section className="rounded-2xl border border-[#1e1b13]/10 bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#1e1b13]">ログイン方法</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between gap-4">
              <span className="text-[#595c5e]">メール</span>
              <span className="font-medium">{lm.email ? '連携済み' : '未連携'}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-[#595c5e]">Google</span>
              <span className="font-medium">{lm.google ? '連携済み' : '未連携'}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span className="text-[#595c5e]">LINE</span>
              <span className="font-medium">{lm.line ? '連携済み' : '未連携'}</span>
            </li>
          </ul>

          <div className="mt-6 flex flex-col gap-3">
            <a
              href={apiUrl('/api/auth/link/google')}
              className="inline-flex justify-center rounded-lg border border-[#1e1b13]/15 bg-white px-4 py-3 text-sm font-semibold text-[#000666] hover:bg-[#f8f8f8]"
            >
              Googleを連携する
            </a>
            <a
              href={apiUrl('/api/auth/link/line')}
              className="inline-flex justify-center rounded-lg border border-[#1e1b13]/15 bg-white px-4 py-3 text-sm font-semibold text-[#000666] hover:bg-[#f8f8f8]"
            >
              LINEを連携する
            </a>
          </div>

          {!lm.email ? (
            <form className="mt-6 space-y-3 border-t border-[#1e1b13]/10 pt-6" onSubmit={onLinkEmail}>
              <p className="text-sm font-semibold text-[#1e1b13]">メールログインを追加する</p>
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="メールアドレス"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                className="w-full rounded-lg border border-[#1e1b13]/15 px-4 py-3 text-sm"
              />
              <input
                type="password"
                autoComplete="new-password"
                required
                placeholder="パスワード"
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                className="w-full rounded-lg border border-[#1e1b13]/15 px-4 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={linkBusy}
                className="w-full rounded-lg bg-[#000666] py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {linkBusy ? '送信中…' : '確認メールを送る'}
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  )
}
