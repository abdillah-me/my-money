import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  builtinCategoryId,
  CASH_WALLET_ID,
  db,
  ensureDefaults,
  getAlive,
  insert,
  patch,
  purgeTombstones,
  recurringTxId,
  remove,
  TABLES,
  tbl,
  type Transaction,
} from './db'
import { decryptBackup, encryptBackup, exportBackup, importBackup, parseBackup, type BackupV4 } from './backup'
import { convertLegacy } from './legacy'
import { LEGACY_DB_NAME, migrateLegacyDb } from './migrate'
import { occurrence, runRecurring } from '@/lib/recurring'

const FOOD = builtinCategoryId('food')
const SALARY = builtinCategoryId('salary')

/** Kosongkan database = "perangkat baru" */
async function freshDevice() {
  await db.transaction('rw', [...TABLES.map((t) => tbl(t)), db.meta], async () => {
    for (const t of TABLES) await tbl(t).clear()
    await db.meta.clear()
  })
  await ensureDefaults()
}

const tx = (id: string, data: Partial<Transaction> = {}): Transaction => ({
  id,
  updatedAt: 100,
  type: 'expense',
  amount: 10_000,
  categoryId: FOOD,
  walletId: CASH_WALLET_ID,
  date: Date.UTC(2026, 9, 1),
  ...data,
})

/** Ekspor lalu parse ulang (seperti menyimpan ke file & membukanya kembali) */
async function roundTrip() {
  const parsed = parseBackup(JSON.stringify(await exportBackup()))
  if (parsed.kind === 'encrypted') throw new Error('unexpected')
  return parsed
}

const alive = async () => (await db.transactions.toArray()).filter((t) => !t.deletedAt)

beforeEach(freshDevice)

describe('merge import', () => {
  it('menggabungkan data dua perangkat tanpa duplikat, versi terbaru menang, hapus ikut tersebar', async () => {
    // Kondisi awal yang sama di kedua perangkat
    await db.transactions.bulkPut([tx('t1', { amount: 1000 }), tx('t2'), tx('t3')])
    const common = await roundTrip()

    // Perangkat A: ubah t1 (lebih baru), hapus t3
    await db.transactions.put(tx('t1', { amount: 5000, updatedAt: 200 }))
    await db.transactions.put({ id: 't3', updatedAt: 200, deletedAt: 200 } as Transaction)
    const fromA = await roundTrip()

    // Perangkat B: mulai dari kondisi awal, tambah t4
    await freshDevice()
    await importBackup(common, 'replace')
    await db.transactions.put(tx('t4', { updatedAt: 150 }))

    const r = await importBackup(fromA, 'merge')
    const ids = (await alive()).map((t) => t.id).sort()
    expect(ids).toEqual(['t1', 't2', 't4'])
    expect((await db.transactions.get('t1'))!.amount).toBe(5000)
    // t3 tersimpan sebagai nisan tanpa isi
    expect(await db.transactions.get('t3')).toEqual({ id: 't3', updatedAt: 200, deletedAt: 200 })
    expect(r.updated).toBeGreaterThanOrEqual(2)

    // Import ulang file yang sama tidak mengubah apa pun
    const again = await importBackup(fromA, 'merge')
    expect(again.added).toBe(0)
    expect(again.updated).toBe(0)
  })

  it('data lama di file tidak menimpa editan yang lebih baru di perangkat', async () => {
    await db.transactions.put(tx('t1', { amount: 1000, updatedAt: 100 }))
    const old = await roundTrip()
    await db.transactions.put(tx('t1', { amount: 9999, updatedAt: 500 }))

    const r = await importBackup(old, 'merge')
    expect((await db.transactions.get('t1'))!.amount).toBe(9999)
    expect(r.skipped).toBeGreaterThan(0)
  })

  it('record tidak valid di file diabaikan', async () => {
    const file: BackupV4 = {
      app: 'wahduid',
      version: 4,
      exportedAt: '',
      tables: { transactions: [tx('ok'), { id: 'bad', updatedAt: 1, amount: 'x' } as never, { id: '', updatedAt: 1 } as never] },
    }
    await importBackup({ kind: 'v4', data: file }, 'merge')
    expect((await alive()).map((t) => t.id)).toEqual(['ok'])
  })
})

describe('soft delete', () => {
  it('remove() menyisakan nisan minimal dan getAlive tidak mengembalikannya', async () => {
    const id = await insert('transactions', { type: 'expense', amount: 5, categoryId: FOOD, walletId: CASH_WALLET_ID, date: 1, note: 'x' })
    await remove('transactions', id)
    const raw = await db.transactions.get(id)
    expect(Object.keys(raw!).sort()).toEqual(['deletedAt', 'id', 'updatedAt'])
    expect(await getAlive('transactions', id)).toBeUndefined()
  })

  it('nisan lebih dari 180 hari dibersihkan, yang baru tetap', async () => {
    const now = Date.now()
    const day = 86_400_000
    await db.transactions.bulkPut([
      { id: 'old', updatedAt: now - 200 * day, deletedAt: now - 200 * day } as Transaction,
      { id: 'recent', updatedAt: now - day, deletedAt: now - day } as Transaction,
    ])
    await purgeTombstones(now)
    expect(await db.transactions.get('old')).toBeUndefined()
    expect(await db.transactions.get('recent')).toBeDefined()
  })

  it('field kosong tidak disimpan (hemat ruang)', async () => {
    const id = await insert('transactions', { type: 'expense', amount: 0, categoryId: FOOD, walletId: CASH_WALLET_ID, date: 1, note: '' }, { keep: ['amount'] })
    const raw = await db.transactions.get(id)
    expect(raw).not.toHaveProperty('note')
    expect(raw!.amount).toBe(0)
    await patch('transactions', id, { note: 'a' })
    await patch('transactions', id, { note: '' })
    expect(await db.transactions.get(id)).not.toHaveProperty('note')
  })
})

describe('transaksi berulang', () => {
  const ruleStart = () => {
    const d = new Date()
    // Jam 00:00 agar kejadian bulan ini pasti sudah jatuh tempo kapan pun tes dijalankan
    return new Date(d.getFullYear(), d.getMonth() - 3, Math.min(d.getDate(), 28), 0, 0).getTime()
  }

  it('idempoten dan tidak menghidupkan lagi transaksi yang sudah dihapus', async () => {
    const start = ruleStart()
    const ruleId = await insert('recurring', { type: 'income', amount: 100, categoryId: SALARY, walletId: CASH_WALLET_ID, freq: 'monthly', start, n: 0 }, { keep: ['n'] })

    const first = await runRecurring()
    expect(first).toBe(4) // bulan -3, -2, -1, dan bulan ini
    expect(await runRecurring()).toBe(0)

    // Hapus kejadian ke-1, lalu "perangkat lain" mengembalikan n ke 0 (mis. lewat merge)
    await remove('transactions', recurringTxId(ruleId, 1))
    await db.recurring.update(ruleId, { n: 0 })
    expect(await runRecurring()).toBe(0)
    expect(await getAlive('transactions', recurringTxId(ruleId, 1))).toBeUndefined()
    expect((await alive()).length).toBe(3)
  })

  it('aturan yang sama di dua perangkat menghasilkan ID sama -> tidak dobel saat digabung', async () => {
    const start = ruleStart()
    const ruleId = await insert('recurring', { type: 'income', amount: 100, categoryId: SALARY, walletId: CASH_WALLET_ID, freq: 'monthly', start, n: 0 }, { keep: ['n'] })
    const withRuleOnly = await roundTrip()
    await runRecurring()
    const fromA = await roundTrip()

    await freshDevice()
    await importBackup(withRuleOnly, 'replace')
    await runRecurring() // perangkat B juga membuat transaksi dari aturan yang sama
    await importBackup(fromA, 'merge')

    const txs = (await alive()).filter((t) => t.recurringId === ruleId)
    expect(txs.length).toBe(4)
    expect(new Set(txs.map((t) => t.id)).size).toBe(4)
  })

  it('tanggal 31 tetap kembali ke 31 setelah Februari', () => {
    const start = new Date(2026, 0, 31, 9).getTime()
    expect(new Date(occurrence(start, 'monthly', 1)).getDate()).toBe(28)
    expect(new Date(occurrence(start, 'monthly', 2)).getDate()).toBe(31)
  })
})

describe('data format lama (ID angka)', () => {
  const legacyV3 = {
    app: 'wahduid',
    version: 3,
    exportedAt: '2026-10-01T00:00:00.000Z',
    categories: [
      { id: 1, name: '', builtin: 'food', type: 'expense', icon: '🍜', color: '#f97316' },
      { id: 9, name: '', builtin: 'salary', type: 'income', icon: '💼', color: '#16a34a' },
      { id: 13, name: 'Kopi', type: 'expense', icon: '☕', color: '#16a34a' },
    ],
    wallets: [
      { id: 1, name: '', builtin: 'cash', icon: '💵', color: '#16a34a', initial: 0 },
      { id: 2, name: 'BCA', icon: '🏦', color: '#3b82f6', initial: 2_000_000 },
    ],
    recurring: [{ id: 1, type: 'income', amount: 5_000_000, categoryId: 9, walletId: 1, freq: 'monthly', start: new Date(2026, 6, 25, 9).getTime(), n: 2 }],
    transactions: [
      { id: 1, type: 'expense', amount: 25_000, categoryId: 13, walletId: 2, date: 1, note: 'Kopi susu' },
      { id: 2, type: 'transfer', amount: 100_000, categoryId: 0, walletId: 1, toWalletId: 2, date: 2 },
      { id: 3, type: 'income', amount: 5_000_000, categoryId: 9, walletId: 1, date: new Date(2026, 7, 25, 9).getTime(), recurringId: 1 },
    ],
    splitBills: [{ id: 1, title: 'Makan', date: 3, mode: 'equal', total: 90_000, taxPct: 0, servicePct: 0, participants: [{ id: 'a', name: 'Saya', isMe: true }], items: [], transactionId: 1, createdAt: 1, updatedAt: 1 }],
    budgets: [{ categoryId: 13, amount: 300_000 }],
    notes: [],
    debts: [],
  }

  it('relasi dipetakan dengan benar ke ID baru', () => {
    const { tables } = convertLegacy(legacyV3, 'x')
    const kopi = tables.categories.find((c) => c.name === 'Kopi')!
    const bca = tables.wallets.find((w) => w.name === 'BCA')!
    expect(tables.categories.find((c) => c.builtin === 'food')!.id).toBe(FOOD)
    expect(tables.wallets.find((w) => w.builtin === 'cash')!.id).toBe(CASH_WALLET_ID)

    const [coffee, transfer, salary] = tables.transactions
    expect(coffee.categoryId).toBe(kopi.id)
    expect(coffee.walletId).toBe(bca.id)
    expect(transfer.categoryId).toBeUndefined()
    expect(transfer.toWalletId).toBe(bca.id)
    // Transaksi hasil aturan berulang mendapat ID tetap (kejadian ke-1)
    expect(salary.id).toBe(recurringTxId(tables.recurring[0].id, 1))
    expect(tables.splitBills[0].transactionId).toBe(coffee.id)
    expect(tables.budgets[0].id).toBe(kopi.id)
  })

  it('import file lama dua kali tidak membuat duplikat', async () => {
    const parsed = parseBackup(JSON.stringify(legacyV3))
    expect(parsed.kind).toBe('legacy')
    if (parsed.kind === 'encrypted') return
    await importBackup(parsed, 'merge')
    await importBackup(parsed, 'merge')
    expect((await alive()).length).toBe(3)
    expect((await db.categories.toArray()).filter((c) => c.name === 'Kopi').length).toBe(1)
  })

  it('migrasi database lama memindahkan data, memetakan pengaturan, dan menghapus database lama', async () => {
    const old = new Dexie(LEGACY_DB_NAME)
    old.version(3).stores({ transactions: '++id, categoryId, date', categories: '++id, type, builtin', wallets: '++id', recurring: '++id', debts: '++id', splitBills: '++id, date', notes: '++id, updatedAt', budgets: 'categoryId' })
    await old.open()
    await old.table('categories').bulkAdd(legacyV3.categories)
    await old.table('wallets').bulkAdd(legacyV3.wallets)
    await old.table('transactions').bulkAdd(legacyV3.transactions)
    await old.table('budgets').bulkAdd(legacyV3.budgets)
    old.close()
    localStorage.setItem('wahduid.settings', JSON.stringify({ lastCategory: { expense: 13 }, lastWallet: 2 }))

    const moved = await migrateLegacyDb()
    expect(moved).toBeGreaterThan(0)
    expect((await alive()).length).toBe(3)
    expect(await Dexie.exists(LEGACY_DB_NAME)).toBe(false)

    const s = JSON.parse(localStorage.getItem('wahduid.settings')!)
    const kopi = (await db.categories.toArray()).find((c) => c.name === 'Kopi')!
    expect(s.lastCategory.expense).toBe(kopi.id)
    expect(typeof s.lastWallet).toBe('string')

    // Berjalan sekali saja
    expect(await migrateLegacyDb()).toBe(0)
  })
})

describe('enkripsi backup', () => {
  it('bisa dibuka dengan kata sandi yang benar dan menolak kata sandi salah', async () => {
    await db.transactions.put(tx('secret', { note: 'gaji rahasia' }))
    const json = JSON.stringify(await exportBackup())
    const enc = await encryptBackup(json, 'kata-sandi-ku')

    expect(JSON.stringify(enc)).not.toContain('gaji rahasia')
    expect(parseBackup(JSON.stringify(enc)).kind).toBe('encrypted')
    expect(await decryptBackup(enc, 'kata-sandi-ku')).toBe(json)
    await expect(decryptBackup(enc, 'salah')).rejects.toThrow('wrong-password')
  })
})
