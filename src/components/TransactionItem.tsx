import { ArrowLeftRight, Repeat } from 'lucide-react'
import { Link } from 'react-router-dom'
import CategoryIcon from '@/components/CategoryIcon'
import type { Category, Transaction } from '@/db/db'
import { useCategoryName, useWalletMap, useWalletName } from '@/db/hooks'
import { formatDate } from '@/lib/format'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function TransactionItem({ tx, category }: { tx: Transaction; category?: Category }) {
  const { settings, money } = useSettings()
  const catName = useCategoryName()
  const wallets = useWalletMap()
  const walletName = useWalletName()
  const isTransfer = tx.type === 'transfer'
  const isIncome = tx.type === 'income'

  const title = isTransfer
    ? `${walletName(wallets.get(tx.walletId))} → ${walletName(wallets.get(tx.toWalletId!))}`
    : tx.note || catName(category)
  const subtitle = isTransfer ? tx.note : tx.note ? catName(category) : undefined
  // Tampilkan nama dompet hanya bila punya lebih dari satu dompet
  const walletLabel = !isTransfer && wallets.size > 1 ? walletName(wallets.get(tx.walletId)) : undefined

  return (
    <li>
      <Link
        to={`/transactions/${tx.id}`}
        className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-card focus-visible:bg-card"
      >
        {isTransfer ? (
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary" aria-hidden>
            <ArrowLeftRight className="size-5" />
          </span>
        ) : (
          <CategoryIcon category={category} />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-sm font-medium">
            <span className="truncate">{title}</span>
            {tx.recurringId !== undefined && <Repeat className="size-3 shrink-0 text-muted-foreground" aria-label="recurring" />}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[subtitle, walletLabel, formatDate(tx.date, settings.lang)].filter(Boolean).join(' • ')}
          </span>
        </span>
        <span
          className={cn(
            'shrink-0 text-sm font-semibold',
            isTransfer ? 'text-muted-foreground' : isIncome ? 'text-income' : 'text-expense',
          )}
        >
          {isTransfer ? '' : isIncome ? '+' : '-'}
          {money(tx.amount)}
        </span>
      </Link>
    </li>
  )
}
