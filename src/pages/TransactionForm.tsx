import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import CategoryDialog from '@/components/CategoryDialog'
import CategoryIcon from '@/components/CategoryIcon'
import { useConfirm } from '@/components/confirm'
import MoneyInput from '@/components/MoneyInput'
import PageHeader from '@/components/PageHeader'
import Segmented from '@/components/Segmented'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { db, type TxType } from '@/db/db'
import { useCategories, useCategoryName } from '@/db/hooks'
import { fromInputs, toDateInput, toTimeInput } from '@/lib/format'
import { useGoBack } from '@/lib/nav'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function TransactionForm() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const [params] = useSearchParams()
  const goBack = useGoBack()
  const confirm = useConfirm()
  const { settings, t } = useSettings()
  const categories = useCategories()
  const catName = useCategoryName()

  const now = Date.now()
  const [type, setType] = useState<TxType>(params.get('type') === 'income' ? 'income' : 'expense')
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [date, setDate] = useState(toDateInput(now))
  const [time, setTime] = useState(toTimeInput(now))
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({})
  const [loaded, setLoaded] = useState(editId === undefined)
  const [notFound, setNotFound] = useState(false)
  const [catDialog, setCatDialog] = useState(false)

  // Muat data saat mode edit
  useEffect(() => {
    if (editId === undefined) return
    if (Number.isNaN(editId)) return setNotFound(true)
    db.transactions.get(editId).then((tx) => {
      if (!tx) return setNotFound(true)
      setType(tx.type)
      setAmount(tx.amount)
      setCategoryId(tx.categoryId)
      setDate(toDateInput(tx.date))
      setTime(toTimeInput(tx.date))
      setNote(tx.note)
      setLoaded(true)
    })
  }, [editId])

  const options = useMemo(() => categories.filter((c) => c.type === type), [categories, type])

  const switchType = (next: TxType) => {
    setType(next)
    if (categories.find((c) => c.id === categoryId)?.type !== next) setCategoryId(undefined)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (amount <= 0) errs.amount = t('tx.amountError')
    if (categoryId === undefined) errs.category = t('tx.categoryError')
    setErrors(errs)
    if (Object.keys(errs).length) return

    const data = { type, amount, categoryId: categoryId!, date: fromInputs(date, time), note: note.trim() }
    if (editId !== undefined) await db.transactions.update(editId, data)
    else await db.transactions.add({ ...data, createdAt: Date.now() })
    toast.success(t('tx.saved'))
    goBack()
  }

  const remove = async () => {
    if (editId === undefined) return
    if (!(await confirm({ title: t('tx.deleteConfirm'), destructive: true }))) return
    await db.transactions.delete(editId)
    toast.success(t('tx.deleted'))
    goBack()
  }

  const title = editId !== undefined ? t('tx.edit') : t('tx.add')

  if (notFound) {
    return (
      <div className="min-h-dvh">
        <PageHeader title={title} />
        <p className="mt-16 text-center text-sm text-muted-foreground">{t('tx.notFound')}</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={title}
        right={
          editId !== undefined && (
            <Button variant="ghost" size="icon" onClick={remove} aria-label={t('common.delete')} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 aria-hidden />
            </Button>
          )
        }
      />

      {loaded && (
        <form onSubmit={submit} className="space-y-5 px-5 pb-10" noValidate>
          <Segmented<TxType>
            label={t('tx.category')}
            value={type}
            onValueChange={switchType}
            options={[
              { value: 'expense', label: t('common.expense'), activeClassName: 'data-[state=on]:bg-expense data-[state=on]:text-white' },
              { value: 'income', label: t('common.income'), activeClassName: 'data-[state=on]:bg-income data-[state=on]:text-white' },
            ]}
          />

          <Card className="gap-1 rounded-3xl px-5 shadow-card ring-0">
            <Label htmlFor="tx-amount" className="font-normal text-muted-foreground">
              {t('tx.amount')}
            </Label>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-semibold text-muted-foreground" aria-hidden>
                {settings.currency === 'IDR' ? 'Rp' : '$'}
              </span>
              <MoneyInput
                bare
                id="tx-amount"
                autoFocus={editId === undefined}
                value={amount}
                onValueChange={(v) => {
                  setAmount(v)
                  if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }))
                }}
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'amount-err' : undefined}
                className="w-full min-w-0 bg-transparent text-3xl font-bold outline-none placeholder:text-muted-foreground/50"
              />
            </div>
            {errors.amount && (
              <p id="amount-err" className="text-xs text-destructive">
                {errors.amount}
              </p>
            )}
          </Card>

          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t('tx.category')}</legend>
            <div className="grid grid-cols-4 gap-2">
              {options.map((c) => {
                const active = c.id === categoryId
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setCategoryId(c.id)
                      setErrors((e) => ({ ...e, category: undefined }))
                    }}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl border-2 bg-card px-1 py-2.5 text-[11px] transition-colors',
                      active ? 'border-primary bg-accent' : 'border-transparent hover:bg-accent',
                    )}
                  >
                    <CategoryIcon category={c} className="size-9 text-lg" />
                    <span className="w-full truncate text-center">{catName(c)}</span>
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setCatDialog(true)}
                className="flex flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-primary/40 px-1 py-2.5 text-[11px] font-medium text-primary transition-colors hover:bg-accent"
              >
                <span className="grid size-9 place-items-center rounded-full bg-secondary" aria-hidden>
                  <Plus className="size-5" />
                </span>
                <span>{t('cat.newShort')}</span>
                <span className="sr-only">{t('cat.add')}</span>
              </button>
            </div>
            {errors.category && <p className="mt-1 text-xs text-destructive">{errors.category}</p>}
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tx-date">{t('tx.date')}</Label>
              <Input id="tx-date" type="date" value={date} required onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tx-time">{t('tx.time')}</Label>
              <Input id="tx-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-note">{t('tx.note')}</Label>
            <Input
              id="tx-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
              placeholder={t('tx.notePlaceholder')}
            />
          </div>

          <Button type="submit" size="lg" className="w-full">
            {t('common.save')}
          </Button>
        </form>
      )}

      <CategoryDialog
        open={catDialog}
        onOpenChange={setCatDialog}
        defaultType={type}
        lockType
        onSaved={(newId) => {
          setCategoryId(newId)
          setErrors((e) => ({ ...e, category: undefined }))
        }}
      />
    </div>
  )
}
