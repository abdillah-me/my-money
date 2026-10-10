import type { Lang } from './i18n'

export type Currency = 'IDR' | 'USD'

export const CURRENCIES: { code: Currency; label: string }[] = [
  { code: 'IDR', label: 'Rupiah (Rp)' },
  { code: 'USD', label: 'US Dollar ($)' },
]

const locales: Record<Lang, string> = { id: 'id-ID', en: 'en-US' }

export function localeOf(lang: Lang) {
  return locales[lang]
}

export function fractionDigits(currency: Currency) {
  return currency === 'IDR' ? 0 : 2
}

export function formatMoney(amount: number, currency: Currency, lang: Lang) {
  const digits = fractionDigits(currency)
  return new Intl.NumberFormat(localeOf(lang), {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

/** Format ringkas untuk sumbu chart, mis. 1,2 jt / 1.2M */
export function formatCompact(amount: number, lang: Lang) {
  return new Intl.NumberFormat(localeOf(lang), { notation: 'compact', maximumFractionDigits: 1 }).format(amount)
}

export function formatDate(ts: number, lang: Lang, withTime = true) {
  const d = new Date(ts)
  const date = d.toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' })
  if (!withTime) return date
  const time = d.toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' })
  return `${date} • ${time}`
}

export function formatMonth(year: number, month: number, lang: Lang) {
  return new Date(year, month, 1).toLocaleDateString(localeOf(lang), { month: 'long', year: 'numeric' })
}

/** Rentang epoch ms [start, end) untuk sebuah bulan */
export function monthRange(year: number, month: number): [number, number] {
  return [new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime()]
}

/** Ubah input user menjadi angka. IDR: hanya digit; USD: boleh satu desimal (titik/koma). */
export function parseAmount(raw: string, decimals: number): number {
  if (decimals === 0) return Number(raw.replace(/\D/g, '')) || 0
  const cleaned = raw.replace(/[^\d.,]/g, '').replace(',', '.')
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? Math.round(n * 10 ** decimals) / 10 ** decimals : 0
}

/** Nilai untuk <input type="date"> dan <input type="time"> dalam zona waktu lokal */
export function toDateInput(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function toTimeInput(ts: number) {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fromInputs(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = (time || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm).getTime()
}
