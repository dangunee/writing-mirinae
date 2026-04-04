import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { trialAdminBffApiUrl } from '../lib/apiUrl'

const STORAGE_KEY = 'writing_trial_admin_bff_token'

type Row = {
  id: string
  applicantName: string
  applicantEmail: string
  koreanLevel: string | null
  createdAt: string
  paymentStatus: string
  accessStatus: string
}

function authHeaders(token: string): HeadersInit {
  const t = token.trim()
  if (!t) return {}
  return { Authorization: `Bearer ${t}` }
}

/** Vercel rewrite なしで単一 bff へ POST（__trial_admin_op + id） */
function trialAdminBffPostUrl(op: 'activate' | 'extend' | 'resend', applicationId: string): string {
  const q = new URLSearchParams({
    __trial_admin_op: op,
    id: applicationId,
  })
  return trialAdminBffApiUrl(`/api/writing/admin/bff?${q.toString()}`)
}

function formatJaDate(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat('ja-JP', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return iso
  }
}

export default function TrialApplicationsAdminPage() {
  const [tokenInput, setTokenInput] = useState('')
  const [token, setToken] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    const t = sessionStorage.getItem(STORAGE_KEY)?.trim() ?? ''
    setToken(t)
  }, [])

  const fetchList = useCallback(async (t: string) => {
    setLoading(true)
    setListError(null)
    try {
      const res = await fetch(trialAdminBffApiUrl('/api/writing/admin/trial-applications'), {
        headers: { ...authHeaders(t) },
      })
      const data = (await res.json()) as { ok?: boolean; items?: Row[]; error?: string }
      if (res.status === 401 || res.status === 403) {
        setListError('認証に失敗しました。トークンを確認してください。')
        setRows(null)
        return
      }
      if (!res.ok || data.ok !== true || !Array.isArray(data.items)) {
        setListError(data.error === 'server_misconfigured' ? 'サーバー設定を確認してください。' : '一覧の取得に失敗しました。')
        setRows(null)
        return
      }
      setRows(data.items)
    } catch {
      setListError('通信に失敗しました。')
      setRows(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!token) {
      setRows(null)
      return
    }
    void fetchList(token)
  }, [token, fetchList])

  const saveToken = () => {
    const t = tokenInput.trim()
    if (!t) return
    sessionStorage.setItem(STORAGE_KEY, t)
    setToken(t)
    setTokenInput('')
    setBanner(null)
  }

  const clearToken = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken('')
    setRows(null)
    setListError(null)
    setBanner(null)
  }

  const runActivate = async (id: string) => {
    setBusyId(id)
    setBanner(null)
    try {
      const res = await fetch(trialAdminBffPostUrl('activate', id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({}),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (!res.ok || data.ok !== true) {
        setBanner({ kind: 'err', text: '入金確認に失敗しました（状態を確認してください）。' })
        return
      }
      setBanner({ kind: 'ok', text: '入金確認が完了しました。' })
      await fetchList(token)
    } catch {
      setBanner({ kind: 'err', text: '通信に失敗しました。' })
    } finally {
      setBusyId(null)
    }
  }

  const runExtend = async (days: number, id: string) => {
    setBusyId(id)
    setBanner(null)
    try {
      const res = await fetch(trialAdminBffPostUrl('extend', id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ days }),
      })
      const data = (await res.json()) as { ok?: boolean; accessExpiresAt?: string; error?: string }
      if (!res.ok || data.ok !== true) {
        setBanner({ kind: 'err', text: '延長に失敗しました。' })
        return
      }
      const iso = data.accessExpiresAt
      setBanner({
        kind: 'ok',
        text: iso ? `利用期限を延長しました（期限の目安: ${iso}）` : '利用期限を延長しました。',
      })
      await fetchList(token)
    } catch {
      setBanner({ kind: 'err', text: '通信に失敗しました。' })
    } finally {
      setBusyId(null)
    }
  }

  const runResend = async (id: string) => {
    setBusyId(id)
    setBanner(null)
    try {
      const res = await fetch(trialAdminBffPostUrl('resend', id), {
        method: 'POST',
        headers: { ...authHeaders(token) },
      })
      const data = (await res.json()) as { ok?: boolean }
      if (!res.ok || data.ok !== true) {
        setBanner({ kind: 'err', text: '再送信に失敗しました（利用済みなどの可能性があります）。' })
        return
      }
      setBanner({ kind: 'ok', text: 'リンクを再送信しました。' })
      await fetchList(token)
    } catch {
      setBanner({ kind: 'err', text: '通信に失敗しました。' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-10 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Admin</p>
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">銀行振込 · 体験申込</h1>
            <p className="mt-1 text-sm text-[#595c5e]">入金確認とアクセスリンク再送信</p>
          </div>
          <Link
            to="/writing"
            className="inline-flex items-center justify-center rounded-full border border-[#abadb0]/40 bg-white px-4 py-2 text-sm font-semibold text-[#4052b6] shadow-sm"
          >
            サイトへ戻る
          </Link>
        </div>

        {!token ? (
          <div className="rounded-xl border border-[#abadb0]/20 bg-white p-6 shadow-sm">
            <p className="mb-3 text-sm text-[#595c5e]">
              BFF 用トークン（<code className="rounded bg-[#eef1f4] px-1">TRIAL_ADMIN_BFF_TOKEN</code>
              ）を入力してください。mirinae-api の <code className="rounded bg-[#eef1f4] px-1">TRIAL_ADMIN_SECRET</code>{' '}
              はサーバーにのみ設定されます。
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="BFF token"
                className="w-full flex-1 rounded-lg border border-[#abadb0]/40 px-3 py-2 text-sm outline-none focus:border-[#4052b6]"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={saveToken}
                className="rounded-full bg-[#4052b6] px-6 py-2 text-sm font-bold text-white shadow-md shadow-[#4052b6]/20"
              >
                保存して続行
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void fetchList(token)}
              disabled={loading}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2c2f32] shadow-sm ring-1 ring-[#abadb0]/30 disabled:opacity-50"
            >
              {loading ? '読み込み中…' : '再読み込み'}
            </button>
            <button
              type="button"
              onClick={clearToken}
              className="rounded-full border border-[#abadb0]/40 bg-transparent px-4 py-2 text-sm font-semibold text-[#595c5e]"
            >
              トークンを消去
            </button>
          </div>
        )}

        {banner ? (
          <div
            className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
              banner.kind === 'ok' ? 'bg-[#e8f8ec] text-[#0d5c24]' : 'bg-[#fde8e8] text-[#8b1a1a]'
            }`}
          >
            {banner.text}
          </div>
        ) : null}

        {token && listError ? (
          <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-[#8b1a1a]">{listError}</div>
        ) : null}

        {token && !listError && rows ? (
          <div className="overflow-x-auto rounded-xl border border-[#abadb0]/15 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#eef1f4] bg-[#f8fafc] text-xs font-bold uppercase tracking-wider text-[#595c5e]">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">お名前</th>
                  <th className="whitespace-nowrap px-4 py-3">メール</th>
                  <th className="whitespace-nowrap px-4 py-3">韓国語</th>
                  <th className="whitespace-nowrap px-4 py-3">申込日</th>
                  <th className="whitespace-nowrap px-4 py-3">payment</th>
                  <th className="whitespace-nowrap px-4 py-3">access</th>
                  <th className="whitespace-nowrap px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f4]">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-[#595c5e]">
                      銀行振込の申込はまだありません。
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const showActivate = r.paymentStatus === 'pending'
                    const showResend = r.paymentStatus === 'paid' && r.accessStatus === 'ready'
                    const busy = busyId === r.id
                    return (
                      <tr key={r.id} className="align-top">
                        <td className="px-4 py-3 font-medium">{r.applicantName}</td>
                        <td className="max-w-[200px] break-all px-4 py-3 text-[#595c5e]">{r.applicantEmail}</td>
                        <td className="px-4 py-3 text-[#595c5e]">{r.koreanLevel ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-[#595c5e]">{formatJaDate(r.createdAt)}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.paymentStatus}</td>
                        <td className="px-4 py-3 font-mono text-xs">{r.accessStatus}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row">
                            {showActivate ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runActivate(r.id)}
                                className="rounded-full bg-[#4052b6] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                              >
                                {busy ? '処理中…' : '入金確認'}
                              </button>
                            ) : null}
                            {showResend ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runResend(r.id)}
                                className="rounded-full border border-[#4052b6] bg-white px-3 py-1.5 text-xs font-bold text-[#4052b6] disabled:opacity-50"
                              >
                                {busy ? '処理中…' : 'リンク再送信'}
                              </button>
                            ) : null}
                            {showResend ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void runExtend(3, r.id)}
                                className="rounded-full border border-[#abadb0]/50 bg-[#f8fafc] px-3 py-1.5 text-xs font-bold text-[#2c2f32] disabled:opacity-50"
                              >
                                {busy ? '処理中…' : '3日延長'}
                              </button>
                            ) : null}
                            {!showActivate && !showResend ? (
                              <span className="text-xs text-[#95999c]">—</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {token && loading && !rows ? (
          <p className="text-center text-sm text-[#595c5e]">読み込み中…</p>
        ) : null}
      </div>
    </div>
  )
}
