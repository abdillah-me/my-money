import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import MonthPicker from '@/components/MonthPicker'
import PageHeader from '@/components/PageHeader'
import Segmented from '@/components/Segmented'
import TransactionItem from '@/components/TransactionItem'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CategoryType as TxType, Transaction } from '@/db/db'
import { summarize, useCategories, useCategoryMap, useCategoryName, useMonthTransactions } from '@/db/hooks'
import { formatDate } from '@/lib/format'
import { useMonth } from '@/lib/month'
import { useSettings } from '@/lib/settings'

type Filter = 'all' | TxType

export default function Transactions() {
  const { settings, t, money } = useSettings()
  const { year, month } = useMonth()
  const txs = useMonthTransactions(year, month)
  const categories = useCategories()
  const categoryMap = useCategoryMap()
  const catName = useCategoryName()

  const [query, setQuery] = useState('')
  const [type, setType] = useState<Filter>('all')
  const [categoryId, setCategoryId] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (txs ?? []).filter((tx) => {
      if (type !== 'all' && tx.type !== type) return false
      if (categoryId !== 'all' && tx.categoryId !== Number(categoryId)) return false
      if (!q) return true
      return (tx.note ?? '').toLowerCase().includes(q) || catName(categoryMap.get(tx.categoryId)).toLowerCase().includes(q)
    })
  }, [txs, query, type, categoryId, categoryMap, catName])

  // Kelompokkan per hari
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const tx of filtered) {
      const key = formatDate(tx.date, settings.lang, false)
      map.set(key, [...(map.get(key) ?? []), tx])
    }
    return [...map.entries()]
  }, [filtered, settings.lang])

  const { income, expense } = summarize(filtered)
  const catOptions = categories.filter((c) => type === 'all' || c.type === type)

  return (
    <>
      <PageHeader title={t('list.title')} />
      <div className="space-y-3 px-5">
        <div className="flex justify-center">
          <MonthPicker />
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('list.search')}
            aria-label={t('list.search')}
            className="pl-10"
          />
        </div>

        <Segmented<Filter>
          label={t('common.all')}
          value={type}
          onValueChange={(v) => {
            setType(v)
            setCategoryId('all')
          }}
          options={[
            { value: 'all', label: t('common.all') },
            { value: 'income', label: t('common.income') },
            { value: 'expense', label: t('common.expense') },
          ]}
        />

        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full" aria-label={t('tx.category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="all">{t('list.allCategories')}</SelectItem>
            {catOptions.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.icon} {catName(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Card className="flex-row justify-between rounded-2xl px-4 py-3 text-sm shadow-card ring-0">
          <span>
            <span className="text-muted-foreground">{t('common.income')}: </span>
            <span className="font-semibold text-income">{money(income)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">{t('common.expense')}: </span>
            <span className="font-semibold text-expense">{money(expense)}</span>
          </span>
        </Card>
      </div>

      <div className="mt-4 px-3">
        {txs && groups.length === 0 && <p className="mt-10 text-center text-sm text-muted-foreground">{t('list.empty')}</p>}
        {groups.map(([day, list]) => (
          <section key={day} className="mb-3">
            <h2 className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{day}</h2>
            <ul>
              {list.map((tx, i) => (
                <TransactionItem key={tx.id} tx={tx} category={categoryMap.get(tx.categoryId)} index={i} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
