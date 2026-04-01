import type {
  TrialPaymentCalendarSet,
  TrialPaymentCalendarState,
  TrialPaymentFormSet,
  TrialPaymentFormValues,
} from '../../types/trialPaymentForm'
import { buildCalendarCells, formatMonthLabel } from '../../utils/trialPaymentCalendar'

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

export default function PaymentDesktop({
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

  const isSelectedDay = (day: number, inMonth: boolean) => {
    if (!inMonth) return false
    return (
      selected.getFullYear() === y && selected.getMonth() === m && selected.getDate() === day
    )
  }

  return (
    <div className="bg-[#f5f7fa] text-[#2c2f32] selection:bg-[#8899ff] selection:text-[#00156e]">
      <main className="px-4 pb-20 pt-24 md:px-0">
        <div className="mx-auto max-w-3xl space-y-8">
          <section className="relative overflow-hidden rounded-xl border border-[#abadb0]/15 bg-white p-8 shadow-sm">
            <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-[#4052b6]/5 blur-3xl" />
            <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <span className="mb-4 inline-block rounded-full bg-[#000666] px-3 py-1 text-[10px] font-bold tracking-[0.15em] text-white">
                  TRIAL LESSON
                </span>
                <h1 className="payment-font-headline mb-2 text-3xl font-bold tracking-tight text-[#2c2f32]">体験レッスン</h1>
                <p className="text-sm text-[#595c5e]">初めての方のための1回添削体験</p>
              </div>
              <div className="text-right">
                <div className="mb-1 text-xs font-medium text-[#595c5e]">受講料</div>
                <div className="text-4xl font-extrabold tracking-tighter text-[#000666]">
                  ¥1,800 <span className="text-sm font-normal text-[#595c5e]">(税込)</span>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8">
            <div className="rounded-xl bg-[#eef1f4] p-8">
              <div className="mb-6 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#000666]/10 text-sm font-bold text-[#000666]">
                  01
                </span>
                <h2 className="payment-font-headline text-lg font-bold text-[#2c2f32]">開始日を選択</h2>
              </div>
              <div className="rounded-lg border border-[#abadb0]/10 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-sm font-bold text-[#2c2f32]">{formatMonthLabel(view)}</span>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      className="material-symbols-outlined cursor-pointer text-[#74777a] hover:text-[#000666]"
                      aria-label="前月"
                      onClick={() =>
                        setCalendar((prev) => ({ ...prev, view: shiftMonth(prev.view, -1) }))
                      }
                    >
                      chevron_left
                    </button>
                    <button
                      type="button"
                      className="material-symbols-outlined cursor-pointer text-[#74777a] hover:text-[#000666]"
                      aria-label="次月"
                      onClick={() =>
                        setCalendar((prev) => ({ ...prev, view: shiftMonth(prev.view, 1) }))
                      }
                    >
                      chevron_right
                    </button>
                  </div>
                </div>
                <div className="mb-4 grid grid-cols-7 gap-px text-center">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w) => (
                    <div
                      key={w}
                      className="pb-3 text-[10px] font-bold uppercase tracking-tighter text-[#abadb0]"
                    >
                      {w}
                    </div>
                  ))}
                  {cells.map((cell) => {
                    const sel = isSelectedDay(cell.day, cell.inMonth)
                    return (
                      <div
                        key={cell.key}
                        className={
                          cell.inMonth
                            ? sel
                              ? 'flex items-center justify-center py-3'
                              : 'cursor-pointer rounded-full py-3 text-xs font-medium transition-colors hover:bg-[#eef1f4]'
                            : 'py-3 text-xs text-[#abadb0]/30'
                        }
                      >
                        {cell.inMonth
                          ? sel
                            ? (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#000666] text-xs font-bold text-white">
                                  {cell.day}
                                </div>
                              )
                            : (
                                <button
                                  type="button"
                                  className="w-full py-3 text-xs font-medium"
                                  onClick={() =>
                                    setCalendar((prev) => ({
                                      ...prev,
                                      selected: new Date(y, m, cell.day),
                                    }))
                                  }
                                >
                                  {cell.day}
                                </button>
                              )
                          : (
                              cell.day
                            )}
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex items-center gap-2 text-[#000666]/80">
                  <span className="material-symbols-outlined text-sm">info</span>
                  <p className="text-[13px]">選択した日から課題を提出できます</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-[#eef1f4] p-8">
              <div className="mb-8 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#000666]/10 text-sm font-bold text-[#000666]">
                  02
                </span>
                <h2 className="payment-font-headline text-lg font-bold text-[#2c2f32]">お客様情報</h2>
              </div>
              <form className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="flex items-center gap-1 text-xs font-bold text-[#2c2f32]">
                      お名前 <span className="text-[10px] text-[#b41340]">必須</span>
                    </label>
                    <input
                      className="w-full rounded-lg border-none bg-white p-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[#000666]/20"
                      placeholder="例：田中 花子"
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-1 text-xs font-bold text-[#2c2f32]">
                      ふりがな <span className="text-[10px] text-[#b41340]">必須</span>
                    </label>
                    <input
                      className="w-full rounded-lg border-none bg-white p-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[#000666]/20"
                      placeholder="例：たなか はなこ"
                      type="text"
                      value={form.furigana}
                      onChange={(e) => setForm((f) => ({ ...f, furigana: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-bold text-[#2c2f32]">
                    韓国語レベル <span className="text-[10px] text-[#b41340]">必須</span>
                  </label>
                  <select
                    className="w-full appearance-none rounded-lg border-none bg-white p-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[#000666]/20"
                    value={form.koreanLevel}
                    onChange={(e) => setForm((f) => ({ ...f, koreanLevel: e.target.value }))}
                  >
                    <option disabled value="">
                      レベルを選択してください
                    </option>
                    <option value="初級">初級</option>
                    <option value="初中級">初中級</option>
                    <option value="中級">中級</option>
                    <option value="中上級">中上級</option>
                    <option value="上級">上級</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-bold text-[#2c2f32]">
                    メールアドレス <span className="text-[10px] text-[#b41340]">必須</span>
                  </label>
                  <input
                    className="w-full rounded-lg border-none bg-white p-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[#000666]/20"
                    placeholder="example@mail.com"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  <p className="pl-1 text-[11px] italic text-[#595c5e]">
                    ※携帯キャリアメール（docomo, au, softbank）の方は受信設定をご確認ください。
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2c2f32]">
                    お問い合わせ <span className="ml-2 text-[10px] font-normal text-[#595c5e]">任意</span>
                  </label>
                  <textarea
                    className="w-full resize-none rounded-lg border-none bg-white p-4 text-sm outline-none transition-all focus:ring-2 focus:ring-[#000666]/20"
                    rows={4}
                    value={form.inquiry}
                    onChange={(e) => setForm((f) => ({ ...f, inquiry: e.target.value }))}
                  />
                </div>
              </form>
              {showValidationError ? (
                <p className="mt-4 text-[11px] font-medium italic text-[#b41340]">※ 必須項目を入力してください</p>
              ) : null}
            </div>

            <div className="py-10 text-center">
              <button
                type="button"
                onClick={onCardPay}
                className="mx-auto mb-4 flex w-full max-w-sm cursor-pointer items-center justify-center gap-2 rounded-full bg-slate-300 py-5 text-lg font-bold text-slate-500 shadow-sm transition-all hover:opacity-90"
              >
                <span className="material-symbols-outlined">lock</span>カードで決済する
              </button>
              <p className="flex items-center justify-center gap-1 text-xs text-[#595c5e]">
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                決済後、すぐに課題作成を開始できます
              </p>
              <p className="mt-3 text-center text-[11px] text-[#595c5e]/70">※ 決済後の返金はできません</p>
            </div>

            <div className="rounded-xl border-t border-[#abadb0]/10 bg-[#d9dde1]/40 p-8">
              <h2 className="mb-6 text-center font-bold text-[#2c2f32]">銀行振込をご希望の方</h2>
              <div className="mb-8 space-y-4 rounded-lg bg-white p-6 text-sm leading-relaxed text-[#595c5e]">
                <p className="mb-4 text-[11px] font-medium italic text-[#000666]/70">※ 銀行振込は入金確認後にご利用開始となります</p>
                <p>銀行振込の場合、ご入金確認後の受講開始となります。確認まで1〜2営業日ほどお時間をいただく場合がございます。</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[#abadb0]/15 bg-[#eef1f4]/30 p-4">
                    <div className="mb-2 text-[10px] font-bold uppercase text-[#000666]">振込先 A</div>
                    <div className="text-[13px] font-medium leading-loose">
                      三井住友銀行 日暮里支店
                      <br />
                      普通 7961777
                      <br />
                      (株) カオンヌリ
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#abadb0]/15 bg-[#eef1f4]/30 p-4">
                    <div className="mb-2 text-[10px] font-bold uppercase text-[#000666]">振込先 B</div>
                    <div className="text-[13px] font-medium leading-loose">
                      ゆうちょ銀行（郵便局）
                      <br />
                      記号: 10190 番号: 90647671
                      <br />
                      カ) カオンヌリ
                    </div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void onBankTransfer()}
                disabled={bankTransferSubmitting}
                className="w-full rounded-xl bg-[#ff9727] py-4 text-sm font-bold text-[#4c2700] shadow-lg shadow-[#ff9727]/20 transition-all hover:brightness-105 active:scale-[0.99] disabled:cursor-wait disabled:opacity-80"
              >
                {bankTransferSubmitting ? '送信中…' : '銀行振込で申し込む'}
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-slate-200 bg-slate-50 py-12 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-8 md:flex-row">
          <div className="font-['Plus_Jakarta_Sans'] font-bold text-indigo-900 dark:text-indigo-100">
            ミリネ韓国語教室　作文トレーニング
          </div>
          <div className="flex gap-6">
            <a className="text-sm text-slate-500 transition-colors hover:text-indigo-500" href="#">
              Terms of Service
            </a>
            <a className="text-sm text-slate-500 transition-colors hover:text-indigo-500" href="#">
              Privacy Policy
            </a>
            <a className="text-sm text-slate-500 transition-colors hover:text-indigo-500" href="#">
              Contact Support
            </a>
          </div>
          <div className="text-xs tracking-wide text-slate-500">
            © 2024 ミリネ韓国語教室　作文トレーニング. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
