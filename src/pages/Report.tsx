import { useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import CategoryIcon from '@/components/CategoryIcon'
import MonthPicker from '@/components/MonthPicker'
import PageHeader from '@/components/PageHeader'
import Segmented from '@/components/Segmented'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CategoryType as TxType } from '@/db/db'
import { summarize, useCategoryMap, useCategoryName, useMonthTransactions } from '@/db/hooks'
import { formatCompact } from '@/lib/format'
import { useMonth } from '@/lib/month'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

const cardCls = 'rounded-3xl shadow-card ring-0'

export default function Report() {
  const { settings, t, money } = useSettings()
  const { year, month, isCurrent } = useMonth()
  const txs = useMonthTransactions(year, month)
  const categories = useCategoryMap()
  const catName = useCategoryName()
  const [type, setType] = useState<TxType>('expense')

  const { income, expense } = summarize(txs)

  // Total per kategori, urut dari yang terbesar
  const byCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const tx of txs ?? []) {
      if (tx.type !== type) continue
      const key = tx.categoryId ?? ''
      totals.set(key, (totals.get(key) ?? 0) + tx.amount)
    }
    const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1
    return [...totals.entries()]
      .map(([id, total]) => ({ id, category: categories.get(id), total, pct: (total / sum) * 100 }))
      .sort((a, b) => b.total - a.total)
  }, [txs, type, categories])

  // Total per tanggal untuk chart harian
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daily = useMemo(() => {
    const arr = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, total: 0 }))
    for (const tx of txs ?? []) if (tx.type === type) arr[new Date(tx.date).getDate() - 1].total += tx.amount
    return arr
  }, [txs, type, daysInMonth])

  const elapsedDays = isCurrent ? new Date().getDate() : daysInMonth
  const biggest = (txs ?? []).filter((x) => x.type === 'expense').sort((a, b) => b.amount - a.amount)[0]
  const color = type === 'income' ? '#16a34a' : '#ef4444'

  return (
    <>
      <PageHeader title={t('report.title')} fallback="/analyze" />
      <div className="space-y-4 px-5">
        <div className="flex justify-center">
          <MonthPicker />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat label={t('common.income')} value={money(income)} className="text-income" />
          <Stat label={t('common.expense')} value={money(expense)} className="text-expense" />
          <Stat label={t('report.average')} value={money(expense / elapsedDays)} />
          <Stat label={t('report.count')} value={String(txs?.length ?? 0)} />
        </div>

        {biggest && (
          <Card className={cn(cardCls, 'gap-1 px-4')}>
            <p className="text-xs text-muted-foreground">{t('report.biggest')}</p>
            <p className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {categories.get(biggest.categoryId)?.icon} {biggest.note || catName(categories.get(biggest.categoryId))}
              </span>
              <span className="shrink-0 font-semibold text-expense">{money(biggest.amount)}</span>
            </p>
          </Card>
        )}

        <Segmented<TxType>
          label={t('report.title')}
          value={type}
          onValueChange={setType}
          options={[
            { value: 'expense', label: t('common.expense') },
            { value: 'income', label: t('common.income') },
          ]}
        />

        <Card className={cardCls}>
          <CardHeader>
            <CardTitle className="font-semibold">{t('report.daily')}</CardTitle>
          </CardHeader>
          <CardContent className="h-44">
            <ResponsiveContainer>
              <BarChart data={daily} margin={{ left: -16, right: 4 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatCompact(v, settings.lang)}
                />
                <Tooltip
                  cursor={{ fill: '#eef2ef' }}
                  formatter={(v) => money(Number(v))}
                  labelFormatter={(d) => `${d}`}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e3e8e5', fontSize: 12 }}
                />
                <Bar dataKey="total" fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className={cardCls}>
          <CardHeader>
            <CardTitle className="font-semibold">{t('report.byCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{t('analyze.noData')}</p>
            ) : (
              <ul className="space-y-3">
                {byCategory.map(({ id, category, total, pct }) => (
                  <li key={id} className="flex items-center gap-3">
                    <CategoryIcon category={category} className="size-9 text-base" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">{catName(category)}</span>
                        <span className="shrink-0 font-medium">
                          {money(total)} <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: category?.color ?? '#94a3b8' }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card className={cn(cardCls, 'gap-1 rounded-2xl px-4')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('truncate font-semibold', className)}>{value}</p>
    </Card>
  )
}
