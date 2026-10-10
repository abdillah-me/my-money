import { ArrowDown, Plus, Repeat, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import CategoryDialog from '@/components/CategoryDialog'
import CategoryIcon from '@/components/CategoryIcon'
import { useConfirm } from '@/components/confirm'
import DateField, { DateQuickChips } from '@/components/DateField'
import TimeField from '@/components/TimeField'
import MoneyInput from '@/components/MoneyInput'
import PageHeader from '@/components/PageHeader'
import Segmented from '@/components/Segmented'
import WalletSelect from '@/components/WalletSelect'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { db, getAlive, insert, patch, recurringTxId, remove as removeRecord, type Frequency, type TxType } from '@/db/db'
import { useCategories, useCategoryName, useWallets } from '@/db/hooks'
import { fractionDigits, formatCompact } from '@/lib/format'
import { useGoBack } from '@/lib/nav'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

type Repeat = 'none' | Frequency

/** Nominal cepat dalam satuan mata uang aktif */
const QUICK_AMOUNTS = { IDR: [10_000, 20_000, 50_000, 100_000], USD: [5, 10, 20, 50] } as const

const parseType = (v: string | null): TxType => (v === 'income' || v === 'transfer' ? v : 'expense')

export default function TransactionForm() {
  const { id } = useParams()
  const editId = id || undefined
  const [params] = useSearchParams()
  const goBack = useGoBack()
  const confirm = useConfirm()
  const { settings, update, t } = useSettings()
  const categories = useCategories()
  const wallets = useWallets()
  const catName = useCategoryName()

  const [type, setType] = useState<TxType>(parseType(params.get('type')))
  const [amount, setAmount] = useState(0)
  const [categoryId, setCategoryId] = useState<string | undefined>(
    type === 'transfer' ? undefined : settings.lastCategory[type],
  )
  const [walletId, setWalletId] = useState<string | undefined>(settings.lastWallet)
  const [toWalletId, setToWalletId] = useState<string | undefined>()
  const [date, setDate] = useState(Date.now())
  const [note, setNote] = useState('')
  const [repeat, setRepeat] = useState<Repeat>('none')
  const [recurringId, setRecurringId] = useState<string | undefined>()
  const [errors, setErrors] = useState<{ amount?: string; category?: string; wallet?: string }>({})
  const [loaded, setLoaded] = useState(editId === undefined)
  const [notFound, setNotFound] = useState(false)
  const [catDialog, setCatDialog] = useState(false)

  // Muat data saat mode edit
  useEffect(() => {
    if (editId === undefined) return
    getAlive('transactions', editId).then((tx) => {
      if (!tx) return setNotFound(true)
      setType(tx.type)
      setAmount(tx.amount)
      setCategoryId(tx.type === 'transfer' ? undefined : tx.categoryId)
      setWalletId(tx.walletId)
      setToWalletId(tx.toWalletId)
      setDate(tx.date)
      setNote(tx.note ?? '')
      setRecurringId(tx.recurringId)
      setLoaded(true)
    })
  }, [editId])

  // Dompet default: terakhir dipakai bila masih aktif, selain itu dompet aktif pertama
  useEffect(() => {
    if (!wallets.length) return
    const active = wallets.filter((w) => !w.archived)
    if (walletId === undefined || !wallets.some((w) => w.id === walletId)) setWalletId(active[0]?.id)
  }, [wallets, walletId])

  const options = useMemo(() => categories.filter((c) => c.type === type), [categories, type])
  const isTransfer = type === 'transfer'

  const switchType = (next: TxType) => {
    setType(next)
    setErrors({})
    if (next === 'transfer') return setCategoryId(undefined)
    if (categories.find((c) => c.id === categoryId)?.type !== next) setCategoryId(settings.lastCategory[next])
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (amount <= 0) errs.amount = t('tx.amountError')
    if (!isTransfer && categoryId === undefined) errs.category = t('tx.categoryError')
    if (walletId === undefined) errs.wallet = t('wallet.required')
    if (isTransfer && (toWalletId === undefined || toWalletId === walletId)) errs.wallet = t('wallet.transferError')
    setErrors(errs)
    if (Object.keys(errs).length) return

    const base = {
      type,
      amount,
      categoryId: isTransfer ? undefined : categoryId,
      walletId: walletId!,
      toWalletId: isTransfer ? toWalletId : undefined,
      date,
      note: note.trim(),
    }

    if (editId !== undefined) {
      await patch('transactions', editId, base)
    } else {
      await db.transaction('rw', db.transactions, db.recurring, async () => {
        if (repeat !== 'none' && !isTransfer) {
          // Transaksi ini = kejadian ke-0 dengan ID tetap, aturan mulai dari kejadian ke-1
          const rid = await insert(
            'recurring',
            { type, amount, categoryId: categoryId!, walletId: walletId!, note: base.note, freq: repeat, start: date, n: 1 },
            { keep: ['amount', 'n'] },
          )
          await insert('transactions', { ...base, recurringId: rid }, { id: recurringTxId(rid, 0), keep: ['amount'] })
        } else {
          await insert('transactions', base, { keep: ['amount'] })
        }
      })
    }

    update({
      lastWallet: walletId,
      ...(isTransfer ? {} : { lastCategory: { ...settings.lastCategory, [type]: categoryId } }),
    })
    toast.success(t('tx.saved'))
    goBack()
  }

  const remove = async () => {
    if (editId === undefined) return
    if (!(await confirm({ title: t('tx.deleteConfirm'), destructive: true }))) return
    await removeRecord('transactions', editId)
    toast.success(t('tx.deleted'))
    goBack()
  }

  const title = editId !== undefined ? t('tx.edit') : t('tx.add')
  const typeColor = type === 'income' ? 'bg-income' : type === 'expense' ? 'bg-expense' : 'bg-primary'

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
            label={t('tx.type')}
            value={type}
            onValueChange={switchType}
            options={[
              // Kelas ditulis utuh (bukan string dinamis) agar terdeteksi oleh Tailwind
              { value: 'expense', label: t('common.expense'), activeClassName: 'data-[state=on]:bg-expense data-[state=on]:text-white' },
              { value: 'income', label: t('common.income'), activeClassName: 'data-[state=on]:bg-income data-[state=on]:text-white' },
              { value: 'transfer', label: t('wallet.transfer'), activeClassName: 'data-[state=on]:bg-primary data-[state=on]:text-white' },
            ]}
          />

          <Card className="gap-2 rounded-3xl px-5 shadow-card ring-0">
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
            {/* Nominal cepat: menambah ke nominal saat ini */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS[settings.currency].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    const decimals = fractionDigits(settings.currency)
                    setAmount((a) => Math.round((a + q) * 10 ** decimals) / 10 ** decimals)
                    setErrors((e) => ({ ...e, amount: undefined }))
                  }}
                  className="h-8 rounded-full bg-muted px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground"
                >
                  +{formatCompact(q, settings.lang)}
                </button>
              ))}
            </div>
          </Card>

          {/* Dompet */}
          {isTransfer ? (
            <div className="space-y-1.5">
              <Label htmlFor="tx-wallet">{t('wallet.from')}</Label>
              <WalletSelect id="tx-wallet" value={walletId} onChange={setWalletId} invalid={!!errors.wallet} />
              <div className="flex justify-center py-1 text-muted-foreground" aria-hidden>
                <ArrowDown className="size-4" />
              </div>
              <Label htmlFor="tx-to-wallet">{t('wallet.to')}</Label>
              <WalletSelect
                id="tx-to-wallet"
                value={toWalletId}
                onChange={setToWalletId}
                exclude={walletId}
                placeholder={t('wallet.choose')}
                invalid={!!errors.wallet}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="tx-wallet">{t('wallet.title')}</Label>
              <WalletSelect id="tx-wallet" value={walletId} onChange={setWalletId} invalid={!!errors.wallet} />
            </div>
          )}
          {errors.wallet && <p className="-mt-3 text-xs text-destructive">{errors.wallet}</p>}

          {!isTransfer && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t('tx.category')}</legend>
              <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4">
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
          )}

          <div className="space-y-2">
            {/* minmax(0, …) wajib agar kolom boleh menyempit (default grid item = min-content) */}
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="tx-date">{t('tx.date')}</Label>
                <DateField id="tx-date" value={date} onChange={setDate} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="tx-time">{t('tx.time')}</Label>
                <TimeField id="tx-time" value={date} onChange={setDate} />
              </div>
            </div>
            <DateQuickChips value={date} onChange={setDate} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tx-note">{t('tx.note')}</Label>
            <Input id="tx-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={100} placeholder={t('tx.notePlaceholder')} />
          </div>

          {/* Ulangi hanya saat membuat transaksi baru (bukan transfer) */}
          {editId === undefined && !isTransfer && (
            <div className="space-y-1.5">
              <Label htmlFor="tx-repeat" className="flex items-center gap-1.5">
                <Repeat className="size-4 text-primary" aria-hidden />
                {t('recurring.repeat')}
              </Label>
              <Select value={repeat} onValueChange={(v) => setRepeat(v as Repeat)}>
                <SelectTrigger id="tx-repeat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="none">{t('recurring.none')}</SelectItem>
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`recurring.${f}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {recurringId !== undefined && <p className="text-xs text-muted-foreground">{t('recurring.fromRule')}</p>}

          <Button type="submit" size="lg" className={cn('w-full', typeColor, 'hover:opacity-90')}>
            {t('common.save')}
          </Button>
        </form>
      )}

      <CategoryDialog
        open={catDialog}
        onOpenChange={setCatDialog}
        defaultType={isTransfer ? 'expense' : type}
        lockType
        onSaved={(newId) => {
          setCategoryId(newId)
          setErrors((e) => ({ ...e, category: undefined }))
        }}
      />
    </div>
  )
}
