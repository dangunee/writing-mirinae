import type { TrialPaymentCalendarState } from '../types/trialPaymentForm'

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** 体験レッスン申込カレンダー — 表示月は当月、選択日は今日 */
export function createTodayCalendarState(): TrialPaymentCalendarState {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  return {
    view: new Date(y, m, 1),
    selected: new Date(y, m, d),
  }
}

export function formatJpDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatMonthLabel(d: Date): string {
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月`
}

export type CalendarCell = { key: string; day: number; inMonth: boolean }

export function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0).getDate()
  const pad = first.getDay()
  const prevLast = new Date(year, month, 0).getDate()
  const cells: CalendarCell[] = []
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

export function weekdayHeaders(mode: 'ja' | 'en'): string[] {
  return mode === 'ja' ? WEEKDAYS_JA : WEEKDAYS_EN
}
