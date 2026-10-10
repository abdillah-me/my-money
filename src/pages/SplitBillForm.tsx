import { Check, CheckCircle2, Circle, Plus, Receipt, Share2, Trash2, Wallet, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm'
import DateField from '@/components/DateField'
import MoneyInput from '@/components/MoneyInput'
import PageHeader from '@/components/PageHeader'
import Segmented from '@/components/Segmented'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { allAlive, getAlive, insert, patch, remove as removeRecord, type SplitBill } from '@/db/db'
import { formatDate, fractionDigits } from '@/lib/format'
import { useGoBack } from '@/lib/nav'
import { useSettings } from '@/lib/settings'
import { computeSplit, uid } from '@/lib/split'
import { cn } from '@/lib/utils'

type Draft = Omit<SplitBill, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>

const cardCls = 'rounded-3xl shadow-card ring-0'

export default function SplitBillForm() {
  const { id } = useParams()
  const editId = id || undefined
  const goBack = useGoBack('/split-bill')
  const confirm = useConfirm()
  const { settings, t, money } = useSettings()
  const decimals = fractionDigits(settings.currency)

  const [billId, setBillId] = useState<string | undefined>(editId)
  const [draft, setDraft] = useState<Draft>(() => ({
    title: '',
    date: Date.now(),
    mode: 'equal',
    total: 0,
    taxPct: 0,
    servicePct: 0,
    participants: [{ id: uid(), name: settings.name || t('split.me'), isMe: true }],
    items: [],
  }))
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(editId === undefined)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (editId === undefined) return
    getAlive('splitBills', editId).then((b) => {
      if (!b) return setNotFound(true)
      const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = b
      setDraft(rest)
      setLoaded(true)
    })
  }, [editId])

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError(null)
  }
  const result = computeSplit(draft, decimals)
  const me = draft.participants.find((p) => p.isMe)

  // ---- Peserta ----
  const addParticipant = () => {
    const name = newName.trim()
    if (!name) return
    const p = { id: uid(), name }
    // Peserta baru otomatis ikut menanggung semua item yang sudah ada
    set({
      participants: [...draft.participants, p],
      items: draft.items.map((i) => ({ ...i, participantIds: [...i.participantIds, p.id] })),
    })
    setNewName('')
  }
  const removeParticipant = (pid: string) =>
    set({
      participants: draft.participants.filter((p) => p.id !== pid),
      items: draft.items.map((i) => ({ ...i, participantIds: i.participantIds.filter((x) => x !== pid) })),
      // Pembayar dihapus -> kembali ke "saya"
      ...(draft.payerId === pid ? { payerId: undefined } : {}),
    })

  // Pembayar default = saya (payerId kosong agar tidak menyimpan data berlebih)
  const payerId = draft.payerId ?? me?.id
  const togglePaid = (pid: string) =>
    set({
      participants: draft.participants.map((p) => {
        if (p.id !== pid) return p
        const { paid, ...rest } = p
        return paid ? rest : { ...rest, paid: true }
      }),
    })

  // ---- Item ----
  const addItem = () =>
    set({ items: [...draft.items, { id: uid(), name: '', price: 0, participantIds: draft.participants.map((p) => p.id) }] })
  const updateItem = (iid: string, patch: Partial<Draft['items'][number]>) =>
    set({ items: draft.items.map((i) => (i.id === iid ? { ...i, ...patch } : i)) })
  const toggleOwner = (iid: string, pid: string) => {
    const item = draft.items.find((i) => i.id === iid)!
    const has = item.participantIds.includes(pid)
    updateItem(iid, { participantIds: has ? item.participantIds.filter((x) => x !== pid) : [...item.participantIds, pid] })
  }

  const validate = (): string | null => {
    if (!draft.title.trim()) return t('split.titleError')
    if (draft.participants.length < 2) return t('split.participantError')
    if (draft.mode === 'equal' && draft.total <= 0) return t('tx.amountError')
    if (draft.mode === 'items') {
      if (draft.items.length === 0 || draft.items.some((i) => i.price <= 0 || i.participantIds.length === 0))
        return t('split.itemError')
    }
    return null
  }

  /** Simpan tagihan, kembalikan ID-nya. `null` jika validasi gagal. */
  const persist = async (): Promise<string | null> => {
    const err = validate()
    setError(err)
    if (err) {
      toast.error(err)
      return null
    }
    const data = { ...draft, title: draft.title.trim() }
    if (billId !== undefined) {
      // Field undefined (mis. payerId) menghapus properti tersebut
      await patch('splitBills', billId, data)
      return billId
    }
    const newId = await insert('splitBills', { ...data, createdAt: Date.now() }, { keep: ['total', 'taxPct', 'servicePct'] })
    setBillId(newId)
    return newId
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if ((await persist()) === null) return
    toast.success(t('common.saved'))
    goBack()
  }

  const remove = async () => {
    if (billId === undefined) return
    if (!(await confirm({ title: t('split.deleteConfirm'), description: draft.title, destructive: true }))) return
    await removeRecord('splitBills', billId)
    toast.success(t('common.deleted'))
    goBack()
  }

  const share = async () => {
    const lines = [
      `🧾 ${draft.title || t('menu.splitBill')}`,
      formatDate(draft.date, settings.lang, false),
      '',
      ...draft.participants.map((p) => `• ${p.name}: ${money(result.perPerson.get(p.id) ?? 0)}`),
      '',
      `${t('split.grandTotal')}: ${money(result.grand)}`,
    ]
    const text = lines.join('\n')
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast.success(t('split.copied'))
      }
    } catch {
      // User membatalkan dialog share — tidak perlu ditangani
    }
  }

  const recordMine = async () => {
    if (!me) return
    const amount = result.perPerson.get(me.id) ?? 0
    if (amount <= 0) return toast.error(t('tx.amountError'))
    const savedId = await persist()
    if (savedId === null) return

    const cats = (await allAlive('categories')).filter((c) => c.type === 'expense')
    const category = cats.find((c) => c.builtin === 'food') ?? cats[0]
    if (!category) return

    const tx = { type: 'expense' as const, amount, date: draft.date, note: draft.title.trim() }
    const existing = await getAlive('transactions', draft.transactionId)
    let txId = existing?.id
    if (existing) await patch('transactions', existing.id, tx)
    else {
      // Pakai dompet terakhir bila masih aktif, selain itu dompet aktif pertama
      const wallets = (await allAlive('wallets')).filter((w) => !w.archived)
      const walletId = wallets.find((w) => w.id === settings.lastWallet)?.id ?? wallets[0]?.id
      if (walletId === undefined) return
      txId = await insert('transactions', { ...tx, categoryId: category.id, walletId }, { keep: ['amount'] })
    }

    await patch('splitBills', savedId, { transactionId: txId })
    setDraft((d) => ({ ...d, transactionId: txId }))
    toast.success(t('split.recorded'))
  }

  const title = billId !== undefined ? t('split.edit') : t('split.new')

  if (notFound) {
    return (
      <div className="min-h-dvh">
        <PageHeader title={title} fallback="/split-bill" />
        <p className="mt-16 text-center text-sm text-muted-foreground">{t('tx.notFound')}</p>
      </div>
    )
  }
  if (!loaded) return null

  return (
    <div className="min-h-dvh">
      <PageHeader
        title={title}
        fallback="/split-bill"
        right={
          billId !== undefined && (
            <Button variant="ghost" size="icon" onClick={remove} aria-label={t('common.delete')} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <Trash2 aria-hidden />
            </Button>
          )
        }
      />

      <form onSubmit={submit} noValidate className="space-y-5 px-5 pb-10">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
          <Field id="sb-title" label={t('split.billTitle')}>
            <Input
              id="sb-title"
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={t('split.billTitlePlaceholder')}
              maxLength={60}
              aria-invalid={error === t('split.titleError')}
            />
          </Field>
          <Field id="sb-date" label={t('tx.date')}>
            <DateField id="sb-date" value={draft.date} onChange={(date) => set({ date })} />
          </Field>
        </div>

        <section className="space-y-2">
          <Label htmlFor="sb-new-person">{t('split.participants')}</Label>
          <ul className="flex flex-wrap gap-2">
            {draft.participants.map((p) => (
              <li key={p.id}>
                <Badge
                  variant={p.isMe ? 'default' : 'outline'}
                  className={cn('h-8 gap-1 rounded-full bg-card pr-1 pl-3 text-sm font-medium', p.isMe && 'bg-primary pr-3')}
                >
                  {p.name}
                  {!p.isMe && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
                      aria-label={t('split.removeParticipant', { name: p.name })}
                      className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  )}
                </Badge>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              id="sb-new-person"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addParticipant()
                }
              }}
              placeholder={t('split.participantPlaceholder')}
              maxLength={30}
            />
            <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={addParticipant}>
              <Plus data-icon="inline-start" aria-hidden />
              {t('split.addParticipant')}
            </Button>
          </div>
        </section>

        <Segmented<Draft['mode']>
          label={t('split.modeEqual')}
          value={draft.mode}
          onValueChange={(mode) => set({ mode })}
          options={[
            { value: 'equal', label: t('split.modeEqual') },
            { value: 'items', label: t('split.modeItems') },
          ]}
        />

        {draft.mode === 'equal' ? (
          <Field id="sb-total" label={t('split.total')}>
            <MoneyInput id="sb-total" value={draft.total} onValueChange={(v) => set({ total: v })} className="h-12 text-lg font-semibold" />
          </Field>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">{t('split.items')}</h2>
            {draft.items.map((item) => (
              <Card key={item.id} className={cn(cardCls, 'gap-2 px-3 py-3')}>
                <div className="flex gap-2">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(item.id, { name: e.target.value })}
                    placeholder={t('split.itemName')}
                    aria-label={t('split.itemName')}
                    maxLength={40}
                    className="h-10 min-w-0 flex-1 bg-muted"
                  />
                  <MoneyInput
                    value={item.price}
                    onValueChange={(v) => updateItem(item.id, { price: v })}
                    aria-label={t('split.itemPrice')}
                    className="h-10 w-28 bg-muted text-right font-medium"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => set({ items: draft.items.filter((i) => i.id !== item.id) })}
                    aria-label={t('common.delete')}
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {draft.participants.map((p) => {
                    const on = item.participantIds.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleOwner(item.id, p.id)}
                        className={cn(
                          'flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors',
                          on ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {on && <Check className="size-3" aria-hidden />}
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </Card>
            ))}
            <Button type="button" variant="outline" size="lg" className="w-full border-dashed border-primary/40 text-primary hover:text-primary" onClick={addItem}>
              <Plus data-icon="inline-start" aria-hidden />
              {t('split.addItem')}
            </Button>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field id="sb-service" label={t('split.service')}>
            <PercentInput id="sb-service" value={draft.servicePct} onChange={(v) => set({ servicePct: v })} />
          </Field>
          <Field id="sb-tax" label={t('split.tax')}>
            <PercentInput id="sb-tax" value={draft.taxPct} onChange={(v) => set({ taxPct: v })} />
          </Field>
        </div>

        <Card className={cardCls} aria-live="polite">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-semibold">
              <Receipt className="size-4 text-primary" aria-hidden />
              {t('split.result')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sb-payer">{t('split.paidBy')}</Label>
              <Select value={payerId} onValueChange={(v) => set({ payerId: v === me?.id ? undefined : v })}>
                <SelectTrigger id="sb-payer" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {draft.participants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ul className="space-y-1">
              {draft.participants.map((p) => {
                const isPayer = p.id === payerId
                // Yang perlu melunasi: semua peserta selain pembayar. Jika orang lain yang bayar, hanya bagian saya yang dilacak.
                const tracked = !isPayer && (payerId === me?.id || p.isMe)
                return (
                  <li key={p.id} className="flex min-h-9 items-center gap-2 text-sm">
                    {tracked ? (
                      <button
                        type="button"
                        onClick={() => togglePaid(p.id)}
                        aria-pressed={!!p.paid}
                        aria-label={`${p.paid ? t('debt.markUnpaid') : t('debt.markPaid')}: ${p.name}`}
                        className="grid size-7 place-items-center rounded-full text-primary hover:bg-accent"
                      >
                        {p.paid ? <CheckCircle2 className="size-5" aria-hidden /> : <Circle className="size-5 text-muted-foreground" aria-hidden />}
                      </button>
                    ) : (
                      <span className="grid size-7 place-items-center" aria-hidden>
                        {isPayer && <Wallet className="size-4 text-primary" />}
                      </span>
                    )}
                    <span className={cn('flex-1', p.isMe && 'font-semibold text-primary', p.paid && 'text-muted-foreground line-through')}>
                      {p.name}
                      {isPayer && <span className="ml-1 text-xs font-normal text-muted-foreground">({t('split.payer')})</span>}
                    </span>
                    <span className="font-semibold">{money(result.perPerson.get(p.id) ?? 0)}</span>
                  </li>
                )
              })}
            </ul>
            <Separator />
            <dl className="space-y-1 text-xs text-muted-foreground">
              <Line label={t('split.subtotal')} value={money(result.subtotal)} />
              {result.service > 0 && <Line label={t('split.service').replace(' (%)', '')} value={money(result.service)} />}
              {result.tax > 0 && <Line label={t('split.tax').replace(' (%)', '')} value={money(result.tax)} />}
              <div className="flex justify-between pt-1 text-sm font-semibold text-foreground">
                <dt>{t('split.grandTotal')}</dt>
                <dd>{money(result.grand)}</dd>
              </div>
            </dl>
            {result.hasUnassigned && <p className="text-xs text-destructive">{t('split.unassigned')}</p>}

            <div className="grid min-w-0 gap-2 pt-1">
              <Button type="button" variant="secondary" size="lg" onClick={share}>
                <Share2 data-icon="inline-start" aria-hidden />
                {t('split.share')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-auto min-h-12 py-2 text-center whitespace-normal text-primary hover:text-primary"
                onClick={recordMine}
              >
                {t('split.recordMine')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full">
          {t('common.save')}
        </Button>
      </form>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function PercentInput({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={0}
      max={100}
      step="any"
      value={value || ''}
      placeholder="0"
      onChange={(e) => {
        const n = Number(e.target.value)
        onChange(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0)
      }}
    />
  )
}
