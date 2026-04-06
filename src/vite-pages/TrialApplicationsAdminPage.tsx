/**
 * 体験申込管理:
 * - リンク再送: paymentStatus・accessStatus・submissionStatus を併せて判断（提出の SoT は submissions）。
 * - 24時間前リマインド: reminderBefore24h*（送信ログ trial_reminder_logs）— リンク再送可否とは別概念だが、
 *   どちらも未提出(submissionStatus=not_submitted)が前提になりやすい。
 */
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl, trialAdminBffApiUrl } from '../lib/apiUrl'

const STORAGE_KEY = 'writing_trial_admin_bff_token'

const EXTEND_DAYS = 3

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: 'user_request', label: '学習者からの依頼' },
  { value: 'administrative_adjustment', label: '運用上の調整' },
  { value: 'payment_delay', label: '入金・確認の遅延' },
  { value: 'other', label: 'その他（詳細必須）' },
]

type SubmissionStatus = 'not_submitted' | 'submitted' | 'correcting' | 'completed'

type ReminderBefore24hStatus = 'not_sent' | 'sent' | 'failed'

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
  submissionStatus: SubmissionStatus
  submittedAt?: string | null
  submissionId?: string | null
  reminderBefore24hSent?: boolean
  reminderBefore24hSentAt?: string | null
  reminderBefore24hStatus?: ReminderBefore24hStatus
}

type PaymentMethodFilter = 'all' | 'card' | 'bank_transfer'

const DEFAULT_PAGE_SIZE = 10

type SortKey = 'created_desc' | 'expires_asc' | 'extended_desc'

type PaginationState = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

type AdminUserTrialRow = {
  userId: string
  email: string | null
  trialLinkedCount: number
  hasTrialHistory: boolean
}

function paymentMethodLabel(m: string): string {
  const x = m.trim().toLowerCase()
  if (!x) return '—'
  if (x === 'card') return 'カード'
  if (x === 'bank_transfer' || x === 'bank') return '銀行振込'
  return m
}

function normalizeTrialAdminRow(item: Row): Row {
  return {
    ...item,
    submissionStatus: item.submissionStatus ?? 'not_submitted',
    submittedAt: item.submittedAt ?? null,
    submissionId: item.submissionId ?? null,
    reminderBefore24hSent: item.reminderBefore24hSent ?? false,
    reminderBefore24hSentAt: item.reminderBefore24hSentAt ?? null,
    reminderBefore24hStatus: item.reminderBefore24hStatus ?? 'not_sent',
  }
}

function reminderBefore24hLabel(s: ReminderBefore24hStatus): string {
  switch (s) {
    case 'not_sent':
      return '未送信'
    case 'sent':
      return '送信済み'
    case 'failed':
      return '送信失敗'
    default:
      return '—'
  }
}

function submissionStatusLabel(s: SubmissionStatus): string {
  switch (s) {
    case 'not_submitted':
      return '未提出'
    case 'submitted':
      return '提出済み'
    case 'correcting':
      return '添削中'
    case 'completed':
      return '完了'
    default:
      return '—'
  }
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
  return fetch(input, { ...init, credentials: init?.credentials ?? 'include' })
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
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? ''
    } catch {
      return ''
    }
  })
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
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<SortKey>('created_desc')
  const [pagination, setPagination] = useState<PaginationState | null>(null)

  const [sessionAdminUsers, setSessionAdminUsers] = useState<
    AdminUserTrialRow[] | 'loading' | 'unavailable' | 'error'
  >('loading')

  const filterKeyRef = useRef({
    debouncedSearch: '',
    paymentMethodFilter: 'all' as PaymentMethodFilter,
    sort: 'created_desc' as SortKey,
  })
  const lastFetchedSigRef = useRef<string | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim())
    }, 300)
    return () => window.clearTimeout(id)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(apiUrl('/api/admin/users'), { credentials: 'include' })
        if (cancelled) return
        if (res.status === 401 || res.status === 403) {
          setSessionAdminUsers('unavailable')
          return
        }
        if (!res.ok) {
          setSessionAdminUsers('error')
          return
        }
        const data = (await res.json()) as { ok?: boolean; users?: AdminUserTrialRow[] }
        if (data.ok && Array.isArray(data.users)) {
          setSessionAdminUsers(data.users)
        } else {
          setSessionAdminUsers('error')
        }
      } catch {
        if (!cancelled) setSessionAdminUsers('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const fetchList = useCallback(async (t: string, pageForRequest: number) => {
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
      q.set('page', String(pageForRequest))
      q.set('pageSize', String(DEFAULT_PAGE_SIZE))
      q.set('sort', sort)
      const qs = q.toString()
      const listUrl = `/api/writing/admin/trial-applications?${qs}`
      const res = await trialAdminFetch(trialAdminBffApiUrl(listUrl), {
        headers: { ...authHeaders(t) },
        credentials: 'include',
      })
      const data = (await res.json()) as {
        ok?: boolean
        items?: Row[]
        pagination?: PaginationState
        sort?: string
        error?: string
      }
      if (res.status === 401 || res.status === 403) {
        console.error('[trial-admin] list unauthorized', res.status, data)
        setListError('認証に失敗しました。トークンを確認してください。')
        setRows(null)
        setPagination(null)
        return
      }
      if (!res.ok || data.ok !== true || !Array.isArray(data.items) || !data.pagination) {
        console.error('[trial-admin] list error', res.status, data)
        setListError(data.error === 'server_misconfigured' ? 'サーバー設定を確認してください。' : '一覧の取得に失敗しました。')
        setRows(null)
        setPagination(null)
        return
      }
      setRows(data.items.map(normalizeTrialAdminRow))
      setPagination(data.pagination)
      const sig = `${t}|${debouncedSearch}|${paymentMethodFilter}|${sort}|${pageForRequest}`
      lastFetchedSigRef.current = sig
    } catch (e) {
      console.error('[trial-admin] GET /api/writing/admin/trial-applications failed', e)
      setListError('通信に失敗しました。')
      setRows(null)
      setPagination(null)
    } finally {
      setLoading(false)
    }
  }, [paymentMethodFilter, debouncedSearch, sort])

  useEffect(() => {
    const prev = filterKeyRef.current
    const filtersChanged =
      prev.debouncedSearch !== debouncedSearch ||
      prev.paymentMethodFilter !== paymentMethodFilter ||
      prev.sort !== sort

    if (filtersChanged) {
      filterKeyRef.current = { debouncedSearch, paymentMethodFilter, sort }
      if (page !== 1) setPage(1)
      const sig = `${token}|${debouncedSearch}|${paymentMethodFilter}|${sort}|1`
      if (lastFetchedSigRef.current === sig) return
      void fetchList(token, 1)
      return
    }

    const sig = `${token}|${debouncedSearch}|${paymentMethodFilter}|${sort}|${page}`
    if (lastFetchedSigRef.current === sig) return
    void fetchList(token, page)
  }, [token, page, debouncedSearch, paymentMethodFilter, sort, fetchList])

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
    lastFetchedSigRef.current = null
    setToken(t)
    setTokenInput('')
    setBanner(null)
  }

  const clearToken = () => {
    sessionStorage.removeItem(STORAGE_KEY)
    setToken('')
    setRows(null)
    setPagination(null)
    setListError(null)
    setBanner(null)
    setHistoryOpenId(null)
    setLogsByAppId({})
    setPage(1)
    lastFetchedSigRef.current = null
    filterKeyRef.current = {
      debouncedSearch: '',
      paymentMethodFilter: 'all',
      sort: 'created_desc',
    }
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
      lastFetchedSigRef.current = null
      await fetchList(token, page)
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
      lastFetchedSigRef.current = null
      await fetchList(token, page)
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
      lastFetchedSigRef.current = null
      await fetchList(token, page)
    } catch {
      setBanner({ kind: 'err', text: '通信に失敗しました。' })
    } finally {
      mutationInFlightRef.current = false
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] px-4 py-8 font-['Be_Vietnam_Pro',sans-serif] text-[#2c2f32] sm:px-6 lg:px-8 xl:px-10">
      <div className="mx-auto w-full max-w-[1800px]">
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

        {sessionAdminUsers === 'loading' ? (
          <p className="mb-4 text-xs text-[#595c5e]">登録ユーザー（体験紐付け）を確認中…</p>
        ) : sessionAdminUsers === 'unavailable' ? null : sessionAdminUsers === 'error' ? (
          <div className="mb-6 rounded-lg border border-dashed border-[#abadb0]/40 bg-white/60 px-3 py-2 text-xs text-[#595c5e]">
            登録ユーザー別の体験紐付け件数を表示できません（管理者アカウントでログインしているか確認してください）。
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-[#abadb0]/20 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#2c2f32]">登録ユーザー（体験紐付け）</h2>
            <p className="mt-1 text-xs text-[#595c5e]">Supabase 管理者セッションのみ。最大500件。</p>
            <div className="mt-3 max-h-52 overflow-y-auto">
              {sessionAdminUsers.length === 0 ? (
                <p className="text-xs text-[#595c5e]">登録ユーザーがありません。</p>
              ) : (
                <table className="w-full min-w-[280px] table-fixed text-left text-xs">
                  <thead className="border-b border-[#eef1f4] text-[#595c5e]">
                    <tr>
                      <th className="py-2 pr-2 font-semibold">メール</th>
                      <th className="w-28 py-2 font-semibold">体験</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionAdminUsers.map((u) => (
                      <tr key={u.userId} className="border-b border-[#f0f2f4]">
                        <td className="truncate py-2 pr-2 text-[#2c2f32]" title={u.email ?? undefined}>
                          {u.email ?? '—'}
                        </td>
                        <td className="py-2">
                          {u.hasTrialHistory ? (
                            <span className="inline-block rounded-full bg-[#e8f0f8] px-2 py-0.5 font-semibold text-[#4052b6]">
                              体験 {u.trialLinkedCount}件
                            </span>
                          ) : (
                            <span className="text-[#abadb0]">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

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
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-5 lg:gap-y-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-[#595c5e] lg:min-w-[min(100%,22rem)] lg:max-w-xl xl:max-w-2xl">
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
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3 sm:gap-x-5">
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
              <label className="flex items-center gap-2 text-sm text-[#595c5e]">
                <span className="whitespace-nowrap font-semibold">並び順</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="min-w-[12rem] max-w-[min(100%,18rem)] rounded-lg border border-[#abadb0]/40 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#4052b6]"
                >
                  <option value="created_desc">申込日が新しい順</option>
                  <option value="expires_asc">利用期限が近い順</option>
                  <option value="extended_desc">最近延長した順</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  lastFetchedSigRef.current = null
                  void fetchList(token, page)
                }}
                disabled={loading}
                className="shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#2c2f32] shadow-sm ring-1 ring-[#abadb0]/30 disabled:opacity-50"
              >
                {loading ? '読み込み中…' : '再読み込み'}
              </button>
              <button
                type="button"
                onClick={clearToken}
                className="shrink-0 rounded-full border border-[#abadb0]/40 bg-transparent px-4 py-2 text-sm font-semibold text-[#595c5e]"
              >
                トークンを消去
              </button>
            </div>
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

        {listError ? (
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

        {token && !listError && rows !== null && pagination !== null ? (
          <div
            className={`w-full min-w-0 overflow-x-auto rounded-xl border border-[#abadb0]/15 bg-white shadow-sm ${loading ? 'opacity-[0.72]' : ''}`}
          >
            <table className="w-full min-w-[1100px] table-fixed text-left text-sm lg:min-w-0">
              <thead className="border-b border-[#eef1f4] bg-[#f8fafc] text-xs font-bold uppercase tracking-wider text-[#595c5e]">
                <tr>
                  <th className="w-[8%] min-w-[5.5rem] whitespace-nowrap px-2 py-2">お名前</th>
                  <th className="w-[18%] min-w-[11rem] whitespace-nowrap px-2 py-2">メール</th>
                  <th className="w-[5%] min-w-[3rem] whitespace-nowrap px-2 py-2">韓国語</th>
                  <th className="w-[10%] min-w-[7rem] whitespace-nowrap px-2 py-2">申込日</th>
                  <th className="w-[6%] min-w-[4rem] whitespace-nowrap px-2 py-2">支払方法</th>
                  <th className="w-[10%] min-w-[7rem] whitespace-nowrap px-2 py-2">利用期限</th>
                  <th className="w-[8%] min-w-[5.5rem] whitespace-nowrap px-2 py-2">提出状況</th>
                  <th className="w-[8%] min-w-[5.5rem] whitespace-nowrap px-2 py-2">24時間前通知</th>
                  <th className="w-[3%] min-w-[2.25rem] whitespace-nowrap px-2 py-2">延長</th>
                  <th className="w-[5%] min-w-[3rem] whitespace-nowrap px-2 py-2">支払</th>
                  <th className="w-[5%] min-w-[3rem] whitespace-nowrap px-2 py-2">access</th>
                  <th className="w-[14%] min-w-[10rem] whitespace-nowrap px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f4]">
                {pagination.totalItems === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-[#595c5e]">
                      該当するデータがありません
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const pm = r.paymentMethod?.trim().toLowerCase() ?? ''
                    const isBank = pm === 'bank_transfer' || pm === 'bank'
                    const showActivate = isBank && r.paymentStatus === 'pending'
                    const showTrialOps = r.paymentStatus === 'paid' && r.accessStatus === 'ready'
                    const canResendLink = showTrialOps && r.submissionStatus === 'not_submitted'
                    const resendBlockedReason =
                      showTrialOps && !canResendLink ? 'すでに提出済みのため再送は不要です' : undefined
                    const showHistory = r.paymentStatus === 'paid'
                    const busy = busyId === r.id
                    const logsEntry = logsByAppId[r.id]
                    const historyOpen = historyOpenId === r.id
                    return (
                      <Fragment key={r.id}>
                        <tr className="align-middle">
                          <td className="truncate px-2 py-1.5 font-medium" title={r.applicantName}>
                            {r.applicantName}
                          </td>
                          <td
                            className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap px-2 py-1.5 text-[#595c5e]"
                            title={r.applicantEmail}
                          >
                            {r.applicantEmail}
                          </td>
                          <td className="truncate px-2 py-1.5 text-[#595c5e]" title={r.koreanLevel ?? ''}>
                            {r.koreanLevel ?? '—'}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-[#595c5e]">{formatJaDate(r.createdAt)}</td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-[#595c5e]">
                            {paymentMethodLabel(r.paymentMethod ?? '')}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-[#595c5e]">
                            {r.accessExpiresAt ? formatJaDate(r.accessExpiresAt) : '—'}
                          </td>
                          <td
                            className="truncate px-2 py-1.5 text-[#595c5e]"
                            title={
                              r.submittedAt && r.submissionStatus !== 'not_submitted'
                                ? formatJaDate(r.submittedAt)
                                : submissionStatusLabel(r.submissionStatus)
                            }
                          >
                            <span className="inline-block rounded border border-[#eef1f4] bg-[#f8fafc] px-1.5 py-0.5 text-[11px] font-semibold">
                              {submissionStatusLabel(r.submissionStatus)}
                            </span>
                            {r.submittedAt ? (
                              <span className="mt-0.5 block text-[10px] leading-tight text-[#95999c]">
                                提出: {formatJaDate(r.submittedAt)}
                              </span>
                            ) : null}
                          </td>
                          <td
                            className="truncate px-2 py-1.5 text-[#595c5e]"
                            title={
                              r.reminderBefore24hStatus === 'sent' && r.reminderBefore24hSentAt
                                ? formatJaDate(r.reminderBefore24hSentAt)
                                : reminderBefore24hLabel(r.reminderBefore24hStatus ?? 'not_sent')
                            }
                          >
                            <span className="inline-block rounded border border-[#eef1f4] bg-[#f8fafc] px-1.5 py-0.5 text-[11px] font-semibold text-[#595c5e]">
                              {reminderBefore24hLabel(r.reminderBefore24hStatus ?? 'not_sent')}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-xs text-[#595c5e]">
                            {typeof r.extendCount === 'number' ? r.extendCount : '—'}
                          </td>
                          <td className="truncate px-2 py-1.5 font-mono text-xs">{r.paymentStatus}</td>
                          <td className="truncate px-2 py-1.5 font-mono text-xs">{r.accessStatus}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex flex-row flex-wrap items-center gap-1">
                              {showActivate ? (
                                <button
                                  type="button"
                                  disabled={busy || loading}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    void runActivate(r.id)
                                  }}
                                  className="shrink-0 rounded-full bg-[#4052b6] px-2 py-1 text-[11px] font-bold leading-tight text-white disabled:opacity-50"
                                >
                                  {busy ? '処理中…' : '入金確認'}
                                </button>
                              ) : null}
                              {showTrialOps ? (
                                <button
                                  type="button"
                                  disabled={busy || loading || !canResendLink}
                                  title={resendBlockedReason}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (!canResendLink) return
                                    void runResend(r.id)
                                  }}
                                  className="shrink-0 rounded-full border border-[#4052b6] bg-white px-2 py-1 text-[11px] font-bold leading-tight text-[#4052b6] disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                  {busy ? '処理中…' : 'リンク再送信'}
                                </button>
                              ) : null}
                              {showTrialOps ? (
                                <button
                                  type="button"
                                  disabled={busy || loading}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    openExtendModal(r)
                                  }}
                                  className="shrink-0 rounded-full border border-[#abadb0]/50 bg-[#f8fafc] px-2 py-1 text-[11px] font-bold leading-tight text-[#2c2f32] disabled:opacity-50"
                                >
                                  延長
                                </button>
                              ) : null}
                              {showHistory ? (
                                <button
                                  type="button"
                                  disabled={busy || loading}
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    toggleHistory(r.id)
                                  }}
                                  className="shrink-0 rounded-full border border-[#abadb0]/40 bg-white px-2 py-1 text-[11px] font-semibold leading-tight text-[#595c5e] disabled:opacity-50"
                                >
                                  履歴
                                </button>
                              ) : null}
                              {!showActivate && !showTrialOps && !showHistory ? (
                                <span className="text-[11px] text-[#95999c]">—</span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {historyOpen ? (
                          <tr className="bg-[#f8fafc]">
                            <td colSpan={12} className="px-3 py-2 text-xs text-[#2c2f32]">
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
            {pagination.totalPages > 0 ? (
              <div className="flex flex-col gap-3 border-t border-[#eef1f4] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-sm text-[#595c5e] sm:text-left">
                  全{pagination.totalItems}件 · {pagination.page}/{pagination.totalPages}ページ
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1 sm:justify-end">
                  <button
                    type="button"
                    disabled={loading || pagination.page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-full border border-[#abadb0]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#2c2f32] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    前へ
                  </button>
                  {pagination.totalPages <= 10
                    ? Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((n) =>
                        n === pagination.page ? (
                          <span
                            key={n}
                            aria-current="page"
                            className="min-w-[2rem] rounded-full bg-[#4052b6] px-2 py-1.5 text-center text-xs font-semibold text-white"
                          >
                            {n}
                          </span>
                        ) : (
                          <button
                            key={n}
                            type="button"
                            disabled={loading}
                            onClick={() => setPage(n)}
                            className="min-w-[2rem] rounded-full border border-[#abadb0]/30 bg-white px-2 py-1.5 text-xs font-semibold text-[#2c2f32] hover:bg-[#f8fafc] disabled:opacity-50"
                          >
                            {n}
                          </button>
                        )
                      )
                    : null}
                  <button
                    type="button"
                    disabled={loading || pagination.page >= pagination.totalPages}
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    className="rounded-full border border-[#abadb0]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#2c2f32] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    次へ
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {token && loading && rows === null ? (
          <p className="text-center text-sm text-[#595c5e]">読み込み中…</p>
        ) : null}
      </div>
    </div>
  )
}
