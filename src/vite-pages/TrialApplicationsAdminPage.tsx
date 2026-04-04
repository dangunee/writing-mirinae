import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { trialAdminBffApiUrl } from '../lib/apiUrl'

const STORAGE_KEY = 'writing_trial_admin_bff_token'

const EXTEND_DAYS = 3

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'user_request', label: '学習者からの依頼' },
  { value: 'administrative_adjustment', label: '運用上の調整' },
  { value: 'payment_delay', label: '入金・確認の遅延' },
  { value: 'other', label: 'その他（詳細必須）' },
]

type Row = {
  id: string
  applicantName: string
  applicantEmail: string
  koreanLevel: string | null
  createdAt: string
  paymentMethod?: string
  paymentStatus: string
  accessStatus: string
  accessExpiresAt?: string | null
  lastExtendedAt?: string | null
  extendCount?: number
}

type PaymentMethodFilter = 'all' | 'card' | 'bank_transfer'

function paymentMethodLabel(m: string): string {
  const x = m.trim().toLowerCase()
  if (!x) return '—'
  if (x === 'card') return 'カード'
  if (x === 'bank_transfer' || x === 'bank') return '銀行振込'
  return m
}

type ExtensionLogItem = {
  id: string
  createdAt: string
  actorUserId: string
  actorLabel: string
  previousAccessExpiresAt: string
  newAccessExpiresAt: string
  extendedDays: number
  reasonCode: string
  reasonDetail: string | null
  status: string
  emailNoticeSent: boolean
  emailNoticeFailed: boolean
  emailFailureReason: string | null
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

function trialAdminFetch(input: string, init?: RequestInit): Promise<Response> {
  if (import.meta.env.DEV) {
    console.debug('[trial-admin]', init?.method ?? 'GET', input)
  }
  return fetch(input, init)
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

function mailStatusLabel(log: ExtensionLogItem): string {
  if (log.emailNoticeSent) return '送信済'
  if (log.emailNoticeFailed) return '失敗'
  return '—'
}

export default function TrialApplicationsAdminPage() {
  const [tokenInput, setTokenInput] = useState('')
  const [token, setToken] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const mutationInFlightRef = useRef(false)

  const [extendModal, setExtendModal] = useState<{
    id: string
    applicantName: string
  } | null>(null)
  const [extendReasonCode, setExtendReasonCode] = useState('user_request')
  const [extendReasonDetail, setExtendReasonDetail] = useState('')

  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)
  const [logsByAppId, setLogsByAppId] = useState<Record<string, ExtensionLogItem[] | 'loading' | 'error'>>({})
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(id)
  }, [searchInput])

  useEffect(() => {
    const t = sessionStorage.getItem(STORAGE_KEY)?.trim() ?? ''
    setToken(t)
  }, [])

  const fetchList = useCallback(async (t: string) => {
    setLoading(true)
    setListError(null)
    try {
      const q = new URLSearchParams()
      if (paymentMethodFilter !== 'all') {
        q.set('paymentMethod', paymentMethodFilter)
      }
      if (debouncedSearch.length > 0) {
        q.set('query', debouncedSearch)
      }
      const qs = q.toString()
      const listUrl = `/api/writing/admin/trial-applications${qs ? `?${qs}` : ''}`
      const res = await trialAdminFetch(trialAdminBffApiUrl(listUrl), {
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
  }, [paymentMethodFilter, debouncedSearch])

  useEffect(() => {
    if (!token) {
      setRows(null)
      return
    }
    void fetchList(token)
  }, [token, fetchList])

  const fetchExtensionLogs = useCallback(
    async (applicationId: string, t: string) => {
      setLogsByAppId((prev) => ({ ...prev, [applicationId]: 'loading' }))
      try {
        const res = await trialAdminFetch(
          trialAdminBffApiUrl(`/api/writing/admin/trial-applications/${encodeURIComponent(applicationId)}/extension-logs`),
          { headers: { ...authHeaders(t) } }
        )
        const data = (await res.json()) as { ok?: boolean; items?: ExtensionLogItem[] }
        if (!res.ok || data.ok !== true || !Array.isArray(data.items)) {
          setLogsByAppId((prev) => ({ ...prev, [applicationId]: 'error' }))
          return
        }
        setLogsByAppId((prev) => ({ ...prev, [applicationId]: data.items! }))
      } catch {
        setLogsByAppId((prev) => ({ ...prev, [applicationId]: 'error' }))
      }
    },
    []
  )

  const toggleHistory = (applicationId: string) => {
    if (historyOpenId === applicationId) {
      setHistoryOpenId(null)
      return
    }
    setHistoryOpenId(applicationId)
    const cached = logsByAppId[applicationId]
    if (cached === undefined || cached === 'error') {
      void fetchExtensionLogs(applicationId, token)
    }
  }

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
    setHistoryOpenId(null)
    setLogsByAppId({})
  }

  const runActivate = async (id: string) => {
    if (mutationInFlightRef.current) return
    mutationInFlightRef.current = true
    setBusyId(id)
    setBanner(null)
    try {
      const res = await trialAdminFetch(trialAdminBffPostUrl('activate', id), {
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
      mutationInFlightRef.current = false
      setBusyId(null)
    }
  }

  const openExtendModal = (r: Row) => {
    setExtendReasonCode('user_request')
    setExtendReasonDetail('')
    setExtendModal({ id: r.id, applicantName: r.applicantName })
  }

  const confirmExtend = async () => {
    if (!extendModal || mutationInFlightRef.current) return
    if (extendReasonCode === 'other' && !extendReasonDetail.trim()) {
      setBanner({ kind: 'err', text: '「その他」を選んだ場合は詳細を入力してください。' })
      return
    }
    mutationInFlightRef.current = true
    const id = extendModal.id
    setBusyId(id)
    setBanner(null)
    try {
      const body: { days: number; reasonCode: string; reasonDetail?: string } = {
        days: EXTEND_DAYS,
        reasonCode: extendReasonCode,
      }
      if (extendReasonDetail.trim()) {
        body.reasonDetail = extendReasonDetail.trim()
      }
      const res = await trialAdminFetch(trialAdminBffPostUrl('extend', id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        ok?: boolean
        accessExpiresAt?: string
        extendCount?: number
        extensionLogId?: string
        warning?: string
      }
      if (!res.ok || data.ok !== true) {
        setBanner({ kind: 'err', text: '延長に失敗しました。' })
        return
      }
      setExtendModal(null)
      const iso = data.accessExpiresAt
      const n = data.extendCount
      const logId = data.extensionLogId
      let text = iso ? `利用期限を延長しました（期限の目安: ${iso}）` : '利用期限を延長しました。'
      if (typeof n === 'number') {
        text += ` 延長回数: ${n}回。`
      }
      if (logId) {
        text += ` ログID: ${logId}`
      }
      if (data.warning === 'email_notice_failed') {
        text += ' 案内メールの送信に失敗した可能性があります（サーバーログを確認してください）。'
      }
      setBanner({ kind: 'ok', text })
      setLogsByAppId({})
      await fetchList(token)
    } catch {
      setBanner({ kind: 'err', text: '通信に失敗しました。' })
    } finally {
      mutationInFlightRef.current = false
      setBusyId(null)
    }
  }

  const runResend = async (id: string) => {
    if (mutationInFlightRef.current) return
    mutationInFlightRef.current = true
    setBusyId(id)
    setBanner(null)
    try {
      const res = await trialAdminFetch(trialAdminBffPostUrl('resend', id), {
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
      mutationInFlightRef.current = false
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-10 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#595c5e]">Admin</p>
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold text-[#2c2f32]">体験申込 · アクセス管理</h1>
            <p className="mt-1 text-sm text-[#595c5e]">
              カード・銀行振込を問わず、体験アクセスの再送・延長・履歴を管理します。
            </p>
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
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-[#595c5e] sm:max-w-md">
              <span className="font-semibold">🔍 メール・名前で検索</span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="メールまたは名前で検索"
                autoComplete="off"
                className="w-full rounded-lg border border-[#abadb0]/40 px-3 py-2 text-sm text-[#2c2f32] outline-none focus:border-[#4052b6]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[#595c5e]">
              <span className="whitespace-nowrap font-semibold">支払方法</span>
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value as PaymentMethodFilter)}
                className="rounded-lg border border-[#abadb0]/40 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#4052b6]"
              >
                <option value="all">すべて</option>
                <option value="card">カード</option>
                <option value="bank_transfer">銀行振込</option>
              </select>
            </label>
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

        {extendModal ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="extend-modal-title"
          >
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#abadb0]/20 bg-white p-5 shadow-lg">
              <h2 id="extend-modal-title" className="text-lg font-bold text-[#2c2f32]">
                利用期限を{EXTEND_DAYS}日延長
              </h2>
              <p className="mt-1 text-sm text-[#595c5e]">{extendModal.applicantName}</p>
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wide text-[#595c5e]">延長理由</label>
                <select
                  value={extendReasonCode}
                  onChange={(e) => setExtendReasonCode(e.target.value)}
                  className="w-full rounded-lg border border-[#abadb0]/40 px-3 py-2 text-sm outline-none focus:border-[#4052b6]"
                >
                  {REASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#595c5e]">詳細（任意・その他の場合は必須）</label>
                <textarea
                  value={extendReasonDetail}
                  onChange={(e) => setExtendReasonDetail(e.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-[#abadb0]/40 px-3 py-2 text-sm outline-none focus:border-[#4052b6]"
                  placeholder="運用メモ・依頼内容など"
                />
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setExtendModal(null)}
                  className="rounded-full border border-[#abadb0]/40 px-4 py-2 text-sm font-semibold text-[#595c5e]"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={busyId === extendModal.id}
                  onClick={() => void confirmExtend()}
                  className="rounded-full bg-[#4052b6] px-5 py-2 text-sm font-bold text-white shadow-md disabled:opacity-50"
                >
                  {busyId === extendModal.id ? '処理中…' : '延長する'}
                </button>
              </div>
            </div>
          </div>
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
                  <th className="whitespace-nowrap px-4 py-3">支払方法</th>
                  <th className="whitespace-nowrap px-4 py-3">利用期限</th>
                  <th className="whitespace-nowrap px-4 py-3">延長回数</th>
                  <th className="whitespace-nowrap px-4 py-3">支払状態</th>
                  <th className="whitespace-nowrap px-4 py-3">access</th>
                  <th className="whitespace-nowrap px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f4]">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-[#595c5e]">
                      該当するデータがありません
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const pm = r.paymentMethod?.trim().toLowerCase() ?? ''
                    const isBank = pm === 'bank_transfer' || pm === 'bank'
                    const showActivate = isBank && r.paymentStatus === 'pending'
                    const showResend = r.paymentStatus === 'paid' && r.accessStatus === 'ready'
                    const showHistory = r.paymentStatus === 'paid'
                    const busy = busyId === r.id
                    const logsEntry = logsByAppId[r.id]
                    const historyOpen = historyOpenId === r.id
                    return (
                      <Fragment key={r.id}>
                        <tr className="align-top">
                          <td className="px-4 py-3 font-medium">{r.applicantName}</td>
                          <td className="max-w-[200px] break-all px-4 py-3 text-[#595c5e]">{r.applicantEmail}</td>
                          <td className="px-4 py-3 text-[#595c5e]">{r.koreanLevel ?? '—'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#595c5e]">{formatJaDate(r.createdAt)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#595c5e]">
                            {paymentMethodLabel(r.paymentMethod ?? '')}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#595c5e]">
                            {r.accessExpiresAt ? formatJaDate(r.accessExpiresAt) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#595c5e]">
                            {typeof r.extendCount === 'number' ? r.extendCount : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{r.paymentStatus}</td>
                          <td className="px-4 py-3 font-mono text-xs">{r.accessStatus}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                              {showActivate ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    void runActivate(r.id)
                                  }}
                                  className="rounded-full bg-[#4052b6] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                                >
                                  {busy ? '処理中…' : '入金確認'}
                                </button>
                              ) : null}
                              {showResend ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    void runResend(r.id)
                                  }}
                                  className="rounded-full border border-[#4052b6] bg-white px-3 py-1.5 text-xs font-bold text-[#4052b6] disabled:opacity-50"
                                >
                                  {busy ? '処理中…' : 'リンク再送信'}
                                </button>
                              ) : null}
                              {showResend ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    openExtendModal(r)
                                  }}
                                  className="rounded-full border border-[#abadb0]/50 bg-[#f8fafc] px-3 py-1.5 text-xs font-bold text-[#2c2f32] disabled:opacity-50"
                                >
                                  延長
                                </button>
                              ) : null}
                              {showHistory ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    toggleHistory(r.id)
                                  }}
                                  className="rounded-full border border-[#abadb0]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#595c5e] disabled:opacity-50"
                                >
                                  履歴
                                </button>
                              ) : null}
                              {!showActivate && !showResend && !showHistory ? (
                                <span className="text-xs text-[#95999c]">—</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {historyOpen ? (
                          <tr className="bg-[#f8fafc]">
                            <td colSpan={10} className="px-4 py-3 text-xs text-[#2c2f32]">
                              <p className="mb-2 font-bold text-[#595c5e]">延長履歴</p>
                              {logsEntry === 'loading' ? (
                                <p className="text-[#595c5e]">読み込み中…</p>
                              ) : logsEntry === 'error' ? (
                                <p className="text-[#8b1a1a]">履歴の取得に失敗しました。</p>
                              ) : !logsEntry || logsEntry.length === 0 ? (
                                <p className="text-[#595c5e]">延長履歴はまだありません。</p>
                              ) : (
                                <div className="space-y-3">
                                  {logsEntry.map((log) => (
                                    <div
                                      key={log.id}
                                      className="rounded-lg border border-[#eef1f4] bg-white px-3 py-2 text-[#2c2f32]"
                                    >
                                      <div className="grid gap-1 sm:grid-cols-2">
                                        <div>
                                          <span className="text-[#95999c]">延長日時</span> {formatJaDate(log.createdAt)}
                                        </div>
                                        <div>
                                          <span className="text-[#95999c]">担当者</span> {log.actorLabel}
                                        </div>
                                        <div>
                                          <span className="text-[#95999c]">変更前の期限</span> {formatJaDate(log.previousAccessExpiresAt)}
                                        </div>
                                        <div>
                                          <span className="text-[#95999c]">変更後の期限</span> {formatJaDate(log.newAccessExpiresAt)}
                                        </div>
                                        <div>
                                          <span className="text-[#95999c]">延長日数</span> {log.extendedDays} 日
                                        </div>
                                        <div>
                                          <span className="text-[#95999c]">ステータス</span> {log.status}
                                        </div>
                                        <div className="sm:col-span-2">
                                          <span className="text-[#95999c]">理由</span> {log.reasonCode}
                                          {log.reasonDetail ? ` — ${log.reasonDetail}` : ''}
                                        </div>
                                        <div>
                                          <span className="text-[#95999c]">案内メール</span> {mailStatusLabel(log)}
                                        </div>
                                        {log.emailFailureReason ? (
                                          <div className="sm:col-span-2 break-all text-[#8b1a1a]">
                                            <span className="text-[#95999c]">失敗理由</span> {log.emailFailureReason}
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
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
