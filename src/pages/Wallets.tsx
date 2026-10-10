import { Archive, ArchiveRestore, ArrowLeftRight, HandCoins, MoreVertical, Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm'
import AnimatedMoney from '@/components/AnimatedMoney'
import PageHeader from '@/components/PageHeader'
import WalletDialog from '@/components/WalletDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { db, patch, remove as removeRecord, type Wallet } from '@/db/db'
import { useBalances, useDebts, useWalletName, useWallets } from '@/db/hooks'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function Wallets() {
  const { settings, t, money } = useSettings()
  const confirm = useConfirm()
  const wallets = useWallets()
  const { byWallet, total } = useBalances()
  const debts = useDebts()
  const walletName = useWalletName()
  const [dialog, setDialog] = useState(false)
  const [editing, setEditing] = useState<Wallet | undefined>()
  const mask = (v: string) => (settings.hideBalance ? '••••••' : v)

  const active = wallets.filter((w) => !w.archived)
  const archived = wallets.filter((w) => w.archived)

  const open = (w?: Wallet) => {
    setEditing(w)
    setDialog(true)
  }

  const toggleArchive = async (w: Wallet) => {
    if (!w.archived && active.length <= 1) return toast.error(t('wallet.lastOne'))
    await patch('wallets', w.id, { archived: w.archived ? undefined : true })
  }

  const remove = async (w: Wallet) => {
    // Dompet yang sudah punya transaksi diarsipkan saja agar riwayat & saldo tetap benar
    const used = await db.transactions.filter((x) => !x.deletedAt && (x.walletId === w.id || x.toWalletId === w.id)).count()
    if (used > 0) return toast.error(t('wallet.inUse', { n: used }))
    if (active.length <= 1 && !w.archived) return toast.error(t('wallet.lastOne'))
    if (!(await confirm({ title: t('wallet.deleteConfirm'), description: walletName(w), destructive: true }))) return
    await removeRecord('wallets', w.id)
    toast.success(t('common.deleted'))
  }

  const row = (w: Wallet, i: number) => {
    const balance = byWallet.get(w.id!) ?? 0
    return (
      <li key={w.id} className="list-enter flex min-h-16 items-center gap-3 px-4 py-3" style={{ '--i': i } as React.CSSProperties}>
        <span className="grid size-11 shrink-0 place-items-center rounded-full text-xl" style={{ backgroundColor: `${w.color}22` }} aria-hidden>
          {w.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{walletName(w)}</span>
          <span className={cn('block text-sm font-semibold', balance < 0 && 'text-expense')}>{mask(money(balance))}</span>
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label={`${t('common.edit')} ${walletName(w)}`}>
              <MoreVertical className="size-4" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 p-1">
            <MenuItem icon={<Pencil />} label={t('common.edit')} onClick={() => open(w)} />
            <MenuItem
              icon={w.archived ? <ArchiveRestore /> : <Archive />}
              label={w.archived ? t('wallet.unarchive') : t('wallet.archive')}
              onClick={() => toggleArchive(w)}
            />
            <MenuItem icon={<Trash2 />} label={t('common.delete')} onClick={() => remove(w)} danger />
          </PopoverContent>
        </Popover>
      </li>
    )
  }

  return (
    <>
      <PageHeader
        title={t('wallet.title')}
        hideBack
        right={
          <Button variant="ghost" size="icon" onClick={() => open()} aria-label={t('wallet.add')}>
            <Plus aria-hidden />
          </Button>
        }
      />

      <div className="space-y-4 px-5">
        <Card className="hero-gradient gap-1 rounded-3xl border-0 px-5 py-5 text-white shadow-card ring-0">
          <p className="text-sm text-white/90">{t('home.totalBalance')}</p>
          <AnimatedMoney value={total} masked={settings.hideBalance} className="block truncate text-3xl font-bold tracking-tight" />
          <Button asChild variant="secondary" size="sm" className="mt-3 w-fit rounded-full bg-white/90 text-primary hover:bg-white">
            <Link to="/transactions/new?type=transfer">
              <ArrowLeftRight data-icon="inline-start" aria-hidden />
              {t('wallet.transfer')}
            </Link>
          </Button>
        </Card>

        <Card className="gap-0 overflow-hidden rounded-3xl py-0 shadow-card ring-0">
          <ul className="divide-y">{active.map(row)}</ul>
        </Card>

        <Button variant="outline" size="lg" className="w-full border-dashed border-primary/40 text-primary hover:text-primary" onClick={() => open()}>
          <Plus data-icon="inline-start" aria-hidden />
          {t('wallet.add')}
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/debts" className="rounded-3xl bg-card p-4 shadow-card transition-colors hover:bg-accent">
            <HandCoins className="size-5 text-primary" aria-hidden />
            <p className="mt-2 text-sm font-medium">{t('menu.debts')}</p>
            <p className="text-xs text-muted-foreground">
              {t('debt.owedToMe')}: <span className="font-semibold text-income">{mask(money(debts?.owedToMe ?? 0))}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('debt.iOwe')}: <span className="font-semibold text-expense">{mask(money(debts?.iOwe ?? 0))}</span>
            </p>
          </Link>
          <Link to="/recurring" className="rounded-3xl bg-card p-4 shadow-card transition-colors hover:bg-accent">
            <Repeat className="size-5 text-primary" aria-hidden />
            <p className="mt-2 text-sm font-medium">{t('menu.recurring')}</p>
            <p className="text-xs text-muted-foreground">{t('recurring.desc')}</p>
          </Link>
        </div>

        {archived.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">{t('wallet.archived')}</h2>
            <Card className="gap-0 overflow-hidden rounded-3xl py-0 opacity-75 shadow-card ring-0">
              <ul className="divide-y">{archived.map(row)}</ul>
            </Card>
          </section>
        )}
      </div>

      <WalletDialog open={dialog} onOpenChange={setDialog} wallet={editing} />
    </>
  )
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent [&_svg]:size-4',
        danger && 'text-destructive',
      )}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  )
}
