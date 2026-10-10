import Dexie from 'dexie'
import { db, ensureDefaults, getMeta, newId, purgeTombstones, setMeta, TABLES, tbl } from './db'
import { convertLegacy, type LegacyData } from './legacy'

/** Nama database format lama (ID angka) */
export const LEGACY_DB_NAME = 'wahduid'
const SETTINGS_KEY = 'wahduid.settings'

/**
 * Pindahkan data dari database lama (`wahduid`, ID angka) ke database baru (`wahduid_data`, ID string).
 * Berjalan sekali; database lama dihapus setelah data berhasil disalin dan jumlahnya cocok.
 * Mengembalikan jumlah record yang dipindahkan.
 */
export async function migrateLegacyDb(): Promise<number> {
  if (await getMeta('legacyMigrated')) return 0
  if (!(await Dexie.exists(LEGACY_DB_NAME))) {
    await setMeta('legacyMigrated', Date.now())
    return 0
  }

  // Mode dinamis: buka versi apa pun yang ada tanpa mendeklarasikan skema
  const old = new Dexie(LEGACY_DB_NAME)
  let data: LegacyData = {}
  try {
    await old.open()
    const names = new Set(old.tables.map((t) => t.name))
    const read = async (name: string) => (names.has(name) ? old.table(name).toArray() : [])
    data = {
      categories: await read('categories'),
      transactions: await read('transactions'),
      wallets: await read('wallets'),
      splitBills: await read('splitBills'),
      notes: await read('notes'),
      budgets: await read('budgets'),
      recurring: await read('recurring'),
      debts: await read('debts'),
    }
  } finally {
    old.close()
  }

  // Awalan acak per perangkat: data lama dari dua HP berbeda tidak akan bentrok ID-nya.
  // Disimpan agar bila migrasi diulang (mis. gagal di tengah) ID yang dihasilkan tetap sama.
  let prefix = await getMeta<string>('legacyPrefix')
  if (!prefix) {
    prefix = newId().slice(0, 6)
    await setMeta('legacyPrefix', prefix)
  }
  const { tables, categoryIds, walletIds } = convertLegacy(data, prefix)
  let count = 0
  await db.transaction('rw', TABLES.map((t) => tbl(t)), async () => {
    for (const t of TABLES) {
      const rows = tables[t] as never[]
      await tbl(t).bulkPut(rows)
      count += rows.length
    }
  })

  // Verifikasi sebelum menghapus database lama
  const copied = await db.transactions.count()
  if (copied < tables.transactions.length) throw new Error('legacy-migration-mismatch')

  remapSettings(categoryIds, walletIds)
  await setMeta('legacyMigrated', Date.now())
  await Dexie.delete(LEGACY_DB_NAME)
  return count
}

/** Perbarui kategori/dompet terakhir di pengaturan (dulu angka, sekarang string) */
function remapSettings(categoryIds: Map<number, string>, walletIds: Map<number, string>) {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return
    const s = JSON.parse(raw)
    const lc = s.lastCategory ?? {}
    s.lastCategory = {
      income: typeof lc.income === 'number' ? categoryIds.get(lc.income) : lc.income,
      expense: typeof lc.expense === 'number' ? categoryIds.get(lc.expense) : lc.expense,
    }
    if (typeof s.lastWallet === 'number') s.lastWallet = walletIds.get(s.lastWallet)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // pengaturan rusak tidak menghalangi migrasi
  }
}

/**
 * Siapkan database sebelum aplikasi dirender: migrasi data lama, pastikan data bawaan ada,
 * dan bersihkan nisan yang sudah kedaluwarsa.
 */
export async function prepareDatabase() {
  try {
    await migrateLegacyDb()
  } catch (e) {
    // Database lama TIDAK dihapus bila gagal, sehingga bisa dicoba lagi saat aplikasi dibuka berikutnya
    console.error('Legacy migration failed', e)
  }
  await ensureDefaults()
  purgeTombstones().catch(() => {})
}
