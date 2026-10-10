import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import DateField from '@/components/DateField'
import MoneyInput from '@/components/MoneyInput'
import Segmented from '@/components/Segmented'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { insert, patch, type Debt } from '@/db/db'
import { useSettings } from '@/lib/settings'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  debt?: Debt
}

/** Tambah / ubah catatan hutang-piutang manual */
export default function DebtDialog({ open, onOpenChange, debt }: Props) {
  const { t } = useSettings()
  const [person, setPerson] = useState('')
  const [amount, setAmount] = useState(0)
  const [dir, setDir] = useState<Debt['dir']>('lent')
  const [date, setDate] = useState(Date.now())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPerson(debt?.person ?? '')
    setAmount(debt?.amount ?? 0)
    setDir(debt?.dir ?? 'lent')
    setDate(debt?.date ?? Date.now())
    setNote(debt?.note ?? '')
    setError(null)
  }, [open, debt])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!person.trim()) return setError(t('debt.personError'))
    if (amount <= 0) return setError(t('tx.amountError'))
    const data = { person: person.trim(), amount, dir, date, note: note.trim() }
    if (debt) await patch('debts', debt.id, data)
    else await insert('debts', data, { keep: ['amount'] })
    toast.success(t('common.saved'))
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="mx-auto max-w-md">
        <form onSubmit={save} noValidate>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold">{debt ? t('debt.edit') : t('debt.add')}</DrawerTitle>
            <DrawerDescription className="sr-only">{t('menu.debts')}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4">
            <Segmented<Debt['dir']>
              label={t('menu.debts')}
              value={dir}
              onValueChange={setDir}
              options={[
                { value: 'lent', label: t('debt.lent') },
                { value: 'borrowed', label: t('debt.borrowed') },
              ]}
            />
            <div className="space-y-1.5">
              <Label htmlFor="d-person">{t('debt.person')}</Label>
              <Input id="d-person" value={person} maxLength={40} onChange={(e) => setPerson(e.target.value)} placeholder={t('split.participantPlaceholder')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-amount">{t('tx.amount')}</Label>
              <MoneyInput id="d-amount" value={amount} onValueChange={setAmount} className="h-12 text-lg font-semibold" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-date">{t('tx.date')}</Label>
              <DateField id="d-date" value={date} onChange={setDate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-note">{t('tx.note')}</Label>
              <Input id="d-note" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
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
