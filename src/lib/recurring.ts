import { compact, db, isAlive, recurringTxId, type Frequency, type RecurringRule, type Transaction } from '@/db/db'

/** Batas pembuatan per aturan dalam satu kali jalan (mis. aturan harian yang lama tidak dibuka) */
const MAX_PER_RUN = 400

/**
 * Tanggal kejadian ke-n dihitung dari tanggal awal, bukan dari kejadian sebelumnya,
 * sehingga aturan "tiap tgl 31" tetap kembali ke tgl 31 setelah Februari.
 */
export function occurrence(start: number, freq: Frequency, n: number): number {
  const d = new Date(start)
  if (freq === 'daily') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes()).getTime()
  if (freq === 'weekly') return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n * 7, d.getHours(), d.getMinutes()).getTime()

  const months = freq === 'monthly' ? n : n * 12
  const y = d.getFullYear()
  const m = d.getMonth() + months
  // Jepit tanggal ke hari terakhir bulan tujuan (31 Jan -> 28/29 Feb)
  const lastDay = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(d.getDate(), lastDay), d.getHours(), d.getMinutes()).getTime()
}

export function nextDue(rule: Pick<RecurringRule, 'start' | 'freq' | 'n'>) {
  return occurrence(rule.start, rule.freq, rule.n)
}

/**
 * Buat transaksi untuk semua kejadian yang sudah jatuh tempo (<= sekarang).
 * Hanya dijalankan saat aplikasi dibuka: tidak ada transaksi masa depan yang disimpan.
 * Mengembalikan jumlah transaksi yang dibuat.
 */
export async function runRecurring(now = Date.now()): Promise<number> {
  let created = 0
  await db.transaction('rw', db.recurring, db.transactions, async () => {
    const rules = (await db.recurring.toArray()).filter(isAlive)
    const ts = Date.now()
    for (const rule of rules) {
      if (rule.paused) continue
      let n = rule.n
      const batch: Transaction[] = []
      while (batch.length < MAX_PER_RUN) {
        const date = occurrence(rule.start, rule.freq, n)
        if (date > now) break
        batch.push(
          compact(
            {
              // ID tetap per kejadian: perangkat lain yang menjalankan aturan yang sama menghasilkan ID sama
              id: recurringTxId(rule.id, n),
              updatedAt: ts,
              type: rule.type,
              amount: rule.amount,
              categoryId: rule.categoryId,
              walletId: rule.walletId,
              date,
              note: rule.note,
              recurringId: rule.id,
            },
            ['amount'],
          ),
        )
        n++
      }
      if (!batch.length) continue

      // Jangan menimpa yang sudah ada — termasuk nisan, agar transaksi yang sudah dihapus user tidak muncul lagi
      const existing = await db.transactions.bulkGet(batch.map((t) => t.id))
      const fresh = batch.filter((_, i) => !existing[i])
      if (fresh.length) await db.transactions.bulkAdd(fresh)
      // `n` diperbarui tanpa mengubah updatedAt: ini status lokal, bukan editan user,
      // sehingga tidak mengalahkan perubahan aturan dari perangkat lain saat digabung.
      await db.recurring.update(rule.id, { n })
      created += fresh.length
    }
  })
  return created
}
