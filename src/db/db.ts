import Dexie, { type EntityTable } from 'dexie'

export type TxType = 'income' | 'expense'

export interface Category {
  id?: number
  /** Nama untuk kategori buatan user. Kategori bawaan memakai `builtin` sebagai kunci terjemahan. */
  name: string
  builtin?: string
  type: TxType
  icon: string
  color: string
}

export interface Transaction {
  id?: number
  type: TxType
  amount: number
  categoryId: number
  /** Epoch milliseconds */
  date: number
  note: string
  createdAt: number
}

export interface SplitParticipant {
  id: string
  name: string
  /** Peserta yang mewakili pengguna aplikasi */
  isMe?: boolean
}

export interface SplitItem {
  id: string
  name: string
  price: number
  /** ID peserta yang ikut menanggung item ini */
  participantIds: string[]
}

export interface SplitBill {
  id?: number
  title: string
  date: number
  mode: 'equal' | 'items'
  /** Total tagihan untuk mode `equal` (sebelum pajak & service) */
  total: number
  taxPct: number
  servicePct: number
  participants: SplitParticipant[]
  items: SplitItem[]
  /** ID transaksi yang dibuat dari bagian "Saya" */
  transactionId?: number
  createdAt: number
  updatedAt: number
}

export interface Note {
  id?: number
  title: string
  content: string
  pinned: boolean
  updatedAt: number
}

export interface Budget {
  /** Satu anggaran bulanan per kategori pengeluaran */
  categoryId: number
  amount: number
}

class WahduidDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  categories!: EntityTable<Category, 'id'>
  splitBills!: EntityTable<SplitBill, 'id'>
  notes!: EntityTable<Note, 'id'>
  budgets!: EntityTable<Budget, 'categoryId'>

  constructor() {
    super('wahduid')
    this.version(1).stores({
      transactions: '++id, type, categoryId, date',
      categories: '++id, type, builtin',
    })
    this.version(2).stores({
      splitBills: '++id, date',
      notes: '++id, updatedAt',
      budgets: 'categoryId',
    })
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
    })
  }
}

export const DEFAULT_CATEGORIES: Category[] = [
  { name: '', builtin: 'food', type: 'expense', icon: '🍜', color: '#f97316' },
  { name: '', builtin: 'transport', type: 'expense', icon: '🛵', color: '#3b82f6' },
  { name: '', builtin: 'shopping', type: 'expense', icon: '🛍️', color: '#ec4899' },
  { name: '', builtin: 'bills', type: 'expense', icon: '🧾', color: '#eab308' },
  { name: '', builtin: 'entertainment', type: 'expense', icon: '🎮', color: '#8b5cf6' },
  { name: '', builtin: 'health', type: 'expense', icon: '💊', color: '#ef4444' },
  { name: '', builtin: 'education', type: 'expense', icon: '📚', color: '#14b8a6' },
  { name: '', builtin: 'otherExpense', type: 'expense', icon: '📦', color: '#64748b' },
  { name: '', builtin: 'salary', type: 'income', icon: '💼', color: '#16a34a' },
  { name: '', builtin: 'sales', type: 'income', icon: '🏷️', color: '#22c55e' },
  { name: '', builtin: 'gift', type: 'income', icon: '🎁', color: '#84cc16' },
  { name: '', builtin: 'otherIncome', type: 'income', icon: '💰', color: '#10b981' },
]

export const db = new WahduidDB()

/** Data backup format (export/import JSON). v1 hanya berisi kategori & transaksi. */
export interface BackupFile {
  app: 'wahduid'
  version: 1 | 2
  exportedAt: string
  categories: Category[]
  transactions: Transaction[]
  splitBills?: SplitBill[]
  notes?: Note[]
  budgets?: Budget[]
}

export async function exportBackup(): Promise<BackupFile> {
  const [categories, transactions, splitBills, notes, budgets] = await Promise.all([
    db.categories.toArray(),
    db.transactions.toArray(),
    db.splitBills.toArray(),
    db.notes.toArray(),
    db.budgets.toArray(),
  ])
  return {
    app: 'wahduid',
    version: 2,
    exportedAt: new Date().toISOString(),
    categories,
    transactions,
    splitBills,
    notes,
    budgets,
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optArray = (v: unknown) => v === undefined || Array.isArray(v)

function isValidBackup(data: unknown): data is BackupFile {
  if (!data || typeof data !== 'object') return false
  const d = data as Partial<BackupFile>
  return (
    d.app === 'wahduid' &&
    Array.isArray(d.categories) &&
    Array.isArray(d.transactions) &&
    optArray(d.splitBills) &&
    optArray(d.notes) &&
    optArray(d.budgets) &&
    d.transactions.every(
      (t) =>
        t &&
        (t.type === 'income' || t.type === 'expense') &&
        isNum(t.amount) &&
        isNum(t.categoryId) &&
        isNum(t.date),
    ) &&
    d.categories.every((c) => c && (c.type === 'income' || c.type === 'expense') && typeof c.icon === 'string') &&
    (d.splitBills ?? []).every(
      (b) => b && typeof b.title === 'string' && Array.isArray(b.participants) && Array.isArray(b.items),
    ) &&
    (d.notes ?? []).every((n) => n && typeof n.title === 'string' && typeof n.content === 'string') &&
    (d.budgets ?? []).every((b) => b && isNum(b.categoryId) && isNum(b.amount))
  )
}

const allTables = () => [db.categories, db.transactions, db.splitBills, db.notes, db.budgets]

/** Mengganti seluruh data dengan isi backup. Melempar error jika format tidak valid. */
export async function importBackup(data: unknown): Promise<void> {
  if (!isValidBackup(data)) throw new Error('invalid-backup')
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()))
    await db.categories.bulkAdd(data.categories)
    await db.transactions.bulkAdd(
      data.transactions.map((t) => ({ ...t, note: typeof t.note === 'string' ? t.note : '' })),
    )
    await db.splitBills.bulkAdd(data.splitBills ?? [])
    await db.notes.bulkAdd((data.notes ?? []).map((n) => ({ ...n, pinned: !!n.pinned })))
    await db.budgets.bulkAdd(data.budgets ?? [])
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()))
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
  })
}
