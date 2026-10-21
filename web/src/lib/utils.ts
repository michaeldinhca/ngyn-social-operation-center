import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortNumber(n: number | null): string {
  if (n === null) return 'Unavailable'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

export function signed(n: number | null): string {
  if (n === null) return 'Unavailable'
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0'
}

const TZ = 'America/Halifax'

export function formatDateTime(iso: string | null): string {
  if (!iso) return 'Time not set'
  return new Date(iso).toLocaleString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const abs = Math.abs(diff)
  const m = Math.round(abs / 60_000)
  const fmt = (v: number, unit: string) => `${v} ${unit}${v === 1 ? '' : 's'}`
  const text = m < 1 ? 'just now' : m < 60 ? fmt(m, 'minute') : m < 1440 ? fmt(Math.round(m / 60), 'hour') : fmt(Math.round(m / 1440), 'day')
  if (text === 'just now') return text
  return diff >= 0 ? `${text} ago` : `in ${text}`
}
