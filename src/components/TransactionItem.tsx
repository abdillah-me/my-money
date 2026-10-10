import { Link } from 'react-router-dom'
import CategoryIcon from '@/components/CategoryIcon'
import type { Category, Transaction } from '@/db/db'
import { useCategoryName } from '@/db/hooks'
import { formatDate } from '@/lib/format'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function TransactionItem({ tx, category }: { tx: Transaction; category?: Category }) {
  const { settings, money } = useSettings()
  const catName = useCategoryName()
  const isIncome = tx.type === 'income'

  return (
    <li>
      <Link
        to={`/transactions/${tx.id}`}
        className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-card focus-visible:bg-card"
      >
        <CategoryIcon category={category} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{tx.note || catName(category)}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {tx.note ? `${catName(category)} • ` : ''}
            {formatDate(tx.date, settings.lang)}
          </span>
        </span>
        <span className={cn('shrink-0 text-sm font-semibold', isIncome ? 'text-income' : 'text-expense')}>
          {isIncome ? '+' : '-'}
          {money(tx.amount)}
        </span>
      </Link>
    </li>
  )
}
