import Dexie, { type EntityTable } from 'dexie'

/*
 * Catatan efisiensi penyimpanan (semua data lokal di IndexedDB):
 * - Hanya data mentah yang disimpan. Saldo, ringkasan, dan hutang dihitung saat dibaca (tidak ada data turunan/duplikat).
 * - Field opsional tidak ditulis bila kosong (lihat `compact`), karena IndexedDB menyimpan nama properti di tiap record.
 * - Index dibuat seminimal mungkin; tiap index menambah ukuran dan biaya tulis.
 * - Transfer disimpan sebagai satu record (bukan dua), transaksi berulang hanya dibuat saat jatuh tempo.
 */

export type CategoryType = 'income' | 'expense'
export type TxType = CategoryType | 'transfer'

export interface Category {
  id?: number
  /** Nama untuk kategori buatan user. Kategori bawaan memakai `builtin` sebagai kunci terjemahan. */
  name: string
  builtin?: string
  type: CategoryType
  icon: string
  color: string
}

export interface Wallet {
  id?: number
  name: string
  /** Kunci terjemahan untuk dompet bawaan */
  builtin?: string
  icon: string
  color: string
  /** Saldo awal saat dompet dibuat */
  initial: number
  /** Disimpan hanya bila true */
  archived?: boolean
}

export interface Transaction {
  id?: number
  type: TxType
  amount: number
  /** 0 untuk transfer */
  categoryId: number
  walletId: number
  /** Dompet tujuan (khusus transfer) */
  toWalletId?: number
  /** Epoch milliseconds */
  date: number
  note?: string
  /** Asal transaksi berulang */
  recurringId?: number
  /** @deprecated tidak lagi ditulis (v3) — tetap dibaca dari data lama */
  createdAt?: number
}

export interface SplitParticipant {
  id: string
  name: string
  /** Peserta yang mewakili pengguna aplikasi */
  isMe?: boolean
  /** Sudah melunasi bagiannya ke pembayar (disimpan hanya bila true) */
  paid?: boolean
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
  /** Peserta yang membayar tagihan. Kosong = "saya". */
  payerId?: string
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

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurringRule {
  id?: number
  type: CategoryType
  amount: number
  categoryId: number
  walletId: number
  note?: string
  freq: Frequency
  /** Tanggal kejadian pertama (epoch ms) — jadi patokan agar tanggal tidak bergeser (mis. tgl 31) */
  start: number
  /** Indeks kejadian berikutnya yang belum dibuat (0 = start) */
  n: number
  /** Disimpan hanya bila dijeda */
  paused?: boolean
}

export interface Debt {
  id?: number
  person: string
  amount: number
  /** lent = saya meminjamkan (orang lain berhutang ke saya), borrowed = saya berhutang */
  dir: 'lent' | 'borrowed'
  date: number
  note?: string
  /** Disimpan hanya bila sudah lunas */
  paid?: boolean
}

class WahduidDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  categories!: EntityTable<Category, 'id'>
  wallets!: EntityTable<Wallet, 'id'>
  splitBills!: EntityTable<SplitBill, 'id'>
  notes!: EntityTable<Note, 'id'>
  budgets!: EntityTable<Budget, 'categoryId'>
  recurring!: EntityTable<RecurringRule, 'id'>
  debts!: EntityTable<Debt, 'id'>

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
    // v3: dompet, transaksi berulang, hutang. Index `type` dihapus (tidak pernah di-query lewat index).
    this.version(3)
      .stores({
        transactions: '++id, categoryId, date',
        wallets: '++id',
        recurring: '++id',
        debts: '++id',
      })
      .upgrade(async (tx) => {
        const walletId = (await tx.table('wallets').add(DEFAULT_WALLET)) as number
        await tx
          .table('transactions')
          .toCollection()
          .modify((t: Transaction) => {
            t.walletId = walletId
            delete t.createdAt
            if (!t.note) delete t.note
          })
      })
    this.on('populate', async (tx) => {
      await tx.table('categories').bulkAdd(DEFAULT_CATEGORIES)
      await tx.table('wallets').add(DEFAULT_WALLET)
    })
  }
}

export const DEFAULT_WALLET: Wallet = { name: '', builtin: 'cash', icon: '💵', color: '#16a34a', initial: 0 }

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

/**
 * Buang field opsional yang kosong (undefined, null, '', false) sebelum disimpan.
 * Field wajib yang bernilai falsy (mis. amount 0) tetap dipertahankan lewat `keep`.
 */
export function compact<T extends object>(obj: T, keep: (keyof T)[] = []): T {
  const out = {} as T
  for (const [k, v] of Object.entries(obj) as [keyof T, unknown][]) {
    if (keep.includes(k) || (v !== undefined && v !== null && v !== '' && v !== false)) out[k] = v as T[keyof T]
  }
  return out
}

/** Untuk `table.update()`: field kosong diset `undefined` agar Dexie menghapus properti lamanya */
export function compactPatch<T extends object>(obj: T): T {
  const out = { ...obj }
  for (const k of Object.keys(out) as (keyof T)[]) {
    const v = out[k] as unknown
    if (v === null || v === '' || v === false) out[k] = undefined as T[keyof T]
  }
  return out
}

/** Data backup format (export/import JSON). v1 hanya kategori & transaksi, v2 + split/catatan/anggaran. */
export interface BackupFile {
  app: 'wahduid'
  version: 1 | 2 | 3
  exportedAt: string
  categories: Category[]
  transactions: Transaction[]
  wallets?: Wallet[]
  splitBills?: SplitBill[]
  notes?: Note[]
  budgets?: Budget[]
  recurring?: RecurringRule[]
  debts?: Debt[]
}

const allTables = () => [db.categories, db.transactions, db.wallets, db.splitBills, db.notes, db.budgets, db.recurring, db.debts]

export async function exportBackup(): Promise<BackupFile> {
  const [categories, transactions, wallets, splitBills, notes, budgets, recurring, debts] = await Promise.all(
    allTables().map((t) => t.toArray()),
  )
  return {
    app: 'wahduid',
    version: 3,
    exportedAt: new Date().toISOString(),
    categories: categories as Category[],
    transactions: transactions as Transaction[],
    wallets: wallets as Wallet[],
    splitBills: splitBills as SplitBill[],
    notes: notes as Note[],
    budgets: budgets as Budget[],
    recurring: recurring as RecurringRule[],
    debts: debts as Debt[],
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const optArray = (v: unknown) => v === undefined || Array.isArray(v)
const isCatType = (v: unknown) => v === 'income' || v === 'expense'

function isValidBackup(data: unknown): data is BackupFile {
  if (!data || typeof data !== 'object') return false
  const d = data as Partial<BackupFile>
  return (
    d.app === 'wahduid' &&
    Array.isArray(d.categories) &&
    Array.isArray(d.transactions) &&
    [d.wallets, d.splitBills, d.notes, d.budgets, d.recurring, d.debts].every(optArray) &&
    d.transactions.every(
      (t) => t && (isCatType(t.type) || t.type === 'transfer') && isNum(t.amount) && isNum(t.categoryId) && isNum(t.date),
    ) &&
    d.categories.every((c) => c && isCatType(c.type) && typeof c.icon === 'string') &&
    (d.wallets ?? []).every((w) => w && typeof w.name === 'string' && isNum(w.initial)) &&
    (d.splitBills ?? []).every((b) => b && typeof b.title === 'string' && Array.isArray(b.participants) && Array.isArray(b.items)) &&
    (d.notes ?? []).every((n) => n && typeof n.title === 'string' && typeof n.content === 'string') &&
    (d.budgets ?? []).every((b) => b && isNum(b.categoryId) && isNum(b.amount)) &&
    (d.recurring ?? []).every((r) => r && isCatType(r.type) && isNum(r.amount) && isNum(r.start) && isNum(r.n)) &&
    (d.debts ?? []).every((x) => x && typeof x.person === 'string' && isNum(x.amount) && (x.dir === 'lent' || x.dir === 'borrowed'))
  )
}

/** Mengganti seluruh data dengan isi backup. Melempar error jika format tidak valid. */
export async function importBackup(data: unknown): Promise<void> {
  if (!isValidBackup(data)) throw new Error('invalid-backup')
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()))
    await db.categories.bulkAdd(data.categories)

    // Backup lama (v1/v2) belum punya dompet: buat dompet default lalu kaitkan semua transaksi
    let fallbackWallet: number | undefined
    if (data.wallets?.length) await db.wallets.bulkAdd(data.wallets)
    else fallbackWallet = (await db.wallets.add(DEFAULT_WALLET)) as number
    const firstWallet = fallbackWallet ?? data.wallets![0].id ?? 1

    await db.transactions.bulkAdd(
      data.transactions.map((t) => {
        const { createdAt: _c, ...rest } = t
        return compact({ ...rest, walletId: isNum(t.walletId) ? t.walletId : firstWallet }, ['amount', 'categoryId'])
      }),
    )
    await db.splitBills.bulkAdd(data.splitBills ?? [])
    await db.notes.bulkAdd((data.notes ?? []).map((n) => ({ ...n, pinned: !!n.pinned })))
    await db.budgets.bulkAdd(data.budgets ?? [])
    await db.recurring.bulkAdd(data.recurring ?? [])
    await db.debts.bulkAdd(data.debts ?? [])
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(allTables().map((t) => t.clear()))
    await db.categories.bulkAdd(DEFAULT_CATEGORIES)
    await db.wallets.add(DEFAULT_WALLET)
  })
}
