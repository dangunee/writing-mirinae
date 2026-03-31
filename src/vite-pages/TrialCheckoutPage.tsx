import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../trial-checkout.css'

type PlanId = 'trial' | 'one' | 'five' | 'ten'

const PLAN_SKU: Record<PlanId, string> = {
  trial: 'writing_trial_lesson',
  one: 'writing_1_session',
  five: 'writing_5_sessions',
  ten: 'writing_10_sessions_promo',
}

/** Display + summary (matches Stitch breakdown per plan). */
const PLAN_META: Record<
  PlanId,
  {
    title: string
    subtitle: string
    total: number
    subtotal: number
    tax: number
    summaryTitle: string
    summarySub: string
  }
> = {
  trial: {
    title: '体験レッスン (Trial Lesson)',
    subtitle: '初めての方のための1回添削体験',
    total: 1800,
    subtotal: 1636,
    tax: 164,
    summaryTitle: '体験レッスン (Trial Lesson)',
    summarySub: '初めての方のための1回添削体験',
  },
  one: {
    title: '1回プラン',
    subtitle: '単発での集中添削',
    total: 3500,
    subtotal: 3182,
    tax: 318,
    summaryTitle: '1回プラン',
    summarySub: '単発での集中添削',
  },
  five: {
    title: '5セッションプラン',
    subtitle: '集中的な弱点補強に',
    total: 8500,
    subtotal: 7727,
    tax: 773,
    summaryTitle: '5セッションプラン',
    summarySub: 'プロ講師による添削（5回分）',
  },
  ten: {
    title: '10セッションプラン',
    subtitle: '週2回の学習で着実な成果を',
    total: 15300,
    subtotal: 13909,
    tax: 1391,
    summaryTitle: '10セッションプラン',
    summarySub: 'プロ講師による添削（10回分）',
  },
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function apiUrl(path: string) {
  return `${API_BASE}${path}`
}

function absoluteUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL.slice(0, -1) : import.meta.env.BASE_URL
  const p = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}${base}${p}`
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function formatDateJp(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const w = WEEKDAYS_JA[d.getDay()]
  return `${y}年${m}月${day}日 (${w})`
}

export default function TrialCheckoutPage() {
  const navigate = useNavigate()
  const [plan, setPlan] = useState<PlanId>('trial')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), 1)
  })
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const meta = PLAN_META[plan]

  const monthCells = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const first = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0).getDate()
    const pad = first.getDay()
    const cells: { key: string; day: number | null; inMonth: boolean }[] = []
    const prevMonthLast = new Date(year, month, 0).getDate()
    for (let p = 0; p < pad; p++) {
      const d = prevMonthLast - pad + p + 1
      cells.push({ key: `p-${year}-${month}-${p}`, day: d, inMonth: false })
    }
    for (let d = 1; d <= lastDay; d++) {
      cells.push({ key: `c-${d}`, day: d, inMonth: true })
    }
    let n = 1
    while (cells.length % 7 !== 0) {
      cells.push({ key: `n-${n}`, day: n, inMonth: false })
      n++
    }
    return cells
  }, [visibleMonth])

  const onPay = useCallback(async () => {
    setPayError(null)
    setPayLoading(true)
    try {
      const res = await fetch(apiUrl('/api/writing/checkout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productSku: PLAN_SKU[plan],
          successUrl: absoluteUrl('/writing/app'),
          cancelUrl: absoluteUrl('/writing/trial-checkout'),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string }
      if (res.status === 401) {
        setPayError('お支払いにはログインが必要です。mirinae.jp からログインしてからお試しください。')
        return
      }
      if (!res.ok || !data.checkoutUrl) {
        setPayError(data.error === 'invalid_redirect_urls' ? 'リダイレクトURLの設定を確認してください。' : '決済の開始に失敗しました。')
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setPayError('ネットワークエラーが発生しました。')
    } finally {
      setPayLoading(false)
    }
  }, [plan])

  const selectDay = (day: number | null, inMonth: boolean) => {
    if (!inMonth || day == null) return
    setSelectedDate(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))
  }

  const shiftMonth = (delta: number) => {
    setVisibleMonth((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1))
  }

  return (
    <div className="trial-checkout-root min-h-screen bg-[#f5f7fa] font-[family-name:var(--font-body)] text-[#2c2f32] antialiased">
      {/* Header — Stitch TopAppBar */}
      <header className="fixed top-0 z-50 w-full border-b border-black/5 bg-white/80 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 lg:contents lg:justify-between">
            <button
              type="button"
              className="text-[#2c2f32] transition-transform active:scale-95 lg:hidden"
              aria-label="戻る"
              onClick={() => navigate(-1)}
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="font-[family-name:var(--font-headline)] text-xl font-bold tracking-tight text-[#1e3a5f] lg:flex-1">
              ミリネ韓国語教室
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button type="button" className="text-slate-500 transition-colors hover:text-indigo-700 active:scale-95">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
            <Link
              to="/writing/app"
              className="text-slate-500 transition-colors hover:text-indigo-700 active:scale-95"
              aria-label="アカウント"
            >
              <span className="material-symbols-outlined">account_circle</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen">
      {/* Desktop */}
      <div className="mx-auto hidden max-w-7xl pb-32 pt-24 lg:block lg:px-6">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="space-y-12 lg:col-span-7">
            <section>
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[#4052b6]">プレミアム入会</span>
              <h1 className="font-[family-name:var(--font-headline)] text-4xl font-extrabold leading-tight tracking-tight text-[#2c2f32]">
                コースを選択して、
                <br />
                学びを深めましょう
              </h1>
              <p className="mt-4 max-w-lg text-[#595c5e]">
                あなたのペースに合わせた学習プランをお選びください。すべてのプランにプロ講師による個別添削が含まれます。
              </p>
            </section>

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">プランを選択</h2>
                <span className="rounded-full bg-[#e5e8ec] px-3 py-1 text-xs font-medium text-[#595c5e]">100% 安全なチェックアウト</span>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {/* Trial */}
                <button
                  type="button"
                  onClick={() => setPlan('trial')}
                  className={`group relative flex cursor-pointer items-center justify-between overflow-hidden rounded-xl bg-white p-6 transition-all duration-300 ${
                    plan === 'trial' ? 'ring-2 ring-[#4052b6] ring-offset-0' : 'ring-2 ring-[#4052b6]/10 hover:ring-[#4052b6]/30'
                  }`}
                >
                  <div className="absolute right-0 top-0 rounded-bl-xl bg-[#e5e8ec] px-4 py-1 text-[10px] font-bold uppercase tracking-tighter text-[#4052b6]">
                    初めての方限定
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eef1f4] text-[#4052b6]">
                      <span className="material-symbols-outlined">menu_book</span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-[#2c2f32]">体験レッスン (Trial Lesson)</h3>
                      <p className="text-sm text-[#595c5e]">初めての方のための1回添削体験</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-2xl font-bold text-[#2c2f32]">¥1,800</span>
                    <span className="text-[10px] font-medium text-[#595c5e]">税込</span>
                  </div>
                </button>

                {/* 10 sessions */}
                <button
                  type="button"
                  onClick={() => setPlan('ten')}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-xl bg-white p-6 shadow-lg transition-all duration-300 ${
                    plan === 'ten' ? 'ring-2 ring-[#4052b6]' : 'ring-2 ring-transparent hover:ring-[#4052b6]/20'
                  }`}
                >
                  <div className="absolute -top-3 left-6 rounded-full bg-[#ff9727] px-3 py-1 text-[11px] font-bold uppercase text-[#4c2700] shadow-sm">
                    おすすめ
                  </div>
                  <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4052b6]/10 text-[#4052b6]">
                      <span className="material-symbols-outlined fill-1" style={{ fontVariationSettings: "'FILL' 1" }}>
                        auto_awesome
                      </span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-[#2c2f32]">10セッションプラン</h3>
                      <p className="text-sm text-[#595c5e]">週2回の学習で着実な成果を</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-[#595c5e]/60 line-through">¥18,000</span>
                      <span className="rounded bg-[#5cfd80] px-2 py-0.5 text-[10px] font-bold text-[#005d22]">15% OFF</span>
                    </div>
                    <span className="block text-2xl font-extrabold text-[#4052b6]">¥15,300</span>
                    <span className="text-[10px] font-medium text-[#595c5e]">税込</span>
                  </div>
                </button>

                {/* 5 sessions */}
                <button
                  type="button"
                  onClick={() => setPlan('five')}
                  className={`group relative flex cursor-pointer items-center justify-between rounded-xl bg-[#ffffff] p-6 transition-all duration-300 hover:bg-[#eef1f4] ${
                    plan === 'five' ? 'ring-2 ring-[#4052b6]' : 'ring-2 ring-transparent'
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#dfe3e7] text-[#595c5e]">
                      <span className="material-symbols-outlined">edit_note</span>
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-[#2c2f32]">5セッションプラン</h3>
                      <p className="text-sm text-[#595c5e]">集中的な弱点補強に</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-2xl font-bold text-[#2c2f32]">¥8,500</span>
                    <span className="text-[10px] font-medium text-[#595c5e]">税込</span>
                  </div>
                </button>
              </div>
            </section>

            {/* Calendar */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">初回の予約日を選択</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[#abadb0]/30 text-[#595c5e] hover:bg-[#e5e8ec]"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-[#abadb0]/30 text-[#595c5e] hover:bg-[#e5e8ec]"
                  >
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
              <div className="rounded-2xl bg-white p-8 shadow-sm">
                <div className="mb-6 grid grid-cols-7 gap-y-4 text-center">
                  {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
                    <div key={d} className="text-[10px] font-bold uppercase tracking-widest text-[#595c5e]/50">
                      {d}
                    </div>
                  ))}
                  {monthCells.map((c) => {
                    const isSel =
                      c.inMonth &&
                      selectedDate.getFullYear() === visibleMonth.getFullYear() &&
                      selectedDate.getMonth() === visibleMonth.getMonth() &&
                      selectedDate.getDate() === c.day
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => selectDay(c.day, c.inMonth)}
                        className={`py-2 text-sm ${
                          !c.inMonth ? 'text-[#595c5e]/30' : 'font-medium text-[#2c2f32]'
                        } ${
                          isSel
                            ? 'rounded-xl bg-[#4052b6]/10 font-bold text-[#4052b6] ring-1 ring-[#4052b6]/20'
                            : ''
                        }`}
                      >
                        {c.day}
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-4 border-t border-[#abadb0]/10 pt-4 text-xs text-[#595c5e]">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#4052b6]" /> 選択中
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border border-[#abadb0]" /> 予約可能
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Summary */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 space-y-6">
              <div className="rounded-3xl border border-white/40 bg-white/60 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
                <h2 className="mb-8 text-xl font-bold">ご注文内容の確認</h2>
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#2c2f32]">{meta.summaryTitle}</p>
                      <p className="mt-1 text-xs text-[#595c5e]">{meta.summarySub}</p>
                    </div>
                    <span className="font-bold">¥{meta.total.toLocaleString('ja-JP')}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#595c5e]">初回レッスン予約</span>
                    <span className="font-medium text-[#2c2f32]">{formatDateJp(selectedDate)}</span>
                  </div>
                  <div className="border-t border-dashed border-[#abadb0]/30 pt-6">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm text-[#595c5e]">小計</span>
                      <span className="text-sm">¥{meta.subtotal.toLocaleString('ja-JP')}</span>
                    </div>
                    <div className="mb-6 flex items-center justify-between">
                      <span className="text-sm text-[#595c5e]">消費税 (10%)</span>
                      <span className="text-sm">¥{meta.tax.toLocaleString('ja-JP')}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-lg font-bold">合計金額</span>
                      <span className="text-3xl font-extrabold text-[#4052b6]">¥{meta.total.toLocaleString('ja-JP')}</span>
                    </div>
                  </div>
                  <div className="pt-8">
                    <button
                      type="button"
                      onClick={onPay}
                      disabled={payLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ff9727] py-4 font-bold text-[#4c2700] shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(255,151,39,0.25)] active:scale-95 disabled:opacity-60"
                    >
                      {payLoading ? '処理中…' : '支払いへ進む'}
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                    {payError ? <p className="mt-3 text-center text-xs text-red-600">{payError}</p> : null}
                    <p className="mt-4 px-4 text-center text-[10px] leading-relaxed text-[#595c5e]">
                      「支払いへ進む」をクリックすることで、利用規約およびプライバシーポリシーに同意したものとみなされます。
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 px-4">
                <div className="flex flex-col items-center gap-2 opacity-60">
                  <span className="material-symbols-outlined text-xl">verified_user</span>
                  <span className="text-[9px] font-bold uppercase tracking-tighter">安全な決済</span>
                </div>
                <div className="flex flex-col items-center gap-2 opacity-60">
                  <span className="material-symbols-outlined text-xl">history</span>
                  <span className="text-[9px] font-bold uppercase tracking-tighter">14日間返金保証</span>
                </div>
                <div className="flex flex-col items-center gap-2 opacity-60">
                  <span className="material-symbols-outlined text-xl">support_agent</span>
                  <span className="text-[9px] font-bold uppercase tracking-tighter">24時間サポート</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="mx-auto max-w-lg px-6 pb-32 pt-24 lg:hidden">
        <section className="mb-10">
          <span className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[#4052b6]">プレミアムアクセス</span>
          <h2 className="font-[family-name:var(--font-headline)] text-3xl font-extrabold leading-tight text-[#2c2f32]">
            <span className="italic text-[#4052b6]">韓国語の芸術性</span>を磨き、
            <br />
            あなたの可能性を広げましょう。
          </h2>
          <p className="mt-4 leading-relaxed text-[#595c5e]">
            あなたの学習リズムに合わせたプランをお選びください。経験豊かな講師陣が、あなたの文章と発音を丁寧に添削します。
          </p>
        </section>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setPlan('trial')}
            className={`relative block w-full cursor-pointer rounded-xl border-2 p-6 text-left shadow-sm transition-all duration-300 ${
              plan === 'trial' ? 'border-[#006a28] bg-[#5cfd80]/20' : 'border-transparent bg-white hover:shadow-md'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="mb-3 inline-flex items-center rounded-full bg-[#006a28]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#006a28]">
                  体験レッスン
                </span>
                <h3 className="font-[family-name:var(--font-headline)] text-xl font-bold text-[#2c2f32]">初回限定体験</h3>
                <p className="mt-1 text-sm text-[#595c5e]">初めての方のための1回添削体験</p>
              </div>
              <div className="text-right">
                <span className="font-[family-name:var(--font-headline)] text-lg font-extrabold text-[#006a28]">¥1,800</span>
                <span className="block text-[10px] text-[#595c5e]">（税込）</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPlan('one')}
            className={`relative block w-full cursor-pointer rounded-xl border-2 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:shadow-md ${
              plan === 'one' ? 'border-[#4052b6]' : 'border-transparent'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#2c2f32]">1回プラン</h3>
                <p className="text-sm text-[#595c5e]">単発での集中添削</p>
              </div>
              <div className="text-right">
                <span className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#2c2f32]">¥3,500</span>
                <span className="block text-[10px] text-[#595c5e]">（税込）</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setPlan('five')}
            className={`relative block w-full cursor-pointer rounded-xl border-2 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:shadow-md ${
              plan === 'five' ? 'border-[#4052b6]' : 'border-transparent'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#2c2f32]">5回プラン</h3>
                <p className="text-sm text-[#595c5e]">月々の学習習慣に</p>
              </div>
              <div className="text-right">
                <span className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#2c2f32]">¥8,500</span>
                <span className="block text-[10px] text-[#595c5e]">（税込）</span>
              </div>
            </div>
          </button>

          <div className="relative">
            <div className="absolute -top-3 right-6 z-10 rounded-full bg-[#8a4c00] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#fff0e6]">
              人気No.1
            </div>
            <button
              type="button"
              onClick={() => setPlan('ten')}
              className={`relative block w-full cursor-pointer overflow-hidden rounded-xl border-2 bg-white p-6 text-left shadow-sm transition-all duration-300 hover:shadow-md ${
                plan === 'ten' ? 'border-[#4052b6]' : 'border-transparent'
              }`}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#4052b6]/5 to-transparent" />
              <div className="relative flex items-center justify-between">
                <div>
                  <h3 className="font-[family-name:var(--font-headline)] text-lg font-bold text-[#2c2f32]">10回プラン</h3>
                  <p className="text-sm text-[#595c5e]">短期集中、上達への近道</p>
                </div>
                <div className="text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-[#595c5e] line-through opacity-60">¥18,000</span>
                    <span className="font-[family-name:var(--font-headline)] text-xl font-extrabold text-[#4052b6]">¥15,300</span>
                  </div>
                  <span className="block text-[10px] text-[#595c5e]">（税込）</span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <section className="mb-8 mt-12 rounded-2xl bg-[#eef1f4] p-6">
          <h4 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#4052b6]">アトリエが選ばれる理由</h4>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4052b6]/10">
                <span className="material-symbols-outlined text-sm text-[#4052b6]">verified_user</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#2c2f32]">厳選された認定講師</p>
                <p className="text-xs text-[#595c5e]">ソウルの中心部から、確かな実力を持つネイティブ講師を採用。</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4052b6]/10">
                <span className="material-symbols-outlined text-sm text-[#4052b6]">history_edu</span>
              </div>
              <div>
                <p className="text-sm font-bold text-[#2c2f32]">パーソナライズされた添削</p>
                <p className="text-xs text-[#595c5e]">文法だけでなく、細かなニュアンスまで深く踏み込んだフィードバック。</p>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-4 flex items-center justify-center gap-2 opacity-50">
          <span className="material-symbols-outlined text-sm">lock</span>
          <span className="text-[10px] font-bold uppercase tracking-widest">SSLによる安全な決済保護</span>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 z-50 w-full border-t border-slate-100/10 bg-white/90 p-6 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg flex-col gap-4">
          <div className="flex items-end justify-between">
            <span className="text-xs text-[#595c5e]">お支払い合計</span>
            <span className="font-[family-name:var(--font-headline)] text-2xl font-extrabold text-[#2c2f32]">
              ¥{meta.total.toLocaleString('ja-JP')}{' '}
              <span className="text-sm font-normal text-[#595c5e]">税込</span>
            </span>
          </div>
          <button
            type="button"
            onClick={onPay}
            disabled={payLoading}
            className="w-full rounded-full bg-[#ff9727] py-4 font-[family-name:var(--font-headline)] text-lg font-bold text-[#4c2700] shadow-[0_12px_24px_rgba(255,151,39,0.2)] transition-transform active:scale-95 disabled:opacity-60"
          >
            {payLoading ? '処理中…' : '支払いへ進む'}
          </button>
          {payError ? <p className="text-center text-xs text-red-600">{payError}</p> : null}
        </div>
      </div>
      </main>
    </div>
  )
}
