import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '@/components/EmptyState'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { allAlive } from '@/db/db'
import { formatDate, fractionDigits } from '@/lib/format'
import { useSettings } from '@/lib/settings'
import { computeSplit } from '@/lib/split'

export default function SplitBills() {
  const { settings, t, money } = useSettings()
  const bills = useLiveQuery(async () => (await allAlive('splitBills')).sort((a, b) => b.date - a.date), [])
  const decimals = fractionDigits(settings.currency)

  return (
    <div className="min-h-dvh pb-28">
      <PageHeader
        title={t('menu.splitBill')}
        right={
          <Button asChild variant="ghost" size="icon">
            <Link to="/split-bill/new" aria-label={t('split.new')}>
              <Plus aria-hidden />
            </Link>
          </Button>
        }
      />

      {bills && bills.length === 0 && (
        <EmptyState icon={Users} text={t('split.empty')} action={{ to: '/split-bill/new', label: t('split.new') }} />
      )}

      <ul className="space-y-3 px-5">
        {bills?.map((b) => {
          const { grand } = computeSplit(b, decimals)
          return (
            <li key={b.id}>
              <Link
                to={`/split-bill/${b.id}`}
                className="flex items-center gap-3 rounded-3xl bg-card p-4 text-card-foreground shadow-card transition-colors hover:bg-accent"
              >
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                    <Users className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{b.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatDate(b.date, settings.lang, false)} • {t('split.people', { n: b.participants.length })}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">{money(grand)}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
