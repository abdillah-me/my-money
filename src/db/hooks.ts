import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type Category, type Transaction } from './db'
import { monthRange } from '../lib/format'
import { useSettings } from '../lib/settings'

export function useCategories() {
  return useLiveQuery(() => db.categories.toArray(), [], [] as Category[])
}

export function useCategoryMap() {
  const categories = useCategories()
  return useMemo(() => new Map(categories.map((c) => [c.id!, c])), [categories])
}

/** Nama kategori sesuai bahasa aktif */
export function useCategoryName() {
  const { t } = useSettings()
  return (c?: Category) => {
    if (!c) return t('cat.unknown')
    return c.builtin ? t(`cat.${c.builtin}` as Parameters<typeof t>[0]) : c.name
  }
}

/** Transaksi dalam satu bulan, terbaru lebih dulu. `undefined` saat masih memuat. */
export function useMonthTransactions(year: number, month: number) {
  return useLiveQuery(async () => {
    const [start, end] = monthRange(year, month)
    const list = await db.transactions.where('date').between(start, end, true, false).toArray()
    return list.sort((a, b) => b.date - a.date)
  }, [year, month])
}

/** Saldo total sepanjang waktu */
export function useTotalBalance() {
  return useLiveQuery(async () => {
    let total = 0
    await db.transactions.each((t) => {
      total += t.type === 'income' ? t.amount : -t.amount
    })
    return total
  }, [], 0)
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
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], [])

  return useMemo(() => {
    const limits = new Map(budgets.map((b) => [b.categoryId, b.amount]))
    const spent = new Map<number, number>()
    for (const tx of txs ?? []) {
      if (tx.type === 'expense') spent.set(tx.categoryId, (spent.get(tx.categoryId) ?? 0) + tx.amount)
    }
    return categories
      .filter((c) => c.type === 'expense')
      .map<BudgetStatus>((c) => {
        const limit = limits.get(c.id!) ?? 0
        const s = spent.get(c.id!) ?? 0
        return { category: c, limit, spent: s, pct: limit > 0 ? (s / limit) * 100 : 0 }
      })
  }, [txs, categories, budgets])
}

export function summarize(list: Transaction[] = []) {
  let income = 0
  let expense = 0
  for (const t of list) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense, net: income - expense }
}
