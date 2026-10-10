import { CheckCircle2, Circle, HandCoins, Pencil, Plus, Send, Trash2, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm'
import DebtDialog from '@/components/DebtDialog'
import EmptyState from '@/components/EmptyState'
import PageHeader from '@/components/PageHeader'
import Segmented from '@/components/Segmented'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAlive, remove as removeRecord, type Debt } from '@/db/db'
import { setDebtPaid, useDebts, type DebtEntry } from '@/db/hooks'
import { formatDate } from '@/lib/format'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

type Filter = 'unpaid' | 'paid' | 'all'

export default function Debts() {
  const { settings, t, money } = useSettings()
  const confirm = useConfirm()
  const debts = useDebts()
  const [filter, setFilter] = useState<Filter>('unpaid')
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<Debt | undefined>()

  const list = useMemo(
    () => (debts?.entries ?? []).filter((e) => filter === 'all' || (filter === 'paid' ? e.paid : !e.paid)),
    [debts, filter],
  )

  const open = async (entry?: DebtEntry) => {
    setEditing(entry?.source.kind === 'manual' ? await getAlive('debts', entry.source.id) : undefined)
    setDialog(true)
  }

  const toggle = async (e: DebtEntry) => {
    await setDebtPaid(e, !e.paid)
    toast.success(e.paid ? t('debt.markedUnpaid') : t('debt.markedPaid'))
  }

  const remove = async (e: DebtEntry) => {
    if (e.source.kind !== 'manual') return
    if (!(await confirm({ title: t('debt.deleteConfirm'), description: e.person, destructive: true }))) return
    await removeRecord('debts', e.source.id)
    toast.success(t('common.deleted'))
  }

  // Pesan pengingat sopan untuk dikirim lewat WhatsApp / aplikasi lain
  const remind = async (e: DebtEntry) => {
    const text = t('debt.reminderText', { name: e.person, amount: money(e.amount), title: e.title ?? '' }).trim()
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast.success(t('split.copied'))
      }
    } catch {
      // dibatalkan user
    }
  }

  return (
    <div className="min-h-dvh pb-10">
      <PageHeader
        title={t('menu.debts')}
        fallback="/wallets"
        right={
          <Button variant="ghost" size="icon" onClick={() => open()} aria-label={t('debt.add')}>
            <Plus aria-hidden />
          </Button>
        }
      />

      <div className="space-y-4 px-5">
        <div className="grid grid-cols-2 gap-3">
          <Card className="gap-1 rounded-3xl px-4 shadow-card ring-0">
            <p className="text-xs text-muted-foreground">{t('debt.owedToMe')}</p>
            <p className="truncate text-lg font-semibold text-income">{money(debts?.owedToMe ?? 0)}</p>
          </Card>
          <Card className="gap-1 rounded-3xl px-4 shadow-card ring-0">
            <p className="text-xs text-muted-foreground">{t('debt.iOwe')}</p>
            <p className="truncate text-lg font-semibold text-expense">{money(debts?.iOwe ?? 0)}</p>
          </Card>
        </div>

        <Segmented<Filter>
          label={t('menu.debts')}
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: 'unpaid', label: t('debt.unpaid') },
            { value: 'paid', label: t('debt.paid') },
            { value: 'all', label: t('common.all') },
          ]}
        />

        {debts && debts.entries.length === 0 && <EmptyState icon={HandCoins} text={t('debt.empty')} />}
        {debts && debts.entries.length > 0 && list.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('list.empty')}</p>
        )}

        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.key}>
              <Card className={cn('flex-row items-center gap-3 rounded-3xl px-3 py-3 shadow-card ring-0', e.paid && 'opacity-60')}>
                <button
                  type="button"
                  onClick={() => toggle(e)}
                  aria-pressed={e.paid}
                  aria-label={e.paid ? t('debt.markUnpaid') : t('debt.markPaid')}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-primary hover:bg-accent"
                >
                  {e.paid ? <CheckCircle2 className="size-6" aria-hidden /> : <Circle className="size-6 text-muted-foreground" aria-hidden />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate text-sm font-medium', e.paid && 'line-through')}>{e.person}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    {e.source.kind === 'split' && <Users className="size-3 shrink-0" aria-hidden />}
                    <span className="truncate">{[e.title, formatDate(e.date, settings.lang, false)].filter(Boolean).join(' • ')}</span>
                  </p>
                  <Badge variant="secondary" className={cn('mt-1', e.dir === 'borrowed' && 'bg-red-50 text-expense dark:bg-red-950')}>
                    {e.dir === 'lent' ? t('debt.lentShort') : t('debt.borrowedShort')}
                  </Badge>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn('text-sm font-semibold', e.dir === 'lent' ? 'text-income' : 'text-expense')}>{money(e.amount)}</span>
                  <div className="flex">
                    {e.dir === 'lent' && !e.paid && (
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => remind(e)} aria-label={t('debt.remind')}>
                        <Send className="size-4" aria-hidden />
                      </Button>
                    )}
                    {e.source.kind === 'manual' ? (
                      <>
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => open(e)} aria-label={t('common.edit')}>
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => remove(e)} aria-label={t('common.delete')}>
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </>
                    ) : (
                      <Button asChild variant="ghost" size="icon" className="size-8 text-muted-foreground">
                        <Link to={`/split-bill/${e.source.billId}`} aria-label={t('menu.splitBill')}>
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <p className="px-1 text-xs text-muted-foreground">{t('debt.note')}</p>
      </div>

      <DebtDialog open={dialog} onOpenChange={setDialog} debt={editing} />
    </div>
  )
}
