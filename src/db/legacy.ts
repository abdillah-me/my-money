/*
 * Konversi data format lama (ID angka auto-increment, skema v1–v3) ke skema v4 (ID string).
 * Dipakai oleh migrasi database lama di perangkat & import file backup lama.
 */
import {
  builtinCategoryId,
  CASH_WALLET_ID,
  compact,
  recurringTxId,
  type Budget,
  type Category,
  type Debt,
  type Note,
  type RecurringRule,
  type SplitBill,
  type TableName,
  type TableTypes,
  type Transaction,
  type Wallet,
} from './db'
import { occurrence } from '@/lib/recurring'

/* eslint-disable @typescript-eslint/no-explicit-any -- data lama tidak bertipe ketat */
type Any = Record<string, any>

export interface LegacyData {
  categories?: Any[]
  transactions?: Any[]
  wallets?: Any[]
  splitBills?: Any[]
  notes?: Any[]
  budgets?: Any[]
  recurring?: Any[]
  debts?: Any[]
}

export type V4Tables = { [K in TableName]: TableTypes[K][] }

export interface ConvertResult {
  tables: V4Tables
  /** Peta ID lama -> baru, untuk memperbarui pengaturan (kategori/dompet terakhir) */
  categoryIds: Map<number, string>
  walletIds: Map<number, string>
}

/**
 * Data lama tidak punya waktu ubah. Diberi updatedAt = 1 ("sangat lama") supaya
 * perubahan yang lebih baru di perangkat mana pun selalu menang saat digabung,
 * dan import ulang file yang sama tidak menimpa editan setelahnya.
 */
const LEGACY_TS = 1

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/**
 * @param prefix awalan ID unik per sumber: acak per perangkat (migrasi DB) atau
 *   turunan dari file (import backup) agar import ulang file yang sama tidak membuat duplikat.
 */
export function convertLegacy(data: LegacyData, prefix: string): ConvertResult {
  const idFor = (kind: string, old: unknown) => `${prefix}.${kind}${old}`

  // ---- Kategori ----
  const categoryIds = new Map<number, string>()
  const categories: Category[] = []
  for (const c of data.categories ?? []) {
    const oldId = num(c.id)
    if (oldId === undefined || (c.type !== 'income' && c.type !== 'expense')) continue
    const id = c.builtin ? builtinCategoryId(c.builtin) : idFor('c', oldId)
    categoryIds.set(oldId, id)
    categories.push(compact({ id, updatedAt: LEGACY_TS, name: str(c.name), builtin: c.builtin || undefined, type: c.type, icon: str(c.icon) || '📌', color: str(c.color) || '#64748b' }))
  }

  // ---- Dompet (backup v1/v2 belum punya dompet -> semua ke Tunai) ----
  const walletIds = new Map<number, string>()
  const wallets: Wallet[] = []
  for (const w of data.wallets ?? []) {
    const oldId = num(w.id)
    if (oldId === undefined) continue
    const id = w.builtin === 'cash' ? CASH_WALLET_ID : idFor('w', oldId)
    walletIds.set(oldId, id)
    wallets.push(compact({ id, updatedAt: LEGACY_TS, name: str(w.name), builtin: w.builtin || undefined, icon: str(w.icon) || '💵', color: str(w.color) || '#16a34a', initial: num(w.initial) ?? 0, archived: !!w.archived }, ['initial']))
  }
  const walletOf = (old: unknown) => walletIds.get(num(old) ?? -1) ?? CASH_WALLET_ID

  // ---- Aturan berulang ----
  const ruleIds = new Map<number, string>()
  const rulesByOld = new Map<number, Any>()
  const recurring: RecurringRule[] = []
  for (const r of data.recurring ?? []) {
    const oldId = num(r.id)
    const categoryId = categoryIds.get(num(r.categoryId) ?? -1)
    if (oldId === undefined || !categoryId) continue
    const id = idFor('r', oldId)
    ruleIds.set(oldId, id)
    rulesByOld.set(oldId, r)
    recurring.push(compact({ id, updatedAt: LEGACY_TS, type: r.type, amount: num(r.amount) ?? 0, categoryId, walletId: walletOf(r.walletId), note: str(r.note), freq: r.freq, start: num(r.start) ?? 0, n: num(r.n) ?? 0, paused: !!r.paused }, ['amount', 'n']))
  }

  // ---- Transaksi ----
  const txIds = new Map<number, string>()
  const transactions: Transaction[] = []
  for (const t of data.transactions ?? []) {
    const oldId = num(t.id)
    const amount = num(t.amount)
    const date = num(t.date)
    if (oldId === undefined || amount === undefined || date === undefined) continue
    const type = t.type === 'income' || t.type === 'transfer' ? t.type : 'expense'

    // Transaksi hasil aturan berulang diberi ID tetap `r.<aturan>.<urutan>` agar tidak dobel
    let id = idFor('t', oldId)
    const oldRule = num(t.recurringId)
    const ruleId = oldRule !== undefined ? ruleIds.get(oldRule) : undefined
    if (ruleId) {
      const r = rulesByOld.get(oldRule!)!
      for (let k = 0; k < (num(r.n) ?? 0) + 1; k++) {
        if (occurrence(r.start, r.freq, k) === date) {
          id = recurringTxId(ruleId, k)
          break
        }
      }
    }
    txIds.set(oldId, id)
    transactions.push(
      compact(
        {
          id,
          updatedAt: LEGACY_TS,
          type,
          amount,
          categoryId: type === 'transfer' ? undefined : categoryIds.get(num(t.categoryId) ?? -1),
          walletId: walletOf(t.walletId),
          toWalletId: type === 'transfer' ? walletOf(t.toWalletId) : undefined,
          date,
          note: str(t.note),
          recurringId: ruleId,
        },
        ['amount'],
      ),
    )
  }

  // ---- Lainnya ----
  const splitBills: SplitBill[] = (data.splitBills ?? [])
    .filter((b) => num(b.id) !== undefined && Array.isArray(b.participants))
    .map((b) =>
      compact(
        {
          id: idFor('s', b.id),
          updatedAt: num(b.updatedAt) ?? LEGACY_TS,
          createdAt: num(b.createdAt) ?? LEGACY_TS,
          title: str(b.title),
          date: num(b.date) ?? 0,
          mode: b.mode === 'items' ? 'items' : 'equal',
          total: num(b.total) ?? 0,
          taxPct: num(b.taxPct) ?? 0,
          servicePct: num(b.servicePct) ?? 0,
          participants: b.participants,
          items: Array.isArray(b.items) ? b.items : [],
          payerId: b.payerId,
          transactionId: txIds.get(num(b.transactionId) ?? -1),
        } as SplitBill,
        ['total', 'taxPct', 'servicePct'],
      ),
    )

  const notes: Note[] = (data.notes ?? [])
    .filter((n) => num(n.id) !== undefined)
    .map((n) => compact({ id: idFor('n', n.id), updatedAt: num(n.updatedAt) ?? LEGACY_TS, title: str(n.title), content: str(n.content), pinned: !!n.pinned }))

  const budgets: Budget[] = []
  for (const b of data.budgets ?? []) {
    const id = categoryIds.get(num(b.categoryId) ?? -1)
    const amount = num(b.amount)
    if (id && amount) budgets.push({ id, updatedAt: LEGACY_TS, amount })
  }

  const debts: Debt[] = (data.debts ?? [])
    .filter((d) => num(d.id) !== undefined && num(d.amount) !== undefined)
    .map((d) => compact({ id: idFor('d', d.id), updatedAt: LEGACY_TS, person: str(d.person), amount: d.amount, dir: d.dir === 'borrowed' ? 'borrowed' : 'lent', date: num(d.date) ?? 0, note: str(d.note), paid: !!d.paid }, ['amount']))

  return {
    tables: { categories, wallets, transactions, splitBills, notes, budgets, recurring, debts },
    categoryIds,
    walletIds,
  }
}

/** Hash FNV-1a 32-bit -> base36, untuk awalan ID yang stabil per file backup */
export function shortHash(input: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}
