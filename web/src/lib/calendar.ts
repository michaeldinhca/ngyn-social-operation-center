// Calendar math on plain 'YYYY-MM-DD' day keys, so DST never shifts a cell. Weeks start on Sunday.

const utc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

export function addDays(dayKey: string, n: number): string {
  const d = utc(dayKey)
  d.setUTCDate(d.getUTCDate() + n)
  return key(d)
}

export function addMonths(dayKey: string, n: number): string {
  const d = utc(dayKey)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  return key(d)
}

export function weekStart(dayKey: string): string {
  return addDays(dayKey, -utc(dayKey).getUTCDay())
}

export interface Cell {
  key: string
  inMonth: boolean
}

/** Whole weeks covering the month of dayKey. */
export function monthGrid(dayKey: string): Cell[] {
  const first = key(new Date(Date.UTC(utc(dayKey).getUTCFullYear(), utc(dayKey).getUTCMonth(), 1)))
  const month = first.slice(0, 7)
  const start = weekStart(first)
  const last = addDays(addMonths(first, 1), -1)
  const end = addDays(weekStart(last), 6)
  const cells: Cell[] = []
  for (let k = start; k <= end; k = addDays(k, 1)) cells.push({ key: k, inMonth: k.startsWith(month) })
  return cells
}

export function weekGrid(dayKey: string): Cell[] {
  const start = weekStart(dayKey)
  return Array.from({ length: 7 }, (_, i) => ({ key: addDays(start, i), inMonth: true }))
}

export function monthLabel(dayKey: string): string {
  return utc(dayKey).toLocaleDateString('en-CA', { timeZone: 'UTC', month: 'long', year: 'numeric' })
}

export function dayLabel(dayKey: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return utc(dayKey).toLocaleDateString('en-CA', { timeZone: 'UTC', ...opts })
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
