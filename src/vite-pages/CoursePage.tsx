import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LandingNav from '../components/landing/LandingNav'
import '../course.css'
import '../landing.css'

type Plan = 'ten' | 'experience'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function buildCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0).getDate()
  const pad = first.getDay()
  const prevLast = new Date(year, month, 0).getDate()
  const cells: { key: string; day: number; inMonth: boolean }[] = []
  for (let p = 0; p < pad; p++) {
    cells.push({ key: `p-${p}`, day: prevLast - pad + p + 1, inMonth: false })
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
}

function formatDeskDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const w = WEEKDAYS[d.getDay()]
  return `${y}年${m}月${day}日 (${w})`
}

function formatMobDateShort(d: Date) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function CoursePage() {
  const navigate = useNavigate()
  const goApp = useCallback(() => {
    navigate('/writing/course')
  }, [navigate])
  const [plan, setPlan] = useState<Plan>('ten')

  const [deskMonth, setDeskMonth] = useState(() => new Date(2023, 10, 1))
  const [deskSelected, setDeskSelected] = useState(() => new Date(2023, 10, 8))

  const [mobMonth, setMobMonth] = useState(() => new Date(2024, 4, 1))
  const [mobSelected, setMobSelected] = useState(() => new Date(2024, 4, 8))

  const deskCells = useMemo(() => buildCells(deskMonth.getFullYear(), deskMonth.getMonth()), [deskMonth])
  const mobCells = useMemo(() => buildCells(mobMonth.getFullYear(), mobMonth.getMonth()), [mobMonth])

  const experienceSub = 1636
  const experienceTax = 164
  const experienceTotal = 1800

  const goToPayment = useCallback(() => {
    if (plan === 'experience') {
      navigate('/writing/trial-payment')
      return
    }
    /* 10回コース: Stripe / 専用フローは次フェーズ */
  }, [navigate, plan])

  return (
    <div className="course-page-root min-h-screen bg-[#f3f4f6] font-[family-name:var(--font-body)] text-[#1a1c1e] antialiased">
      <LandingNav goApp={goApp} />
      {/* ——— Desktop ——— */}
      <div className="hidden lg:block">
        <main className="mx-auto max-w-6xl px-6 pb-32 pt-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="space-y-12 lg:col-span-7">
              <section>
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-[#000666]">
                  Premium Membership
                </span>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-[#2c2f32]">
                  コースを選択して、
                  <br />
                  学習を始めましょう
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-[#595c5e]">
                  専門講師による丁寧な添削で、あなたの韓国語能力を次のレベルへ。
                </p>
              </section>

              <section className="space-y-6">
                <h2 className="text-base font-bold text-slate-900">プランを選択</h2>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    type="button"
                    onClick={() => setPlan('experience')}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:border-[#000666]/30 ${
                      plan === 'experience' ? 'ring-2 ring-[#000666]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:bg-[#000666]/5 group-hover:text-[#000666]">
                        <span className="material-symbols-outlined">menu_book</span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-[#2c2f32]">体験レッスン</h3>
                        <p className="text-sm text-[#595c5e]">初めての方のための1回添削体験</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-xl font-bold text-[#2c2f32]">¥1,800</span>
                      <span className="text-[10px] font-medium text-[#595c5e]">税込</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlan('ten')}
                    className={`group relative flex cursor-pointer items-center justify-between rounded-2xl border-2 bg-white p-6 shadow-sm transition-all duration-200 ${
                      plan === 'ten' ? 'border-[#000666]' : 'border-transparent ring-1 ring-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#000666]/5 text-[#000666]">
                        <span className="material-symbols-outlined">auto_stories</span>
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-[#2c2f32]">10回コース</h3>
                        <p className="text-sm text-[#595c5e]">実践的な文章力を養う全10回の集中コース</p>
                        <p className="mt-1 text-[10px] text-[#595c5e]/70">内訳：21,800円 + 消費税2,180円</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block text-xl font-bold text-[#2c2f32]">¥23,980</span>
                      <span className="text-[10px] font-medium text-[#595c5e]">税込</span>
                    </div>
                  </button>
                </div>
              </section>

              <section className="space-y-6">
                <h2 className="text-base font-bold text-slate-900">初回の予約日を選択</h2>
                <div className="rounded-2xl border border-slate-100 bg-white p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <span className="text-sm font-bold">
                      {deskMonth.getFullYear()}年{deskMonth.getMonth() + 1}月
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setDeskMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeskMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-y-1 text-center">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {d}
                      </div>
                    ))}
                    {deskCells.map((c) => {
                      const sel =
                        c.inMonth &&
                        deskSelected.getFullYear() === deskMonth.getFullYear() &&
                        deskSelected.getMonth() === deskMonth.getMonth() &&
                        deskSelected.getDate() === c.day
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => {
                            if (!c.inMonth) return
                            setDeskSelected(new Date(deskMonth.getFullYear(), deskMonth.getMonth(), c.day))
                          }}
                          className={`rounded-xl py-3 text-sm ${
                            !c.inMonth ? 'text-slate-300' : 'font-medium text-[#2c2f32]'
                          } ${sel ? 'bg-[#000666] font-bold text-white shadow-md shadow-[#000666]/20' : 'hover:bg-slate-50'}`}
                        >
                          {c.day}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </section>
            </div>

            <div className="lg:col-span-5">
              <div className="sticky top-28 space-y-6">
                <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
                  <h2 className="mb-8 text-lg font-bold">ご注文内容の確認</h2>
                  <div className="space-y-6">
                    {plan === 'ten' ? (
                      <>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#2c2f32]">10回コース</p>
                            <p className="mt-1 text-xs text-[#595c5e]">実践的な文章力を養う全10回の集中コース</p>
                          </div>
                          <span className="font-bold">¥23,980</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#595c5e]">初回レッスン予約</span>
                          <span className="font-medium text-[#2c2f32]">{formatDeskDate(deskSelected)}</span>
                        </div>
                        <div className="border-t border-slate-100 pt-6">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm text-[#595c5e]">小計</span>
                            <span className="text-sm">¥21,800</span>
                          </div>
                          <div className="mb-6 flex items-center justify-between">
                            <span className="text-sm text-[#595c5e]">消費税 (10%)</span>
                            <span className="text-sm">¥2,180</span>
                          </div>
                          <div className="flex items-end justify-between">
                            <span className="text-base font-bold">合計金額</span>
                            <span className="text-3xl font-extrabold text-[#000666]">
                              ¥23,980
                              <span className="ml-1 text-sm font-bold">（税込）</span>
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#2c2f32]">体験レッスン</p>
                            <p className="mt-1 text-xs text-[#595c5e]">初めての方のための1回添削体験</p>
                          </div>
                          <span className="font-bold">¥1,800</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#595c5e]">初回レッスン予約</span>
                          <span className="font-medium text-[#2c2f32]">{formatDeskDate(deskSelected)}</span>
                        </div>
                        <div className="border-t border-slate-100 pt-6">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm text-[#595c5e]">小計</span>
                            <span className="text-sm">¥{experienceSub.toLocaleString('ja-JP')}</span>
                          </div>
                          <div className="mb-6 flex items-center justify-between">
                            <span className="text-sm text-[#595c5e]">消費税 (10%)</span>
                            <span className="text-sm">¥{experienceTax.toLocaleString('ja-JP')}</span>
                          </div>
                          <div className="flex items-end justify-between">
                            <span className="text-base font-bold">合計金額</span>
                            <span className="text-3xl font-extrabold text-[#000666]">
                              ¥{experienceTotal.toLocaleString('ja-JP')}
                              <span className="ml-1 text-sm font-bold">（税込）</span>
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="pt-8">
                      <button
                        type="button"
                        onClick={goToPayment}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#000666] py-4 font-bold text-white shadow-lg shadow-[#000666]/10 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                      >
                        支払いへ進む
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                      <p className="mt-4 text-center text-[10px] leading-relaxed text-[#595c5e]">
                        「支払いへ進む」をクリックすることで、利用規約およびプライバシーポリシーに同意したものとみなされます。
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-8 px-4">
                  <div className="flex flex-col items-center gap-1.5 opacity-40">
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                    <span className="text-[9px] font-bold uppercase tracking-tight">SSL SECURE</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 opacity-40">
                    <span className="material-symbols-outlined text-lg">history</span>
                    <span className="text-[9px] font-bold uppercase tracking-tight">GUARANTEE</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 opacity-40">
                    <span className="material-symbols-outlined text-lg">support_agent</span>
                    <span className="text-[9px] font-bold uppercase tracking-tight">SUPPORT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ——— Mobile ——— */}
      <div className="pb-40 lg:hidden">
        <main className="mx-auto max-w-md px-5 pt-24">
          <section className="mb-8">
            <h1 className="font-[family-name:var(--font-headline)] text-2xl font-bold leading-tight text-[#1a1c1e]">
              コースを選択して、
              <br />
              学習を始めましょう
            </h1>
          </section>

          <section className="mb-10 space-y-4">
            <div className="relative">
              <input
                id="plan_full_m"
                className="peer hidden"
                type="radio"
                name="plan_m"
                checked={plan === 'ten'}
                onChange={() => setPlan('ten')}
              />
              <label
                htmlFor="plan_full_m"
                className="block cursor-pointer rounded-2xl border-2 border-transparent bg-white p-6 shadow-sm transition-all duration-300 peer-checked:border-[#000666] peer-checked:bg-[#000666]/[0.02]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span className="text-sm font-bold text-[#000666]">10回コース</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#000666]">
                    <div className="h-3 w-3 rounded-full bg-[#000666]" />
                  </div>
                </div>
                <div className="mb-2 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-[#1a1c1e]">¥23,980</span>
                  <span className="text-sm text-[#44474e]">（税込）</span>
                </div>
                <p className="mb-4 text-sm font-medium text-[#1a1c1e]">本格的に作文力を鍛える定番プラン</p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-xs text-[#44474e]">
                    <span className="material-symbols-outlined text-[16px] text-[#000666]">check_circle</span>
                    講師による丁寧な添削
                  </li>
                  <li className="flex items-center gap-2 text-xs text-[#44474e]">
                    <span className="material-symbols-outlined text-[16px] text-[#000666]">check_circle</span>
                    無制限の学習相談
                  </li>
                </ul>
              </label>
            </div>

            <div className="relative">
              <input
                id="plan_experience_m"
                className="peer hidden"
                type="radio"
                name="plan_m"
                checked={plan === 'experience'}
                onChange={() => setPlan('experience')}
              />
              <label
                htmlFor="plan_experience_m"
                className="block cursor-pointer rounded-2xl border-2 border-transparent bg-white p-6 shadow-sm transition-all duration-300 peer-checked:border-[#000666]"
              >
                <div className="mb-3 flex items-start justify-between">
                  <span className="text-sm font-bold text-[#44474e]">体験レッスン</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#c4c6cf]">
                    <div
                      className={`h-3 w-3 rounded-full bg-[#000666] ${plan === 'experience' ? 'opacity-100' : 'opacity-0'}`}
                    />
                  </div>
                </div>
                <div className="mb-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-[#1a1c1e]">¥1,800</span>
                  <span className="text-sm text-[#44474e]">（税込）</span>
                </div>
                <p className="text-sm text-[#44474e]">初めての方のための1回添削体験</p>
              </label>
            </div>
          </section>

          <section className="mb-10">
            <h2 className="mb-4 font-[family-name:var(--font-headline)] text-lg font-bold text-[#1a1c1e]">
              初回の予約日を選択
            </h2>
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="mb-6 flex items-center justify-between px-1">
                <span className="font-bold">
                  {mobMonth.getFullYear()}年 {mobMonth.getMonth() + 1}月
                </span>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setMobMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                    className="cursor-pointer text-xl text-[#44474e]"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                    className="cursor-pointer text-xl text-[#44474e]"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
              <div className="mb-3 grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="text-[11px] font-bold text-[#44474e]/60">
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {mobCells.map((c) => {
                  const sel =
                    c.inMonth &&
                    mobSelected.getFullYear() === mobMonth.getFullYear() &&
                    mobSelected.getMonth() === mobMonth.getMonth() &&
                    mobSelected.getDate() === c.day
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        if (!c.inMonth) return
                        setMobSelected(new Date(mobMonth.getFullYear(), mobMonth.getMonth(), c.day))
                      }}
                      className={`flex h-10 items-center justify-center text-sm ${
                        !c.inMonth ? 'text-[#c4c6cf]' : 'font-medium text-[#1a1c1e]'
                      } ${sel ? 'rounded-xl bg-[#000666] font-bold text-white shadow-md' : 'cursor-pointer rounded-xl hover:bg-[#eff1f3]'}`}
                    >
                      {c.day}
                    </button>
                  )
                })}
              </div>
              <div className="mt-6 border-t border-black/5 pt-4">
                <p className="flex items-center gap-2 text-[11px] text-[#44474e]">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  選択した日から第1回課題が開始されます
                </p>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="relative overflow-hidden rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <div className="absolute left-0 top-0 h-1 w-full bg-[#000666]" />
              <h3 className="mb-6 text-sm font-bold text-[#1a1c1e]">注文内容の確認</h3>
              <div className="space-y-4">
                {plan === 'ten' ? (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#1a1c1e]">10回コース</p>
                        <p className="mt-0.5 text-[11px] text-[#44474e]">実践的な文章力を養う全10回の集中コース</p>
                      </div>
                      <span className="text-sm font-bold text-[#1a1c1e]">¥21,800</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#44474e]">開始予定日</span>
                      <span className="font-medium text-[#1a1c1e]">{formatMobDateShort(mobSelected)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#44474e]">消費税 (10%)</span>
                      <span className="font-medium text-[#1a1c1e]">¥2,180</span>
                    </div>
                    <div className="flex items-end justify-between border-t border-black/5 pt-6">
                      <span className="text-base font-bold text-[#1a1c1e]">合計金額</span>
                      <span className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-[#000666]">
                        ¥23,980
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-[#1a1c1e]">体験レッスン</p>
                        <p className="mt-0.5 text-[11px] text-[#44474e]">初めての方のための1回添削体験</p>
                      </div>
                      <span className="text-sm font-bold text-[#1a1c1e]">¥{experienceSub.toLocaleString('ja-JP')}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#44474e]">開始予定日</span>
                      <span className="font-medium text-[#1a1c1e]">{formatMobDateShort(mobSelected)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#44474e]">消費税 (10%)</span>
                      <span className="font-medium text-[#1a1c1e]">¥{experienceTax.toLocaleString('ja-JP')}</span>
                    </div>
                    <div className="flex items-end justify-between border-t border-black/5 pt-6">
                      <span className="text-base font-bold text-[#1a1c1e]">合計金額</span>
                      <span className="font-[family-name:var(--font-headline)] text-3xl font-extrabold text-[#000666]">
                        ¥{experienceTotal.toLocaleString('ja-JP')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          <footer className="mt-4 px-1 pb-32 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-[#44474e]">
              <Link to="/writing" className="hover:text-[#000666]">
                ミリネ韓国語教室　作文トレーニング
              </Link>
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-bold uppercase text-[#44474e]/60">
              <span className="cursor-pointer hover:text-[#000666]">利用規約</span>
              <span className="cursor-pointer hover:text-[#000666]">プライバシーポリシー</span>
              <span className="cursor-pointer hover:text-[#000666]">特定商取引法に基づく表記</span>
            </div>
          </footer>
        </main>

        <section className="fixed bottom-0 left-0 z-40 w-full border-t border-black/5 bg-white/90 px-5 py-6 backdrop-blur-xl">
          <button
            type="button"
            onClick={goToPayment}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#000666] font-bold text-white shadow-lg shadow-[#000666]/20 transition-transform active:scale-[0.98]"
          >
            <span>支払いへ進む</span>
            <span className="material-symbols-outlined text-xl">arrow_forward</span>
          </button>
        </section>
      </div>
    </div>
  )
}
