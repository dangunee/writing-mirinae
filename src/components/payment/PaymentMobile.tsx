import type {
  TrialPaymentCalendarSet,
  TrialPaymentCalendarState,
  TrialPaymentFormSet,
  TrialPaymentFormValues,
} from '../../types/trialPaymentForm'
import { buildCalendarCells, formatMonthLabel, weekdayHeaders } from '../../utils/trialPaymentCalendar'

const VISA_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuB24sogpzLGBR61k0QNnVYhZq_k3ZxtdKXLtfanFUW2HL3o1lmHkmYAP0Vxg5QGTEVsa5G17pi3t97CD592H-dCICdJ7jL3xF4qP1iQv720AmiNYZlVkNx0zqYV51Jc8zelY6E3IvexrZTU5lOrtPKiFJGvr35mRxpQYemGZTzdmnlf_E7fftJufe-Fqqf39OrKz9FinU63Boq_Jq-rlkVM7nT0ysw5tk_z1CHwSO_hp85Fa-htdzE0s0Vv1SdlsvO6uLvSMBey2rY'
const MC_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBkjduMHr4-iYIe2mfUCuZv4TOg96JyMUYHAsfGgrtMsb4iwHWOkdMujkJF7POJ64f0_IUbo-h8tPGMXVvD10JsUACK5s15F9IHjJihUtQeTfnif0XHmZPUKQkXNoQCbbjK1GnV9QyHBa4GPkrDtVvmTYGaASFYtkVu5qqj8Y5Ps-O_iW6AVOF8pRUKWJ30cZ-eBlUauTYT8dLFno2qRBzneatAb2JlrtCewZ6xr8uzKr61Qh0aKVorjmamGtAXZO0fsqxpoon6CYI'

type Props = {
  form: TrialPaymentFormValues
  setForm: TrialPaymentFormSet
  calendar: TrialPaymentCalendarState
  setCalendar: TrialPaymentCalendarSet
  showValidationError: boolean
  onCardPay: () => void
  onBankTransfer: () => void | Promise<void>
  bankTransferSubmitting?: boolean
}

function shiftMonth(view: Date, delta: number) {
  return new Date(view.getFullYear(), view.getMonth() + delta, 1)
}

export default function PaymentMobile({
  form,
  setForm,
  calendar,
  setCalendar,
  showValidationError,
  onCardPay,
  onBankTransfer,
  bankTransferSubmitting = false,
}: Props) {
  const { view, selected } = calendar
  const y = view.getFullYear()
  const m = view.getMonth()
  const cells = buildCalendarCells(y, m)
  const jaWeekdays = weekdayHeaders('ja')

  const isSelectedDay = (day: number, inMonth: boolean) => {
    if (!inMonth) return false
    return (
      selected.getFullYear() === y && selected.getMonth() === m && selected.getDate() === day
    )
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-[#2c2f32]">
      <main className="payment-page-mobile-main mx-auto max-w-md space-y-6 px-5 pb-12 pt-24">
        <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#4052b6] to-[#8899ff] p-8 text-white shadow-lg shadow-[#4052b6]/10">
          <div className="absolute right-0 top-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-8xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              auto_stories
            </span>
          </div>
          <div className="relative z-10">
            <p className="mb-2 font-bold tracking-[0.2em] text-[#8899ff]/80 text-xs">TRIAL LESSON</p>
            <h2 className="payment-font-headline mb-1 text-3xl font-extrabold">体験レッスン</h2>
            <p className="mb-6 text-sm leading-relaxed opacity-90">初めての方のための1回添削体験</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">¥1,800</span>
              <span className="text-xs opacity-75">(税込)</span>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4052b6] text-sm font-bold text-[#f3f1ff]">
              01
            </span>
            <h3 className="payment-font-headline text-lg font-bold">開始日を選択</h3>
          </div>
          <div className="mb-4 rounded-lg bg-[#eef1f4] p-4">
            <div className="mb-4 flex items-center justify-between">
              <button type="button" className="material-symbols-outlined text-[#74777a]" aria-label="前月" onClick={() => setCalendar((prev) => ({ ...prev, view: shiftMonth(prev.view, -1) }))}>
                chevron_left
              </button>
              <span className="text-sm font-bold">{formatMonthLabel(view)}</span>
              <button type="button" className="material-symbols-outlined text-[#74777a]" aria-label="次月" onClick={() => setCalendar((prev) => ({ ...prev, view: shiftMonth(prev.view, 1) }))}>
                chevron_right
              </button>
            </div>
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold opacity-50">
              {jaWeekdays.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {cells.map((cell) => {
                const sel = isSelectedDay(cell.day, cell.inMonth)
                if (!cell.inMonth) {
                  return (
                    <div key={cell.key} className="p-2 text-xs opacity-20">
                      {cell.day}
                    </div>
                  )
                }
                if (sel) {
                  return (
                    <div key={cell.key} className="p-2 text-xs font-bold">
                      <div className="flex items-center justify-center rounded-full bg-[#4052b6] px-2 py-1.5 text-white">
                        {cell.day}
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={cell.key} className="p-2 text-xs">
                    <button
                      type="button"
                      className="w-full rounded-full p-2 transition-colors hover:bg-white/50"
                      onClick={() =>
                        setCalendar((prev) => ({
                          ...prev,
                          selected: new Date(y, m, cell.day),
                        }))
                      }
                    >
                      {cell.day}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="flex items-center gap-1 text-xs text-[#74777a]">
            <span className="material-symbols-outlined text-sm">info</span>
            選択した日から課題を提出できます
          </p>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4052b6] text-sm font-bold text-[#f3f1ff]">
              02
            </span>
            <h3 className="payment-font-headline text-lg font-bold">お客様情報</h3>
          </div>
          <form className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#2c2f32]/70">
                お名前 <span className="text-[#b41340]">(必須)</span>
              </label>
              <input
                className="w-full rounded-lg border-none bg-[#eef1f4] px-4 py-3 transition-all placeholder:text-[#74777a]/50 focus:bg-white focus:ring-2 focus:ring-[#4052b6]"
                placeholder="例：山田 太郎"
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#2c2f32]/70">
                ふりがな <span className="text-[#b41340]">(必須)</span>
              </label>
              <input
                className="w-full rounded-lg border-none bg-[#eef1f4] px-4 py-3 transition-all placeholder:text-[#74777a]/50 focus:bg-white focus:ring-2 focus:ring-[#4052b6]"
                placeholder="例：やまだ たろう"
                type="text"
                value={form.furigana}
                onChange={(e) => setForm((f) => ({ ...f, furigana: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#2c2f32]/70">
                韓国語レベル <span className="text-[#b41340]">(必須)</span>
              </label>
              <select
                className="w-full rounded-lg border-none bg-[#eef1f4] px-4 py-3 transition-all focus:bg-white focus:ring-2 focus:ring-[#4052b6]"
                value={form.koreanLevel}
                onChange={(e) => setForm((f) => ({ ...f, koreanLevel: e.target.value }))}
              >
                <option disabled value="">
                  選択してください
                </option>
                <option value="beginner">未経験・入門</option>
                <option value="elementary">初級</option>
                <option value="intermediate">中級</option>
                <option value="advanced">上級</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#2c2f32]/70">
                メールアドレス <span className="text-[#b41340]">(必須)</span>
              </label>
              <input
                className="w-full rounded-lg border-none bg-[#eef1f4] px-4 py-3 transition-all placeholder:text-[#74777a]/50 focus:bg-white focus:ring-2 focus:ring-[#4052b6]"
                placeholder="example@mail.com"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#2c2f32]/70">
                お問い合わせ <span className="text-[#74777a]">(任意)</span>
              </label>
              <textarea
                className="w-full rounded-lg border-none bg-[#eef1f4] px-4 py-3 transition-all placeholder:text-[#74777a]/50 focus:bg-white focus:ring-2 focus:ring-[#4052b6]"
                placeholder="ご質問などあればご記入ください"
                rows={3}
                value={form.inquiry}
                onChange={(e) => setForm((f) => ({ ...f, inquiry: e.target.value }))}
              />
            </div>
            {showValidationError ? (
              <div className="pt-2">
                <p className="flex items-center gap-1 text-xs font-bold text-[#b41340]">
                  <span className="material-symbols-outlined text-sm">warning</span>※ 必須項目を入力してください
                </p>
              </div>
            ) : null}
          </form>
        </section>

        <section className="rounded-xl border border-transparent bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#4052b6]">credit_card</span>
              <h3 className="payment-font-headline text-md font-bold">カード決済</h3>
            </div>
            <div className="flex gap-1.5">
              <img alt="Visa" className="h-4 w-auto grayscale opacity-50" src={VISA_IMG} />
              <img alt="Mastercard" className="h-4 w-auto grayscale opacity-50" src={MC_IMG} />
            </div>
          </div>
          <button
            type="button"
            onClick={onCardPay}
            className="mb-3 w-full cursor-pointer rounded-full bg-[#d9dde1] py-4 text-sm font-bold text-[#74777a] transition-opacity hover:opacity-90"
          >
            カードで決済する
          </button>
          <p className="text-center text-[10px] text-[#74777a]">※ 決済後の返金はできません</p>
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#4052b6]">account_balance</span>
            <h3 className="payment-font-headline text-md font-bold">銀行振込</h3>
          </div>
          <div className="mb-6 space-y-4 rounded-lg bg-[#eef1f4] p-4">
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#74777a]">三井住友銀行 (SMBC)</p>
              <p className="text-xs font-medium leading-relaxed">
                〇〇支店 普通 1234567
                <br />
                ミリネ韓国語教室　作文トレーニング
              </p>
            </div>
            <div className="h-px bg-[#abadb0]/20" />
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#74777a]">ゆうちょ銀行</p>
              <p className="text-xs font-medium leading-relaxed">
                記号 12345 番号 12345671
                <br />
                ミリネ韓国語教室　作文トレーニング
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onBankTransfer()}
            disabled={bankTransferSubmitting}
            className="mb-3 w-full rounded-full bg-[#ff9727] py-4 text-sm font-bold text-[#4c2700] shadow-lg shadow-[#ff9727]/15 transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
          >
            {bankTransferSubmitting ? '送信中…' : '銀行振込で申し込む'}
          </button>
          <p className="px-2 text-center text-[10px] text-[#74777a]">※ 銀行振込は入金確認後にご利用開始となります</p>
        </section>
      </main>

      <footer className="w-full border-t border-slate-200 bg-[#f5f7fa] py-12 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between space-y-6 px-8 md:flex-row md:space-y-0">
          <div className="space-y-2 text-center md:text-left">
            <h4 className="payment-font-headline text-lg font-bold text-[#4052b6]">ミリネ韓国語教室　作文トレーニング</h4>
            <p className="text-xs leading-relaxed text-slate-500">ソウルの空気を感じる、上質な学びの場。</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <a className="text-xs uppercase tracking-wide text-slate-500 underline transition-all hover:text-[#4052b6]" href="#">
              利用規約
            </a>
            <a className="text-xs uppercase tracking-wide text-slate-500 underline transition-all hover:text-[#4052b6]" href="#">
              特定商取引法に基づく表記
            </a>
            <a className="text-xs uppercase tracking-wide text-slate-500 underline transition-all hover:text-[#4052b6]" href="#">
              プライバシーポリシー
            </a>
          </div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            © 2024 ミリネ韓国語教室　作文トレーニング. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
