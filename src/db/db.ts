import Dexie, { type Table } from 'dexie'

/*
 * Skema data v4 — fondasi untuk backup gabungan (merge) & sinkronisasi di masa depan.
 *
 * - Semua record memakai ID string acak (bukan auto-increment) agar data dari beberapa perangkat
 *   bisa digabung tanpa bentrok. Data bawaan memakai ID tetap (mis. `cat:food`, `wallet:cash`).
 * - Setiap record punya `updatedAt` (ms). Saat digabung, versi dengan `updatedAt` terbaru yang dipakai.
 * - Hapus = soft delete: record diganti "nisan" `{ id, updatedAt, deletedAt }` tanpa isi,
 *   supaya penghapusan ikut tersebar saat import dan tetap hemat ruang. Nisan dibersihkan setelah 180 hari.
 *
 * Efisiensi penyimpanan tetap dijaga: saldo/ringkasan/hutang dihitung saat dibaca,
 * field kosong tidak ditulis, index minimal.
 */

export type CategoryType = 'income' | 'expense'
export type TxType = CategoryType | 'transfer'
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

/** Field sinkronisasi yang dimiliki semua record */
export interface Rec {
  id: string
  updatedAt: number
  /** Ada = record sudah dihapus (nisan) */
  deletedAt?: number
}

export interface Category extends Rec {
  /** Nama untuk kategori buatan user. Kategori bawaan memakai `builtin` sebagai kunci terjemahan. */
  name: string
  builtin?: string
  type: CategoryType
  icon: string
  color: string
}

export interface Wallet extends Rec {
  name: string
  builtin?: string
  icon: string
  color: string
  /** Saldo awal saat dompet dibuat */
  initial: number
  archived?: boolean
}

export interface Transaction extends Rec {
  type: TxType
  amount: number
  /** Tidak ada untuk transfer */
  categoryId?: string
  walletId: string
  /** Dompet tujuan (khusus transfer) */
  toWalletId?: string
  /** Epoch ms */
  date: number
  note?: string
  /** Asal transaksi berulang */
  recurringId?: string
}

export interface SplitParticipant {
  id: string
  name: string
  isMe?: boolean
  paid?: boolean
}

export interface SplitItem {
  id: string
  name: string
  price: number
  participantIds: string[]
}

export interface SplitBill extends Rec {
  title: string
  date: number
  mode: 'equal' | 'items'
  total: number
  taxPct: number
  servicePct: number
  participants: SplitParticipant[]
  items: SplitItem[]
  /** Peserta yang membayar tagihan. Kosong = "saya". */
  payerId?: string
  transactionId?: string
  createdAt: number
}

export interface Note extends Rec {
  title: string
  content: string
  pinned: boolean
}

/** Anggaran bulanan; `id` = ID kategori pengeluaran (satu anggaran per kategori) */
export interface Budget extends Rec {
  amount: number
}

export interface RecurringRule extends Rec {
  type: CategoryType
  amount: number
  categoryId: string
  walletId: string
  note?: string
  freq: Frequency
  /** Tanggal kejadian pertama — patokan agar tanggal tidak bergeser (mis. tgl 31) */
  start: number
  /** Indeks kejadian berikutnya yang belum dibuat (0 = start) */
  n: number
  paused?: boolean
}

export interface Debt extends Rec {
  person: string
  amount: number
  /** lent = saya meminjamkan, borrowed = saya berhutang */
  dir: 'lent' | 'borrowed'
  date: number
  note?: string
  paid?: boolean
}

interface MetaRow {
  key: string
  value: unknown
}

export const TABLES = ['categories', 'wallets', 'transactions', 'splitBills', 'notes', 'budgets', 'recurring', 'debts'] as const
export type TableName = (typeof TABLES)[number]

export interface TableTypes {
  categories: Category
  wallets: Wallet
  transactions: Transaction
  splitBills: SplitBill
  notes: Note
  budgets: Budget
  recurring: RecurringRule
  debts: Debt
}

export const DB_NAME = 'wahduid_data'

export class WahduidDB extends Dexie {
  categories!: Table<Category, string>
  wallets!: Table<Wallet, string>
  transactions!: Table<Transaction, string>
  splitBills!: Table<SplitBill, string>
  notes!: Table<Note, string>
  budgets!: Table<Budget, string>
  recurring!: Table<RecurringRule, string>
  debts!: Table<Debt, string>
  meta!: Table<MetaRow, string>

  constructor(name = DB_NAME) {
    super(name)
    // `date` & `categoryId` dipakai untuk query; nisan tidak punya field ini sehingga otomatis
    // tidak ikut terbaca lewat index. `updatedAt` disiapkan untuk sinkronisasi "perubahan sejak X".
    this.version(1).stores({
      categories: 'id',
      wallets: 'id',
      transactions: 'id, date, categoryId, updatedAt',
      splitBills: 'id, date',
      notes: 'id, updatedAt',
      budgets: 'id',
      recurring: 'id',
      debts: 'id',
      meta: 'key',
    })
    this.on('populate', (tx) => {
      tx.table('categories').bulkAdd(defaultCategories())
      tx.table('wallets').add(defaultWallet())
    })
  }
}

export const db = new WahduidDB()

/** Akses tabel bertipe berdasarkan nama */
export function tbl<K extends TableName>(name: K): Table<TableTypes[K], string> {
  return db.table(name) as Table<TableTypes[K], string>
}

// ---------------------------------------------------------------------------
// ID & data bawaan
// ---------------------------------------------------------------------------

/** ID acak 128-bit, 22 karakter base64url (lebih ringkas dari UUID 36 karakter) */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** ID tetap untuk kategori bawaan agar sama di semua perangkat */
export const builtinCategoryId = (builtin: string) => `cat:${builtin}`
export const CASH_WALLET_ID = 'wallet:cash'
/** ID transaksi hasil aturan berulang: sama di semua perangkat, sehingga tidak dobel saat digabung */
export const recurringTxId = (ruleId: string, n: number) => `r.${ruleId}.${n}`

const BUILTIN_CATEGORIES: Omit<Category, 'id' | 'updatedAt' | 'name'>[] = [
  { builtin: 'food', type: 'expense', icon: '🍜', color: '#f97316' },
  { builtin: 'transport', type: 'expense', icon: '🛵', color: '#3b82f6' },
  { builtin: 'shopping', type: 'expense', icon: '🛍️', color: '#ec4899' },
  { builtin: 'bills', type: 'expense', icon: '🧾', color: '#eab308' },
  { builtin: 'entertainment', type: 'expense', icon: '🎮', color: '#8b5cf6' },
  { builtin: 'health', type: 'expense', icon: '💊', color: '#ef4444' },
  { builtin: 'education', type: 'expense', icon: '📚', color: '#14b8a6' },
  { builtin: 'otherExpense', type: 'expense', icon: '📦', color: '#64748b' },
  { builtin: 'salary', type: 'income', icon: '💼', color: '#16a34a' },
  { builtin: 'sales', type: 'income', icon: '🏷️', color: '#22c55e' },
  { builtin: 'gift', type: 'income', icon: '🎁', color: '#84cc16' },
  { builtin: 'otherIncome', type: 'income', icon: '💰', color: '#10b981' },
]

/**
 * updatedAt = 0 untuk data bawaan yang belum pernah diubah, sehingga perubahan user
 * di perangkat mana pun selalu menang saat digabung.
 */
export function defaultCategories(updatedAt = 0): Category[] {
  return BUILTIN_CATEGORIES.map((c) => ({ ...c, id: builtinCategoryId(c.builtin!), name: '', updatedAt }))
}

export function defaultWallet(updatedAt = 0): Wallet {
  return { id: CASH_WALLET_ID, name: '', builtin: 'cash', icon: '💵', color: '#16a34a', initial: 0, updatedAt }
}

// ---------------------------------------------------------------------------
// Helper penyimpanan
// ---------------------------------------------------------------------------

/**
 * Buang field opsional yang kosong (undefined, null, '', false) sebelum disimpan —
 * IndexedDB menyimpan nama properti di setiap record. Field di `keep` selalu dipertahankan.
 */
export function compact<T extends object>(obj: T, keep: (keyof T)[] = []): T {
  const out = {} as T
  for (const [k, v] of Object.entries(obj) as [keyof T, unknown][]) {
    if (keep.includes(k) || (v !== undefined && v !== null && v !== '' && v !== false)) out[k] = v as T[keyof T]
  }
  return out
}

/** Untuk `update()`: nilai kosong jadi `undefined` agar Dexie menghapus properti lamanya */
export function compactPatch<T extends object>(obj: T): T {
  const out = { ...obj }
  for (const k of Object.keys(out) as (keyof T)[]) {
    const v = out[k] as unknown
    if (v === null || v === '' || v === false) out[k] = undefined as T[keyof T]
  }
  return out
}

export const isAlive = <T extends Rec>(r: T | undefined): r is T => !!r && !r.deletedAt

type Data<K extends TableName> = Omit<TableTypes[K], 'id' | 'updatedAt' | 'deletedAt'>

/** Ambil satu record yang belum dihapus */
export async function getAlive<K extends TableName>(name: K, id: string | undefined) {
  if (!id) return undefined
  const r = await tbl(name).get(id)
  return isAlive(r) ? r : undefined
}

/** Semua record yang belum dihapus */
export async function allAlive<K extends TableName>(name: K): Promise<TableTypes[K][]> {
  const list = await tbl(name).toArray()
  return list.filter(isAlive)
}

/** Tambah record baru. `keep` = field wajib yang boleh bernilai falsy (mis. amount 0). */
export async function insert<K extends TableName>(
  name: K,
  data: Data<K>,
  opts: { id?: string; keep?: string[] } = {},
): Promise<string> {
  const id = opts.id ?? newId()
  const record = compact({ ...data, id, updatedAt: Date.now() } as TableTypes[K], opts.keep as (keyof TableTypes[K])[])
  await tbl(name).put(record)
  return id
}

/** Ubah sebagian field + perbarui `updatedAt`. Nilai `undefined` menghapus field tersebut. */
export async function patch<K extends TableName>(name: K, id: string, changes: Partial<Data<K>>) {
  await tbl(name).update(id, { ...compactPatch(changes), updatedAt: Date.now() } as never)
}

/** Soft delete: ganti isi record dengan nisan */
export async function remove(name: TableName, id: string) {
  const now = Date.now()
  await tbl(name).put({ id, updatedAt: now, deletedAt: now } as never)
}

const TOMBSTONE_TTL = 180 * 24 * 60 * 60 * 1000

/** Hapus permanen nisan yang lebih tua dari 180 hari */
export async function purgeTombstones(now = Date.now()) {
  const cutoff = now - TOMBSTONE_TTL
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db
        .table(t)
        .filter((r: Rec) => !!r.deletedAt && r.deletedAt < cutoff)
        .delete()
    }
  })
}

/** Pastikan data bawaan ada (mis. setelah reset atau import "ganti semua") */
export async function ensureDefaults() {
  await db.transaction('rw', db.categories, db.wallets, async () => {
    const cats = defaultCategories()
    const existing = await db.categories.bulkGet(cats.map((c) => c.id))
    await db.categories.bulkAdd(cats.filter((_, i) => !existing[i]))
    const activeWallets = (await db.wallets.toArray()).filter((w) => isAlive(w) && !w.archived)
    if (activeWallets.length === 0) await db.wallets.put(defaultWallet(Date.now()))
  })
}

/** Hapus seluruh data lalu isi ulang data bawaan */
export async function clearAllData() {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) await db.table(t).clear()
  })
  await ensureDefaults()
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}
