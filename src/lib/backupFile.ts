import { encryptBackup, exportBackup } from '@/db/backup'
import { toDateInput } from '@/lib/format'

export type DeliverResult = 'shared' | 'downloaded' | 'cancelled'

/** Buat file backup (JSON biasa atau terenkripsi bila kata sandi diisi) */
export async function createBackupFile(password?: string): Promise<File> {
  const data = await exportBackup()
  const json = JSON.stringify(data)
  const body = password ? JSON.stringify(await encryptBackup(json, password)) : json
  const name = `wahduid-backup-${toDateInput(Date.now())}${password ? '-enc' : ''}.json`
  return new File([body], name, { type: 'application/json' })
}

/**
 * Kirim file lewat lembar Bagikan bawaan HP (Drive, WhatsApp, email, Files) bila didukung,
 * selain itu unduh biasa. `cancelled` = pengguna menutup lembar Bagikan.
 */
export async function deliverFile(file: File): Promise<DeliverResult> {
  const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  if (canShareFiles) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled'
      // Gagal karena alasan lain (mis. izin) -> jatuh ke unduhan biasa
    }
  }
  downloadFile(file)
  return 'downloaded'
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  // Beri jeda sebelum mencabut URL agar unduhan di Safari sempat dimulai
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Jumlah hari sejak backup terakhir; undefined bila belum pernah */
export function daysSince(ts?: number, now = Date.now()) {
  if (!ts) return undefined
  return Math.floor((now - ts) / 86_400_000)
}

/** Ambang pengingat backup */
export const BACKUP_REMIND_DAYS = 7
