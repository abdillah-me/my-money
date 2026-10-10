import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import BudgetBar from '@/components/BudgetBar'
import CategoryIcon from '@/components/CategoryIcon'
import MoneyInput from '@/components/MoneyInput'
import MonthPicker from '@/components/MonthPicker'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { insert, remove as removeRecord } from '@/db/db'
import { useBudgetStatus, useCategoryName, type BudgetStatus } from '@/db/hooks'
import { useMonth } from '@/lib/month'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function Budget() {
  const { t, money } = useSettings()
  const { year, month } = useMonth()
  const status = useBudgetStatus(year, month)
  const catName = useCategoryName()
  const [editing, setEditing] = useState<BudgetStatus | null>(null)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(0)

  const withBudget = status.filter((s) => s.limit > 0)
  const totalLimit = withBudget.reduce((a, s) => a + s.limit, 0)
  const totalSpent = withBudget.reduce((a, s) => a + s.spent, 0)
  // Kategori dengan anggaran tampil lebih dulu, diurutkan dari yang paling terpakai
  const sorted = [...status].sort((a, b) => Number(b.limit > 0) - Number(a.limit > 0) || b.pct - a.pct)

  const openEditor = (s: BudgetStatus) => {
    setEditing(s)
    setAmount(s.limit)
    setOpen(true)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!editing) return
    // ID anggaran = ID kategori (satu anggaran per kategori)
    const id = editing.category.id
    if (amount > 0) await insert('budgets', { amount }, { id })
    else await removeRecord('budgets', id)
    toast.success(t('common.saved'))
    setOpen(false)
  }

  const removeBudget = async () => {
    if (!editing) return
    await removeRecord('budgets', editing.category.id)
    toast.success(t('common.deleted'))
    setOpen(false)
  }

  return (
    <div className="min-h-dvh pb-10">
      <PageHeader title={t('budget.title')} fallback="/profile" />
      <div className="space-y-4 px-5">
        <p className="text-sm text-muted-foreground">{t('budget.desc')}</p>
        <div className="flex justify-center">
          <MonthPicker />
        </div>

        {totalLimit > 0 && (
          <Card className="gap-1 rounded-3xl px-4 shadow-card ring-0">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{t('budget.spent')}</span>
              <span>{t('budget.total')}</span>
            </div>
            <div className="mb-2 flex justify-between font-semibold">
              <span>{money(totalSpent)}</span>
              <span>{money(totalLimit)}</span>
            </div>
            <BudgetBar pct={(totalSpent / totalLimit) * 100} label={t('budget.total')} />
          </Card>
        )}

        <Card className="gap-0 rounded-3xl py-0 shadow-card ring-0">
          <ul className="divide-y">
            {sorted.map((s) => {
              const name = catName(s.category)
              const left = s.limit - s.spent
              return (
                <li key={s.category.id}>
                  <button type="button" onClick={() => openEditor(s)} className="w-full px-4 py-3 text-left transition-colors hover:bg-accent">
                    <div className="flex items-center gap-3">
                      <CategoryIcon category={s.category} className="size-10 text-lg" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {s.limit > 0 ? `${money(s.spent)} / ${money(s.limit)}` : t('budget.noLimit')}
                        </span>
                      </span>
                      {s.limit > 0 && (
                        <span className={cn('shrink-0 text-xs font-semibold', left < 0 ? 'text-expense' : 'text-primary')}>
                          {left < 0 ? t('budget.over', { amount: money(-left) }) : t('budget.remaining', { amount: money(left) })}
                        </span>
                      )}
                    </div>
                    {s.limit > 0 && (
                      <div className="mt-2 pl-13">
                        <BudgetBar pct={s.pct} label={name} />
                      </div>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
        <DrawerContent className="mx-auto max-w-md">
          {editing && (
            <form onSubmit={save}>
              <DrawerHeader>
                <DrawerTitle className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <span aria-hidden>{editing.category.icon}</span>
                  {catName(editing.category)}
                </DrawerTitle>
                <DrawerDescription>{t('budget.desc')}</DrawerDescription>
              </DrawerHeader>
              <div className="space-y-1.5 px-4">
                <Label htmlFor="budget-amount">{t('budget.limit')}</Label>
                <MoneyInput id="budget-amount" autoFocus value={amount} onValueChange={setAmount} className="h-12 text-lg font-semibold" />
              </div>
              <DrawerFooter className="pb-safe flex-row">
                {editing.limit > 0 ? (
                  <Button type="button" variant="destructive" size="lg" className="flex-1" onClick={removeBudget}>
                    {t('budget.remove')}
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                )}
                <Button type="submit" size="lg" className="flex-1">
                  {t('common.save')}
                </Button>
              </DrawerFooter>
            </form>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  )
}
