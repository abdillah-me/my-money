import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import CategoryIcon from '@/components/CategoryIcon'
import { useConfirm } from '@/components/confirm'
import EmptyState from '@/components/EmptyState'
import MoneyInput from '@/components/MoneyInput'
import PageHeader from '@/components/PageHeader'
import WalletSelect from '@/components/WalletSelect'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { allAlive, patch, remove as removeRecord, type RecurringRule } from '@/db/db'
import { useCategoryMap, useCategoryName, useWalletMap, useWalletName } from '@/db/hooks'
import { formatDate } from '@/lib/format'
import { nextDue } from '@/lib/recurring'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function Recurring() {
  const { settings, t, money } = useSettings()
  const confirm = useConfirm()
  const rules = useLiveQuery(() => allAlive('recurring'), [])
  const categories = useCategoryMap()
  const catName = useCategoryName()
  const wallets = useWalletMap()
  const walletName = useWalletName()
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  const [open, setOpen] = useState(false)

  // Urutkan dari jatuh tempo terdekat
  const sorted = [...(rules ?? [])].sort((a, b) => nextDue(a) - nextDue(b))

  const togglePause = async (r: RecurringRule) => {
    await patch('recurring', r.id, { paused: r.paused ? undefined : true })
  }

  const remove = async (r: RecurringRule) => {
    if (!(await confirm({ title: t('recurring.deleteConfirm'), description: t('recurring.deleteDesc'), destructive: true }))) return
    await removeRecord('recurring', r.id)
    toast.success(t('common.deleted'))
  }

  return (
    <div className="min-h-dvh pb-10">
      <PageHeader
        title={t('menu.recurring')}
        fallback="/wallets"
        right={
          <Button asChild variant="ghost" size="icon">
            <Link to="/transactions/new" aria-label={t('tx.add')}>
              <Plus aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 px-5">
        <p className="text-sm text-muted-foreground">{t('recurring.help')}</p>

        {rules && rules.length === 0 && (
          <EmptyState icon={Repeat} text={t('recurring.empty')} action={{ to: '/transactions/new', label: t('tx.add') }} />
        )}

        <ul className="space-y-2">
          {sorted.map((r) => {
            const category = categories.get(r.categoryId)
            return (
              <li key={r.id}>
                <Card className={cn('flex-row items-center gap-3 rounded-3xl px-3 py-3 shadow-card ring-0', r.paused && 'opacity-60')}>
                  <CategoryIcon category={category} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.note || catName(category)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t(`recurring.${r.freq}`)} • {walletName(wallets.get(r.walletId))}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.paused ? t('recurring.paused') : `${t('recurring.next')}: ${formatDate(nextDue(r), settings.lang, false)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={cn('text-sm font-semibold', r.type === 'income' ? 'text-income' : 'text-expense')}>
                      {r.type === 'income' ? '+' : '-'}
                      {money(r.amount)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={!r.paused}
                        onCheckedChange={() => togglePause(r)}
                        aria-label={r.paused ? t('recurring.resume') : t('recurring.pause')}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground"
                        onClick={() => {
                          setEditing(r)
                          setOpen(true)
                        }}
                        aria-label={t('common.edit')}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => remove(r)} aria-label={t('common.delete')}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      </div>

      <RuleEditor open={open} onOpenChange={setOpen} rule={editing} />
    </div>
  )
}

/** Ubah nominal, dompet, dan catatan. Jadwal tidak diubah agar riwayat tetap konsisten. */
function RuleEditor({ open, onOpenChange, rule }: { open: boolean; onOpenChange: (v: boolean) => void; rule: RecurringRule | null }) {
  const { t } = useSettings()
  const [amount, setAmount] = useState(0)
  const [walletId, setWalletId] = useState<string | undefined>()
  const [note, setNote] = useState('')
  const [lastId, setLastId] = useState<string | undefined>()

  // Sinkronkan form saat aturan yang diedit berganti
  if (rule && rule.id !== lastId) {
    setLastId(rule.id)
    setAmount(rule.amount)
    setWalletId(rule.walletId)
    setNote(rule.note ?? '')
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!rule || amount <= 0 || walletId === undefined) return
    await patch('recurring', rule.id, { amount, walletId, note: note.trim() })
    toast.success(t('common.saved'))
    setLastId(undefined)
    onOpenChange(false)
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) setLastId(undefined)
        onOpenChange(v)
      }}
      repositionInputs={false}
    >
      <DrawerContent className="mx-auto max-w-md">
        <form onSubmit={save}>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold">{t('common.edit')}</DrawerTitle>
            <DrawerDescription>{t('recurring.editDesc')}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="r-amount">{t('tx.amount')}</Label>
              <MoneyInput id="r-amount" value={amount} onValueChange={setAmount} className="h-12 text-lg font-semibold" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-wallet">{t('wallet.title')}</Label>
              <WalletSelect id="r-wallet" value={walletId} onChange={setWalletId} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-note">{t('tx.note')}</Label>
              <Input id="r-note" value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DrawerFooter className="pb-safe flex-row">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="lg" className="flex-1">
              {t('common.save')}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
