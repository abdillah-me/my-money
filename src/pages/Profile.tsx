import { useLiveQuery } from 'dexie-react-hooks'
import {
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  HardDrive,
  Lock,
  Repeat,
  Tags,
  Target,
  Trash2,
  Upload,
} from 'lucide-react'
import { useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm'
import InstallButton from '@/components/InstallButton'
import PinSetup from '@/components/PinSetup'
import Segmented from '@/components/Segmented'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { clearAllData, db, exportBackup, importBackup } from '@/db/db'
import { useCategoryName, useWalletName } from '@/db/hooks'
import { CURRENCIES, toDateInput, toTimeInput, type Currency } from '@/lib/format'
import type { Lang } from '@/lib/i18n'
import { hasPin } from '@/lib/lock'
import { useInstallPrompt } from '@/lib/pwa'
import { useSettings, type TextSize, type Theme } from '@/lib/settings'
import { cn } from '@/lib/utils'

function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Escape nilai CSV + cegah formula injection saat dibuka di spreadsheet */
function csvCell(v: string | number) {
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const cardCls = 'gap-0 overflow-hidden rounded-3xl py-0 shadow-card ring-0 divide-y'

export default function Profile() {
  const { settings, update, t } = useSettings()
  const confirm = useConfirm()
  const catName = useCategoryName()
  const walletName = useWalletName()
  const { standalone } = useInstallPrompt()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pinOn, setPinOn] = useState(hasPin)
  const [pinDialog, setPinDialog] = useState(false)
  const storage = useStorageInfo()

  const stamp = toDateInput(Date.now())

  const exportJson = async () => {
    download(`wahduid-backup-${stamp}.json`, JSON.stringify(await exportBackup(), null, 2), 'application/json')
  }

  const exportCsv = async () => {
    const [txs, cats, wallets] = await Promise.all([db.transactions.orderBy('date').toArray(), db.categories.toArray(), db.wallets.toArray()])
    const map = new Map(cats.map((c) => [c.id!, c]))
    const wmap = new Map(wallets.map((w) => [w.id!, w]))
    const rows = [
      ['date', 'time', 'type', 'category', 'wallet', 'to_wallet', 'amount', 'note'],
      ...txs.map((x) => [
        toDateInput(x.date),
        toTimeInput(x.date),
        x.type,
        x.type === 'transfer' ? '' : catName(map.get(x.categoryId)),
        walletName(wmap.get(x.walletId)),
        x.toWalletId !== undefined ? walletName(wmap.get(x.toWalletId)) : '',
        x.amount,
        x.note ?? '',
      ]),
    ]
    // BOM agar Excel membaca UTF-8 (emoji / karakter non-ASCII) dengan benar
    download(`wahduid-${stamp}.csv`, '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\n'), 'text/csv')
  }

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!(await confirm({ title: t('profile.import'), description: t('profile.importConfirm'), confirmText: t('profile.import') }))) return
    try {
      await importBackup(JSON.parse(await file.text()))
      toast.success(t('profile.importSuccess'))
    } catch {
      toast.error(t('profile.importError'))
    }
  }

  const reset = async () => {
    if (!(await confirm({ title: t('profile.reset'), description: t('profile.resetConfirm'), destructive: true }))) return
    await clearAllData()
    toast.success(t('common.deleted'))
  }

  return (
    <>
      <header className="pt-safe px-5 pb-4">
        <h1 className="text-center text-lg font-semibold">{t('profile.title')}</h1>
      </header>

      <div className="space-y-5 px-5">
        <div className="flex justify-center">
          <Avatar className="size-20">
            <AvatarFallback className="bg-primary text-3xl font-semibold text-primary-foreground">
              {(settings.name || 'W').charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        <Card className={cn(cardCls, 'divide-y-0 gap-4 py-4')}>
          <Field id="p-name" label={t('profile.name')}>
            <Input id="p-name" value={settings.name} onChange={(e) => update({ name: e.target.value })} maxLength={40} />
          </Field>
          <div className="grid grid-cols-2 gap-3 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-lang">{t('profile.language')}</Label>
              <Select value={settings.lang} onValueChange={(v) => update({ lang: v as Lang })}>
                <SelectTrigger id="p-lang" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="id">Indonesia</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cur">{t('profile.currency')}</Label>
              <Select value={settings.currency} onValueChange={(v) => update({ currency: v as Currency })}>
                <SelectTrigger id="p-cur" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className={cardCls}>
          <NavRow to="/profile/categories" icon={<Tags />} label={t('profile.categories')} />
          <NavRow to="/budget" icon={<Target />} label={t('budget.title')} />
          <NavRow to="/recurring" icon={<Repeat />} label={t('menu.recurring')} />
        </Card>

        <Section title={t('profile.display')}>
          <Card className={cn(cardCls, 'divide-y-0 gap-2 p-4')}>
            <Label>{t('theme.title')}</Label>
            <Segmented<Theme>
              label={t('theme.title')}
              value={settings.theme}
              onValueChange={(theme) => update({ theme })}
              options={[
                { value: 'light', label: t('theme.light') },
                { value: 'dark', label: t('theme.dark') },
                { value: 'system', label: t('theme.system') },
              ]}
            />
            <Label className="mt-3">{t('textSize.title')}</Label>
            <Segmented<TextSize>
              label={t('textSize.title')}
              value={settings.textSize}
              onValueChange={(textSize) => update({ textSize })}
              options={[
                { value: 'normal', label: t('textSize.normal') },
                { value: 'large', label: t('textSize.large') },
                { value: 'xlarge', label: t('textSize.xlarge') },
              ]}
            />
            <p className="text-xs text-muted-foreground">{t('textSize.preview')}</p>
          </Card>
        </Section>

        <Section title={t('lock.title')}>
          <Card className={cn(cardCls, 'divide-y-0 gap-2 p-4')}>
            <div className="flex items-center gap-3">
              <Lock className="size-5 text-primary" aria-hidden />
              <Label htmlFor="p-pin" className="flex-1">
                {t('lock.toggle')}
              </Label>
              <Switch id="p-pin" checked={pinOn} onCheckedChange={() => setPinDialog(true)} />
            </div>
            <p className="text-xs text-muted-foreground">{t('lock.note')}</p>
          </Card>
        </Section>

        <Section title={t('profile.app')}>
          <Card className={cn(cardCls, 'divide-y-0 gap-3 p-4')}>
            {standalone ? (
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2 className="size-5" aria-hidden />
                {t('pwa.installed')}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{t('pwa.installDesc')}</p>
                <InstallButton size="lg" className="w-full" />
              </>
            )}
            <p className="text-xs text-muted-foreground">
              {t('pwa.version')} {__APP_VERSION__}
            </p>
          </Card>
        </Section>

        <Section title={t('profile.data')}>
          <Card className={cardCls}>
            <ActionRow icon={<Download />} label={t('profile.export')} onClick={exportJson} />
            <ActionRow icon={<Upload />} label={t('profile.import')} onClick={() => fileRef.current?.click()} />
            <ActionRow icon={<FileSpreadsheet />} label={t('profile.exportCsv')} onClick={exportCsv} />
            <ActionRow icon={<Trash2 />} label={t('profile.reset')} onClick={reset} danger />
          </Card>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
          {storage && (
            <Card className={cn(cardCls, 'mt-3 divide-y-0 gap-1 p-4')}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="size-4 text-primary" aria-hidden />
                {t('storage.title')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('storage.records', { n: storage.records.toLocaleString(settings.lang === 'id' ? 'id-ID' : 'en-US') })}
                {storage.usage !== undefined && ` • ${t('storage.used', { size: formatBytes(storage.usage) })}`}
              </p>
              <p className="text-xs text-muted-foreground">{storage.persisted ? t('storage.persisted') : t('storage.notPersisted')}</p>
            </Card>
          )}
          <p className="mt-3 px-1 text-xs text-muted-foreground">{t('profile.storageNote')}</p>
        </Section>
      </div>

      <PinSetup
        open={pinDialog}
        onOpenChange={setPinDialog}
        mode={pinOn ? 'disable' : 'enable'}
        onDone={() => setPinOn(hasPin())}
      />
    </>
  )
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** Jumlah record + perkiraan ruang yang dipakai origin ini (IndexedDB + cache service worker) */
function useStorageInfo() {
  return useLiveQuery(async () => {
    const counts = await Promise.all([
      db.transactions.count(),
      db.categories.count(),
      db.wallets.count(),
      db.splitBills.count(),
      db.notes.count(),
      db.budgets.count(),
      db.recurring.count(),
      db.debts.count(),
    ])
    const est = await navigator.storage?.estimate?.().catch(() => undefined)
    const persisted = await navigator.storage?.persisted?.().catch(() => false)
    return { records: counts.reduce((a, b) => a + b, 0), usage: est?.usage, persisted: !!persisted }
  }, [])
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5 px-4">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

const rowCls = 'flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-accent [&_svg]:size-5'

function NavRow({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className={rowCls}>
      <span className="text-primary" aria-hidden>
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="text-muted-foreground" aria-hidden />
    </Link>
  )
}

function ActionRow({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn(rowCls, danger && 'text-destructive')}>
      <span className={danger ? 'text-destructive' : 'text-primary'} aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  )
}
