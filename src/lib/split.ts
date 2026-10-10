import type { SplitBill } from '../db/db'

export function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export interface SplitResult {
  subtotal: number
  service: number
  tax: number
  grand: number
  /** Total per peserta (sudah termasuk pajak & service) */
  perPerson: Map<string, number>
  /** Ada item yang belum punya penanggung */
  hasUnassigned: boolean
}

const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals

/**
 * Hitung pembagian tagihan.
 * Service dihitung dari subtotal, lalu pajak dihitung dari subtotal + service
 * (umum di restoran Indonesia: PB1 dikenakan setelah service charge).
 */
export function computeSplit(bill: Pick<SplitBill, 'mode' | 'total' | 'taxPct' | 'servicePct' | 'participants' | 'items'>, decimals: number): SplitResult {
  const base = new Map<string, number>(bill.participants.map((p) => [p.id, 0]))
  let subtotal = 0
  let hasUnassigned = false

  if (bill.mode === 'equal') {
    subtotal = Math.max(0, bill.total)
    const each = bill.participants.length ? subtotal / bill.participants.length : 0
    for (const p of bill.participants) base.set(p.id, each)
  } else {
    for (const item of bill.items) {
      const price = Math.max(0, item.price)
      subtotal += price
      const owners = item.participantIds.filter((id) => base.has(id))
      if (owners.length === 0) {
        if (price > 0) hasUnassigned = true
        continue
      }
      for (const id of owners) base.set(id, base.get(id)! + price / owners.length)
    }
  }

  const service = subtotal * (Math.max(0, bill.servicePct) / 100)
  const tax = (subtotal + service) * (Math.max(0, bill.taxPct) / 100)
  const grand = subtotal + service + tax
  const factor = subtotal > 0 ? grand / subtotal : 0

  const roundedGrand = round(grand, decimals)

  // Largest remainder: bulatkan ke bawah, lalu bagikan sisa satuan terkecil ke pecahan terbesar,
  // sehingga jumlah per orang selalu sama persis dengan total yang dibagi.
  const unit = 10 ** decimals
  const raw = [...base].map(([id, v]) => ({ id, units: v * factor * unit }))
  const floored = raw.map((r) => ({ ...r, floor: Math.floor(r.units + 1e-9) }))
  const assignedUnits = Math.round(raw.reduce((a, r) => a + r.units, 0))
  let leftover = assignedUnits - floored.reduce((a, r) => a + r.floor, 0)
  for (const r of [...floored].sort((a, b) => b.units - b.floor - (a.units - a.floor))) {
    if (leftover <= 0) break
    r.floor += 1
    leftover--
  }

  const perPerson = new Map<string, number>()
  for (const r of floored) perPerson.set(r.id, r.floor / unit)

  return {
    subtotal: round(subtotal, decimals),
    service: round(service, decimals),
    tax: round(tax, decimals),
    grand: roundedGrand,
    perPerson,
    hasUnassigned,
  }
}
