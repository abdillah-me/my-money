/*
 * Backup & restore.
 *
 * Format v4: { app, version: 4, exportedAt, tables: { <tabel>: Rec[] } } — termasuk nisan (record terhapus)
 * agar penghapusan ikut terbawa saat digabung di perangkat lain.
 * Format terenkripsi: { app, version: 4, encrypted: true, kdf, iv, data } (AES-GCM 256, kunci dari PBKDF2-SHA256).
 * File lama (v1–v3, ID angka) tetap bisa diimpor lewat konversi di legacy.ts.
 */
import { db, ensureDefaults, TABLES, tbl, type Rec, type TableName } from './db'
import { convertLegacy, shortHash, type LegacyData } from './legacy'

export const BACKUP_VERSION = 4

export interface BackupV4 {
  app: 'wahduid'
  version: 4
  exportedAt: string
  tables: Partial<Record<TableName, Rec[]>>
}

export interface EncryptedBackup {
  app: 'wahduid'
  version: 4
  encrypted: true
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  iv: string
  data: string
}

export type ImportMode = 'merge' | 'replace'

export interface ImportResult {
  added: number
  updated: number
  /** Record di file yang lebih lama / sama dengan yang ada, sehingga tidak dipakai */
  skipped: number
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportBackup(): Promise<BackupV4> {
  const tables: BackupV4['tables'] = {}
  for (const t of TABLES) tables[t] = (await tbl(t).toArray()) as Rec[]
  return { app: 'wahduid', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables }
}

// ---------------------------------------------------------------------------
// Enkripsi (WebCrypto, tanpa library tambahan)
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 250_000
const enc = new TextEncoder()
const dec = new TextDecoder()

const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  // Per potongan agar tidak melebihi batas argumen untuk file besar
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptBackup(json: string, password: string): Promise<EncryptedBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(json))
  return {
    app: 'wahduid',
    version: BACKUP_VERSION,
    encrypted: true,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toB64(salt) },
    iv: toB64(iv),
    data: toB64(cipher),
  }
}

/** Melempar `wrong-password` bila kata sandi salah atau file rusak (AES-GCM memverifikasi integritas) */
export async function decryptBackup(file: EncryptedBackup, password: string): Promise<string> {
  try {
    const key = await deriveKey(password, fromB64(file.kdf.salt), file.kdf.iterations)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) }, key, fromB64(file.data))
    return dec.decode(plain)
  } catch {
    throw new Error('wrong-password')
  }
}

// ---------------------------------------------------------------------------
// Membaca file
// ---------------------------------------------------------------------------

export type ParsedBackup =
  | { kind: 'encrypted'; file: EncryptedBackup }
  | { kind: 'v4'; data: BackupV4 }
  | { kind: 'legacy'; data: LegacyData & { exportedAt?: string } }

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('invalid-backup')
  }
  if (!raw || typeof raw !== 'object' || (raw as { app?: unknown }).app !== 'wahduid') throw new Error('invalid-backup')
  const r = raw as Record<string, unknown>

  if (r.encrypted === true) {
    const kdf = r.kdf as EncryptedBackup['kdf'] | undefined
    if (!kdf || typeof kdf.salt !== 'string' || typeof r.iv !== 'string' || typeof r.data !== 'string') throw new Error('invalid-backup')
    return { kind: 'encrypted', file: r as unknown as EncryptedBackup }
  }
  if (typeof r.version === 'number' && r.version > BACKUP_VERSION) throw new Error('newer-version')
  if (r.version === 4) {
    if (!r.tables || typeof r.tables !== 'object') throw new Error('invalid-backup')
    return { kind: 'v4', data: r as unknown as BackupV4 }
  }
  if (Array.isArray(r.transactions) && Array.isArray(r.categories)) return { kind: 'legacy', data: r as LegacyData }
  throw new Error('invalid-backup')
}

// ---------------------------------------------------------------------------
// Validasi record v4 (file dari luar tidak dipercaya)
// ---------------------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200
const isCatType = (v: unknown) => v === 'income' || v === 'expense'

/* eslint-disable @typescript-eslint/no-explicit-any -- validasi data mentah */
const validators: Record<TableName, (r: any) => boolean> = {
  categories: (r) => isCatType(r.type) && typeof r.icon === 'string',
  wallets: (r) => isNum(r.initial ?? 0),
  transactions: (r) =>
    (isCatType(r.type) || r.type === 'transfer') && isNum(r.amount) && isNum(r.date) && isStr(r.walletId),
  splitBills: (r) => typeof r.title === 'string' && Array.isArray(r.participants) && Array.isArray(r.items),
  notes: (r) => typeof (r.title ?? '') === 'string' && typeof (r.content ?? '') === 'string',
  budgets: (r) => isNum(r.amount),
  recurring: (r) => isCatType(r.type) && isNum(r.amount) && isNum(r.start) && isNum(r.n) && isStr(r.categoryId),
  debts: (r) => typeof r.person === 'string' && isNum(r.amount) && (r.dir === 'lent' || r.dir === 'borrowed'),
}

function validRecord(table: TableName, r: any): r is Rec {
  if (!r || typeof r !== 'object' || !isStr(r.id) || !isNum(r.updatedAt)) return false
  if (r.deletedAt !== undefined) return isNum(r.deletedAt) // nisan cukup id + waktu
  return validators[table](r)
}

/** Nisan dirapikan: hanya id + waktu, isi lain dibuang */
const normalize = (r: Rec): Rec => (r.deletedAt ? { id: r.id, updatedAt: r.updatedAt, deletedAt: r.deletedAt } : r)

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

function toTables(parsed: Exclude<ParsedBackup, { kind: 'encrypted' }>): Record<TableName, Rec[]> {
  if (parsed.kind === 'legacy') {
    // Awalan dari isi file: import ulang file yang sama menghasilkan ID sama -> tidak dobel
    const seed = parsed.data.exportedAt ?? JSON.stringify(parsed.data).slice(0, 2000)
    return convertLegacy(parsed.data, `b${shortHash(seed)}`).tables as unknown as Record<TableName, Rec[]>
  }
  const out = {} as Record<TableName, Rec[]>
  for (const t of TABLES) {
    const list = parsed.data.tables[t]
    out[t] = Array.isArray(list) ? list.filter((r) => validRecord(t, r)).map(normalize) : []
  }
  return out
}

/**
 * Gabungkan (merge) atau ganti semua data dengan isi backup.
 * Merge: per record, versi dengan `updatedAt` terbaru menang; nisan ikut menang bila lebih baru.
 */
export async function importBackup(parsed: Exclude<ParsedBackup, { kind: 'encrypted' }>, mode: ImportMode): Promise<ImportResult> {
  const incoming = toTables(parsed)
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 }

  await db.transaction('rw', TABLES.map((t) => tbl(t)), async () => {
    for (const t of TABLES) {
      const table = tbl(t)
      const rows = incoming[t]
      if (mode === 'replace') {
        await table.clear()
        await table.bulkPut(rows as never[])
        result.added += rows.length
        continue
      }
      const existing = (await table.bulkGet(rows.map((r) => r.id))) as (Rec | undefined)[]
      const toPut: Rec[] = []
      rows.forEach((r, i) => {
        const cur = existing[i]
        if (!cur) {
          toPut.push(r)
          result.added++
        } else if (r.updatedAt > cur.updatedAt) {
          toPut.push(r)
          result.updated++
        } else {
          result.skipped++
        }
      })
      if (toPut.length) await table.bulkPut(toPut as never[])
    }
  })
  await ensureDefaults()
  return result
}
