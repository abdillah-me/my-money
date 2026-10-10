import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Eye, EyeOff, HandCoins, Repeat, StickyNote, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import BudgetBar from '@/components/BudgetBar'
import AnimatedMoney from '@/components/AnimatedMoney'
import BackupReminder from '@/components/BackupReminder'
import InstallBanner from '@/components/InstallBanner'
import ListSkeleton from '@/components/ListSkeleton'
import MonthPicker from '@/components/MonthPicker'
import TransactionItem from '@/components/TransactionItem'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  summarize,
  useBudgetStatus,
  useCategoryMap,
  useCategoryName,
  useBalances,
  useMonthTransactions,
} from '@/db/hooks'
import type { DictKey } from '@/lib/i18n'
import { useMonth } from '@/lib/month'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

function greetingKey(): DictKey {
  const h = new Date().getHours()
  if (h < 11) return 'greeting.morning'
  if (h < 15) return 'greeting.afternoon'
  if (h < 18) return 'greeting.evening'
  return 'greeting.night'
}

const menus: { to: string; label: DictKey; Icon: typeof Users }[] = [
  { to: '/split-bill', label: 'menu.splitBill', Icon: Users },
  { to: '/debts', label: 'menu.debts', Icon: HandCoins },
  { to: '/recurring', label: 'menu.recurring', Icon: Repeat },
  { to: '/note', label: 'menu.note', Icon: StickyNote },
]

export default function Home() {
  const { settings, update, t, money } = useSettings()
  const { year, month } = useMonth()
  const txs = useMonthTransactions(year, month)
  const balance = useBalances().total
  const categories = useCategoryMap()
  const { income, expense } = summarize(txs)
  const catName = useCategoryName()
  // Anggaran yang sudah terpakai >= 80%, paling kritis lebih dulu
  const alerts = useBudgetStatus(year, month)
    .filter((s) => s.limit > 0 && s.pct >= 80)
    .sort((a, b) => b.pct - a.pct)
  const hidden = settings.hideBalance
  const mask = (v: string) => (hidden ? '••••••' : v)
  const initial = (settings.name || 'W').charAt(0).toUpperCase()

  return (
    <>
      <section className="hero-gradient pt-safe px-5 pb-6">
        <div className="flex items-center justify-between">
          <div className="text-white">
            <p className="text-xs opacity-90">{t(greetingKey())}</p>
            <p className="text-lg font-semibold">{settings.name || 'Wahduid'}</p>
          </div>
          <Link to="/profile" aria-label={t('nav.profile')} className="rounded-full">
            <Avatar className="size-11 border-2 border-white/70">
              <AvatarFallback className="bg-white/25 font-semibold text-white">{initial}</AvatarFallback>
            </Avatar>
          </Link>
        </div>

        <p className="mt-6 text-sm text-white/90">{t('home.totalBalance')}</p>
        <div className="flex items-center gap-2 text-white">
          <AnimatedMoney
            value={balance}
            masked={hidden}
            className="min-w-0 font-bold tracking-tight whitespace-nowrap text-[min(1.875rem,8.5vw)]"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => update({ hideBalance: !hidden })}
            aria-label={hidden ? t('common.showBalance') : t('common.hideBalance')}
            aria-pressed={hidden}
            className="size-10 shrink-0 bg-white/25 text-white hover:bg-white/35 hover:text-white"
          >
            {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </Button>
        </div>

        {/* Pilih bulan diletakkan di atas kartu bulanan agar jelas: hanya kartu & daftar transaksi yang terpengaruh */}
        <div className="mt-5 flex justify-end">
          <MonthPicker tone="light" />
        </div>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <SummaryCard kind="income" label={t('common.income')} value={income} masked={hidden} index={0} />
          <SummaryCard kind="expense" label={t('common.expense')} value={expense} masked={hidden} index={1} />
        </div>
      </section>

      <nav className="grid grid-cols-4 gap-2 px-5" aria-label="Menu">
        {menus.map(({ to, label, Icon }, i) => (
          <Link
            key={to}
            to={to}
            className="pop-enter group flex flex-col items-center gap-1.5 rounded-2xl py-1 text-xs font-medium text-muted-foreground"
            style={{ '--i': i + 2 } as React.CSSProperties}
          >
            <span className="grid size-15 place-items-center rounded-full bg-card shadow-card transition-transform duration-200 group-active:scale-90">
              <span className="grid size-9 place-items-center rounded-full bg-secondary text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
            </span>
            {t(label)}
          </Link>
        ))}
      </nav>

      <BackupReminder />
      <InstallBanner />

      {alerts.length > 0 && (
        <Card className="mx-5 mt-6 rounded-3xl shadow-card ring-0" aria-labelledby="budget-alert">
          <CardHeader>
            <CardTitle id="budget-alert" className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-amber-500" aria-hidden />
              {t('budget.alert')}
            </CardTitle>
            <CardAction>
              <Button asChild variant="link" size="sm" className="h-auto p-0">
                <Link to="/budget">{t('budget.manage')}</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {alerts.slice(0, 3).map((s) => (
                <li key={s.category.id}>
                  <div className="mb-1 flex justify-between gap-2 text-xs">
                    <span className="truncate">
                      {s.category.icon} {catName(s.category)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {mask(money(s.spent))} / {mask(money(s.limit))}
                    </span>
                  </div>
                  <BudgetBar pct={s.pct} label={catName(s.category)} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <section className="mt-6 px-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-semibold">{t('home.transactions')}</h2>
          <Button asChild variant="link" size="sm" className="px-0">
            <Link to="/transactions">{t('common.seeAll')}</Link>
          </Button>
        </div>
        {txs === undefined ? (
          <ListSkeleton rows={4} />
        ) : txs.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
            <p>{t('home.empty')}</p>
            <Button asChild className="rounded-full">
              <Link to="/transactions/new">{t('home.addFirst')}</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-1">
            {txs.slice(0, 6).map((tx, i) => (
              <TransactionItem key={tx.id} tx={tx} category={categories.get(tx.categoryId)} index={i} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function SummaryCard({
  kind,
  label,
  value,
  masked,
  index,
}: {
  kind: 'income' | 'expense'
  label: string
  value: number
  masked: boolean
  index: number
}) {
  const Icon = kind === 'income' ? ArrowDownLeft : ArrowUpRight
  return (
    <Card className="pop-enter @container gap-0 rounded-3xl px-4 shadow-card ring-0" style={{ '--i': index } as React.CSSProperties}>
      <span
        className={cn(
          'grid size-9 place-items-center rounded-full',
          kind === 'income' ? 'bg-secondary text-income' : 'bg-red-50 text-expense dark:bg-red-950',
        )}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
      {/* Ukuran angka menyesuaikan lebar kartu (container query) agar nominal tidak pernah terpotong */}
      <AnimatedMoney
        value={value}
        masked={masked}
        className="block font-semibold whitespace-nowrap text-[clamp(0.8125rem,11cqw,1.125rem)] leading-tight"
      />
    </Card>
  )
}
