import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { enUS, id as idLocale } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { localeOf } from '@/lib/format'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  /** Epoch ms; jam & menit dipertahankan saat tanggal diganti */
  value: number
  onChange: (value: number) => void
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

const shortDate = (ts: number, lang: 'id' | 'en') =>
  new Date(ts).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short', year: 'numeric' })

/** Ganti tanggal tanpa mengubah jam & menit */
function withDay(value: number, day: Date) {
  const cur = new Date(value)
  const next = new Date(day)
  next.setHours(cur.getHours(), cur.getMinutes(), 0, 0)
  return next.getTime()
}

/** Pemilih tanggal sesuai bahasa aplikasi (bukan format bawaan browser) */
export default function DateField({ id, value, onChange }: Props) {
  const { settings } = useSettings()
  const [open, setOpen] = useState(false)
  const current = new Date(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="h-11 w-full min-w-0 justify-start rounded-xl bg-card px-3.5 text-base font-normal"
        >
          <CalendarDays data-icon="inline-start" className="text-muted-foreground" aria-hidden />
          {/* Format bulan singkat (mis. "11 Okt 2026") agar muat di layar sempit */}
          <span className="min-w-0 truncate">{shortDate(value, settings.lang)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] p-0" align="start" collisionPadding={12}>
        <Calendar
          mode="single"
          selected={current}
          defaultMonth={current}
          locale={settings.lang === 'id' ? idLocale : enUS}
          onSelect={(d) => {
            if (!d) return
            onChange(withDay(value, d))
            setOpen(false)
          }}
          className="[--cell-size:--spacing(10)]"
        />
      </PopoverContent>
    </Popover>
  )
}

/** Tombol cepat Hari ini / Kemarin */
export function DateQuickChips({ value, onChange }: Pick<Props, 'value' | 'onChange'>) {
  const { t } = useSettings()
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const isDay = (d: Date) => startOfDay(d) === startOfDay(new Date(value))

  return (
    <div className="flex flex-wrap gap-2">
      {[
        { label: t('date.today'), day: today },
        { label: t('date.yesterday'), day: yesterday },
      ].map(({ label, day }) => (
        <button
          key={label}
          type="button"
          aria-pressed={isDay(day)}
          onClick={() => onChange(withDay(value, day))}
          className={cn(
            'h-8 rounded-full px-3 text-xs font-medium transition-colors',
            isDay(day) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
