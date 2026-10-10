import { useLiveQuery } from 'dexie-react-hooks'
import { CloudUpload, X } from 'lucide-react'
import { useState } from 'react'
import BackupDialog from '@/components/BackupDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db/db'
import { BACKUP_REMIND_DAYS, daysSince } from '@/lib/backupFile'
import { useSettings } from '@/lib/settings'

const SNOOZE_MS = 3 * 86_400_000

/**
 * Pengingat di Beranda bila belum pernah backup atau backup terakhir sudah lewat 7 hari.
 * Hanya muncul bila sudah ada transaksi (pengguna baru tidak diganggu).
 */
export default function BackupReminder() {
  const { settings, update, t } = useSettings()
  const [open, setOpen] = useState(false)
  const hasData = useLiveQuery(async () => (await db.transactions.filter((x) => !x.deletedAt).limit(1).count()) > 0, [], false)

  const days = daysSince(settings.lastBackupAt)
  const due = days === undefined || days >= BACKUP_REMIND_DAYS
  const snoozed = (settings.backupSnoozeUntil ?? 0) > Date.now()
  if (!hasData || !due || snoozed) return null

  return (
    <>
      <Card className="pop-enter mx-5 mt-6 flex-row items-center gap-3 rounded-3xl bg-amber-50 px-4 py-3 shadow-none ring-0 dark:bg-amber-950/40" role="status">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-amber-600" aria-hidden>
          <CloudUpload className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {days === undefined ? t('backup.never') : t('backup.daysAgo', { n: days })}
          </p>
          <Button size="sm" className="rounded-full bg-amber-600 text-white hover:bg-amber-700" onClick={() => setOpen(true)}>
            {t('backup.now')}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 self-start text-amber-800 dark:text-amber-200"
          onClick={() => update({ backupSnoozeUntil: Date.now() + SNOOZE_MS })}
          aria-label={t('pwa.later')}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </Card>
      <BackupDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
