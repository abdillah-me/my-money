import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { allAlive, db, getAlive, isAlive, patch, type Budget, type Category, type Transaction, type Wallet } from './db'
import { fractionDigits, monthRange } from '../lib/format'
import type { DictKey } from '../lib/i18n'
import { useSettings } from '../lib/settings'
import { computeSplit } from '../lib/split'

const EMPTY: never[] = []

export function useCategories() {
  return useLiveQuery(() => allAlive('categories'), [], EMPTY as Category[])
}

export function useCategoryMap() {
  const categories = useCategories()
  // Kunci boleh undefined agar `map.get(tx.categoryId)` aman untuk transfer (tanpa kategori)
  return useMemo(() => new Map<string | undefined, Category>(categories.map((c) => [c.id, c])), [categories])
}

/** Nama kategori sesuai bahasa aktif */
export function useCategoryName() {
  const { t } = useSettings()
  return (c?: Category) => {
    if (!c) return t('cat.unknown')
    return c.builtin ? t(`cat.${c.builtin}` as DictKey) : c.name
  }
}

/** Semua dompet (termasuk yang diarsipkan; filter `archived` di pemanggil bila perlu) */
export function useWallets() {
  return useLiveQuery(() => allAlive('wallets'), [], EMPTY as Wallet[])
}

export function useWalletMap() {
  const wallets = useWallets()
  return useMemo(() => new Map(wallets.map((w) => [w.id, w])), [wallets])
}

export function useWalletName() {
  const { t } = useSettings()
  return (w?: Wallet) => {
    if (!w) return '—'
    return w.builtin ? t(`wallet.${w.builtin}` as DictKey) : w.name
  }
}

/** Transaksi dalam satu bulan, terbaru lebih dulu. `undefined` saat masih memuat. */
export function useMonthTransactions(year: number, month: number) {
  return useLiveQuery(async () => {
    const [start, end] = monthRange(year, month)
    // Nisan tidak punya `date`, jadi tidak ikut terbaca lewat index ini
    const list = await db.transactions.where('date').between(start, end, true, false).toArray()
    return list.filter(isAlive).sort((a, b) => b.date - a.date)
  }, [year, month])
}

/**
 * Saldo per dompet + total, dihitung dalam satu kali baca seluruh transaksi.
 * Saldo tidak disimpan di database agar tidak ada data ganda yang bisa tidak sinkron.
 */
export function useBalances() {
  return useLiveQuery(
    async () => {
      const wallets = await allAlive('wallets')
      const byWallet = new Map<string, number>(wallets.map((w) => [w.id, w.initial ?? 0]))
      const add = (id: string | undefined, v: number) => id !== undefined && byWallet.has(id) && byWallet.set(id, byWallet.get(id)! + v)
      await db.transactions.each((t) => {
        if (t.deletedAt) return
        if (t.type === 'income') add(t.walletId, t.amount)
        else if (t.type === 'expense') add(t.walletId, -t.amount)
        else {
          add(t.walletId, -t.amount)
          add(t.toWalletId, t.amount)
        }
      })
      let total = 0
      for (const v of byWallet.values()) total += v
      return { byWallet, total }
    },
    [],
    { byWallet: new Map<string, number>(), total: 0 },
  )
}

export interface BudgetStatus {
  category: Category
  limit: number
  spent: number
  /** Persentase terpakai (bisa > 100) */
  pct: number
}

/** Status anggaran untuk setiap kategori pengeluaran pada bulan tertentu */
export function useBudgetStatus(year: number, month: number) {
  const txs = useMonthTransactions(year, month)
  const categories = useCategories()
  const budgets = useLiveQuery(() => allAlive('budgets'), [], EMPTY as Budget[])

  return useMemo(() => {
    const limits = new Map(budgets.map((b) => [b.id, b.amount]))
    const spent = new Map<string, number>()
    for (const tx of txs ?? []) {
      if (tx.type === 'expense' && tx.categoryId) spent.set(tx.categoryId, (spent.get(tx.categoryId) ?? 0) + tx.amount)
    }
    return categories
      .filter((c) => c.type === 'expense')
      .map<BudgetStatus>((c) => {
        const limit = limits.get(c.id) ?? 0
        const s = spent.get(c.id) ?? 0
        return { category: c, limit, spent: s, pct: limit > 0 ? (s / limit) * 100 : 0 }
      })
  }, [txs, categories, budgets])
}

/** Ringkasan pemasukan/pengeluaran. Transfer antar dompet tidak dihitung. */
export function summarize(list: Transaction[] = []) {
  let income = 0
  let expense = 0
  for (const t of list) {
    if (t.type === 'income') income += t.amount
    else if (t.type === 'expense') expense += t.amount
  }
  return { income, expense, net: income - expense }
}

export interface DebtEntry {
  key: string
  person: string
  amount: number
  dir: 'lent' | 'borrowed'
  date: number
  paid: boolean
  title?: string
  source: { kind: 'manual'; id: string } | { kind: 'split'; billId: string; participantId: string }
}

/**
 * Hutang-piutang gabungan: catatan manual + yang diturunkan dari Split Bill.
 * Split Bill tidak disalin ke tabel hutang, cukup dihitung ulang dari data tagihan.
 */
export function useDebts() {
  const { settings } = useSettings()
  const decimals = fractionDigits(settings.currency)
  const manual = useLiveQuery(() => allAlive('debts'), [])
  const bills = useLiveQuery(() => allAlive('splitBills'), [])

  return useMemo(() => {
    if (!manual || !bills) return undefined
    const entries: DebtEntry[] = manual.map((d) => ({
      key: `m${d.id}`,
      person: d.person,
      amount: d.amount,
      dir: d.dir,
      date: d.date,
      paid: !!d.paid,
      title: d.note,
      source: { kind: 'manual', id: d.id },
    }))

    for (const b of bills) {
      const me = b.participants.find((p) => p.isMe)
      if (!me) continue
      const payerId = b.payerId ?? me.id
      const { perPerson } = computeSplit(b, decimals)
      if (payerId === me.id) {
        // Saya yang bayar: peserta lain berhutang ke saya
        for (const p of b.participants) {
          const amount = perPerson.get(p.id) ?? 0
          if (p.isMe || amount <= 0) continue
          entries.push({
            key: `s${b.id}-${p.id}`,
            person: p.name,
            amount,
            dir: 'lent',
            date: b.date,
            paid: !!p.paid,
            title: b.title,
            source: { kind: 'split', billId: b.id, participantId: p.id },
          })
        }
      } else {
        // Orang lain yang bayar: saya berhutang bagian saya
        const payer = b.participants.find((p) => p.id === payerId)
        const amount = perPerson.get(me.id) ?? 0
        if (payer && amount > 0) {
          entries.push({
            key: `s${b.id}-${me.id}`,
            person: payer.name,
            amount,
            dir: 'borrowed',
            date: b.date,
            paid: !!me.paid,
            title: b.title,
            source: { kind: 'split', billId: b.id, participantId: me.id },
          })
        }
      }
    }

    entries.sort((a, b) => Number(a.paid) - Number(b.paid) || b.date - a.date)
    let owedToMe = 0
    let iOwe = 0
    for (const e of entries) {
      if (e.paid) continue
      if (e.dir === 'lent') owedToMe += e.amount
      else iOwe += e.amount
    }
    return { entries, owedToMe, iOwe }
  }, [manual, bills, decimals])
}

/** Tandai lunas / belum lunas untuk entri hutang dari sumber mana pun */
export async function setDebtPaid(entry: DebtEntry, paid: boolean) {
  if (entry.source.kind === 'manual') {
    await patch('debts', entry.source.id, { paid: paid || undefined })
    return
  }
  const { billId, participantId } = entry.source
  const bill = await getAlive('splitBills', billId)
  if (!bill) return
  const participants = bill.participants.map((p) => {
    if (p.id !== participantId) return p
    const { paid: _old, ...rest } = p
    return paid ? { ...rest, paid: true } : rest
  })
  await patch('splitBills', billId, { participants })
}
