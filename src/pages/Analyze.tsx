import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import MonthPicker from '@/components/MonthPicker'
import PageHeader from '@/components/PageHeader'
import TransactionItem from '@/components/TransactionItem'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { summarize, useCategoryMap, useMonthTransactions } from '@/db/hooks'
import { useMonth } from '@/lib/month'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

// Warna hex (bukan CSS var) karena dipakai sebagai atribut SVG oleh Recharts
const GREEN = '#16a34a'
const RED = '#ef4444'
const TRACK = '#e5e9e6'

export default function Analyze() {
  const { t, money } = useSettings()
  const { year, month } = useMonth()
  const txs = useMonthTransactions(year, month)
  const categories = useCategoryMap()
  const { income, expense, net } = summarize(txs)
  const max = Math.max(income, expense, 1)
  const hasData = (txs?.length ?? 0) > 0

  // Dua cincin: luar = pemasukan, dalam = pengeluaran, relatif terhadap nilai terbesar
  const outer = [
    { value: income, fill: GREEN },
    { value: max - income, fill: TRACK },
  ]
  const inner = [
    { value: expense, fill: RED },
    { value: max - expense, fill: TRACK },
  ]

  return (
    <>
      <PageHeader
        title={t('analyze.title')}
        hideBack
        right={
          <Button asChild variant="ghost" size="icon">
            <Link to="/report" aria-label={t('menu.report')} title={t('menu.report')}>
              <FileText aria-hidden />
            </Link>
          </Button>
        }
      />
      <div className="px-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('analyze.overview')}</h2>
          <MonthPicker />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t('analyze.net')}</p>
        <p className={cn('text-3xl font-bold', net < 0 && 'text-expense')}>{money(net)}</p>

        <div
          className="relative mt-4 h-64"
          role="img"
          aria-label={`${t('common.income')} ${money(income)}, ${t('common.expense')} ${money(expense)}`}
        >
          {hasData ? (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={outer} dataKey="value" innerRadius="78%" outerRadius="95%" startAngle={90} endAngle={-270} stroke="none" cornerRadius={12} isAnimationActive={false}>
                  {outer.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
                <Pie data={inner} dataKey="value" innerRadius="52%" outerRadius="69%" startAngle={90} endAngle={-270} stroke="none" cornerRadius={12} isAnimationActive={false}>
                  {inner.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="grid h-full place-items-center text-sm text-muted-foreground">{t('analyze.noData')}</p>
          )}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-3">
          <Legend color={GREEN} label={t('common.income')} value={money(income)} />
          <Legend color={RED} label={t('common.expense')} value={money(expense)} />
        </div>
      </div>

      <section className="mt-6 px-3">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-lg font-semibold">{t('home.transactions')}</h2>
          <Button asChild variant="link" size="sm" className="px-0">
            <Link to="/transactions">{t('common.seeAll')}</Link>
          </Button>
        </div>
        <ul className="mt-1">
          {txs?.slice(0, 5).map((tx) => (
            <TransactionItem key={tx.id} tx={tx} category={categories.get(tx.categoryId)} />
          ))}
        </ul>
      </section>
    </>
  )
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <Card className="gap-1 rounded-2xl px-3 py-3 shadow-card ring-0">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        {label}
      </span>
      <p className="truncate font-semibold">{value}</p>
    </Card>
  )
}
