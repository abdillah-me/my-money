import { Lock, Share2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { createBackupFile, deliverFile } from '@/lib/backupFile'
import { useSettings } from '@/lib/settings'

const MIN_PASSWORD = 6

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Buat backup dan kirim lewat lembar Bagikan (Drive / WhatsApp / email) atau unduh */
export default function BackupDialog({ open, onOpenChange }: Props) {
  const { t, update } = useSettings()
  const [encrypt, setEncrypt] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConfirmPw('')
    setError(null)
  }, [open])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (encrypt) {
      if (password.length < MIN_PASSWORD) return setError(t('backup.pwTooShort', { n: MIN_PASSWORD }))
      if (password !== confirmPw) return setError(t('backup.pwMismatch'))
    }
    setBusy(true)
    try {
      const file = await createBackupFile(encrypt ? password : undefined)
      const result = await deliverFile(file)
      if (result === 'cancelled') return
      update({ lastBackupAt: Date.now(), backupSnoozeUntil: undefined })
      toast.success(result === 'shared' ? t('backup.shared') : t('backup.downloaded'))
      onOpenChange(false)
    } catch {
      toast.error(t('backup.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="mx-auto max-w-md">
        <form onSubmit={submit} noValidate>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold">{t('backup.title')}</DrawerTitle>
            <DrawerDescription>{t('backup.desc')}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4">
            <div className="flex items-center gap-3 rounded-2xl bg-muted p-3">
              <Lock className="size-5 shrink-0 text-primary" aria-hidden />
              <div className="flex-1">
                <Label htmlFor="bk-enc">{t('backup.encrypt')}</Label>
                <p className="text-xs text-muted-foreground">{t('backup.encryptDesc')}</p>
              </div>
              <Switch id="bk-enc" checked={encrypt} onCheckedChange={setEncrypt} />
            </div>
            {encrypt && (
              <div className="list-enter space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bk-pw">{t('backup.password')}</Label>
                  <Input id="bk-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bk-pw2">{t('backup.passwordConfirm')}</Label>
                  <Input id="bk-pw2" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">{t('backup.pwWarning')}</p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DrawerFooter className="pb-safe">
            <Button type="submit" size="lg" disabled={busy}>
              <Share2 data-icon="inline-start" aria-hidden />
              {busy ? t('backup.preparing') : t('backup.shareNow')}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
