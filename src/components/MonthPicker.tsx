import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMonth } from '@/lib/format'
import { useMonth } from '@/lib/month'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function MonthPicker({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { year, month, shift, isCurrent } = useMonth()
  const { settings, t } = useSettings()
  const light = tone === 'light'
  const btn = cn('size-8', light && 'text-white hover:bg-white/20 hover:text-white')

  return (
    <div className={cn('flex items-center gap-1 text-sm', light ? 'text-white' : 'text-muted-foreground')}>
      <Button variant="ghost" size="icon" className={btn} onClick={() => shift(-1)} aria-label={t('common.prevMonth')}>
        <ChevronLeft className="size-4" aria-hidden />
      </Button>
      <span className="min-w-28 text-center font-medium" aria-live="polite">
        {formatMonth(year, month, settings.lang)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className={btn}
        onClick={() => shift(1)}
        disabled={isCurrent}
        aria-label={t('common.nextMonth')}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
