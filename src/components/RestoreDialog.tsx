import { FileUp, GitMerge, RefreshCcw } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { decryptBackup, importBackup, parseBackup, type ImportMode, type ParsedBackup } from '@/db/backup'
import { runRecurring } from '@/lib/recurring'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Ready = Exclude<ParsedBackup, { kind: 'encrypted' }>

/** Pulihkan dari file backup: pilih file -> (kata sandi bila terenkripsi) -> gabungkan / ganti semua */
export default function RestoreDialog({ open, onOpenChange }: Props) {
  const { t } = useSettings()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>()
  const [encrypted, setEncrypted] = useState<Extract<ParsedBackup, { kind: 'encrypted' }>>()
  const [ready, setReady] = useState<Ready>()
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<ImportMode>('merge')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setFileName(undefined)
    setEncrypted(undefined)
    setReady(undefined)
    setPassword('')
    setMode('merge')
    setError(null)
  }, [open])

  const errorText = (e: unknown) => {
    const msg = (e as Error)?.message
    if (msg === 'wrong-password') return t('backup.wrongPassword')
    if (msg === 'newer-version') return t('backup.newerVersion')
    return t('profile.importError')
  }

  const pickFile = async (file?: File) => {
    if (!file) return
    setFileName(file.name)
    setError(null)
    setReady(undefined)
    setEncrypted(undefined)
    try {
      const parsed = parseBackup(await file.text())
      if (parsed.kind === 'encrypted') setEncrypted(parsed)
      else {
        setReady(parsed)
        // File lama (ID angka) tidak bisa digabung secara akurat dengan data dari perangkat ini -> sarankan ganti
        if (parsed.kind === 'legacy') setMode('replace')
      }
    } catch (e) {
      setError(errorText(e))
    }
  }

  const unlock = async () => {
    if (!encrypted) return
    setBusy(true)
    try {
      const parsed = parseBackup(await decryptBackup(encrypted.file, password))
      if (parsed.kind === 'encrypted') throw new Error('invalid-backup')
      setReady(parsed)
      setEncrypted(undefined)
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (encrypted) return unlock()
    if (!ready) return
    if (mode === 'replace' && !(await confirm({ title: t('backup.replaceTitle'), description: t('backup.replaceConfirm'), destructive: true, confirmText: t('backup.modeReplace') }))) return
    setBusy(true)
    try {
      const r = await importBackup(ready, mode)
      await runRecurring()
      toast.success(t('backup.restored', { added: r.added, updated: r.updated }))
      onOpenChange(false)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const modes: { value: ImportMode; Icon: typeof GitMerge; title: string; desc: string }[] = [
    { value: 'merge', Icon: GitMerge, title: t('backup.modeMerge'), desc: t('backup.modeMergeDesc') },
    { value: 'replace', Icon: RefreshCcw, title: t('backup.modeReplace'), desc: t('backup.modeReplaceDesc') },
  ]

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="mx-auto max-w-md">
        <form onSubmit={submit} noValidate>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold">{t('backup.restoreTitle')}</DrawerTitle>
            <DrawerDescription>{t('backup.restoreDesc')}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4">
            <Button type="button" variant="outline" size="lg" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
              <FileUp data-icon="inline-start" aria-hidden />
              <span className="truncate">{fileName ?? t('backup.chooseFile')}</span>
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                pickFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            {encrypted && (
              <div className="list-enter space-y-1.5">
                <Label htmlFor="rs-pw">{t('backup.password')}</Label>
                <Input id="rs-pw" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t('backup.encryptedFile')}</p>
              </div>
            )}

            {ready && (
              <fieldset className="list-enter space-y-2">
                <legend className="mb-2 text-sm font-medium">{t('backup.modeTitle')}</legend>
                {modes.map(({ value, Icon, title, desc }) => (
                  <label
                    key={value}
                    className={cn(
                      'pressable flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3',
                      mode === value ? 'border-primary bg-accent' : 'border-border',
                    )}
                  >
                    <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                    <Icon className={cn('mt-0.5 size-5 shrink-0', value === 'replace' ? 'text-destructive' : 'text-primary')} aria-hidden />
                    <span>
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block text-xs text-muted-foreground">{desc}</span>
                    </span>
                  </label>
                ))}
                {ready.kind === 'legacy' && <p className="text-xs text-amber-600 dark:text-amber-400">{t('backup.legacyNote')}</p>}
              </fieldset>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DrawerFooter className="pb-safe">
            <Button type="submit" size="lg" disabled={busy || (!ready && !encrypted) || (!!encrypted && !password)}>
              {encrypted ? t('backup.unlock') : t('backup.restoreNow')}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
