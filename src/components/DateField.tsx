import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { enUS, id as idLocale } from 'react-day-picker/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatDate } from '@/lib/format'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  /** Epoch ms; jam & menit dipertahankan saat tanggal diganti */
  value: number
  onChange: (value: number) => void
  /** Tampilkan tombol cepat Hari ini / Kemarin */
  quick?: boolean
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Pemilih tanggal sesuai bahasa aplikasi (bukan format bawaan browser) + tombol cepat */
export default function DateField({ id, value, onChange, quick }: Props) {
  const { settings, t } = useSettings()
  const [open, setOpen] = useState(false)
  const current = new Date(value)

  // Ganti tanggal tanpa mengubah jam
  const setDay = (day: Date) => {
    const next = new Date(day)
    next.setHours(current.getHours(), current.getMinutes(), 0, 0)
    onChange(next.getTime())
  }

  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const isDay = (d: Date) => startOfDay(d) === startOfDay(current)

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="h-11 w-full justify-start rounded-xl bg-card px-3.5 font-normal">
            <CalendarDays data-icon="inline-start" className="text-muted-foreground" aria-hidden />
            {formatDate(value, settings.lang, false)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={current}
            defaultMonth={current}
            locale={settings.lang === 'id' ? idLocale : enUS}
            onSelect={(d) => {
              if (!d) return
              setDay(d)
              setOpen(false)
            }}
            className="[--cell-size:--spacing(10)]"
          />
        </PopoverContent>
      </Popover>
      {quick && (
        <div className="flex gap-2">
          {[
            { label: t('date.today'), day: today },
            { label: t('date.yesterday'), day: yesterday },
          ].map(({ label, day }) => (
            <button
              key={label}
              type="button"
              aria-pressed={isDay(day)}
              onClick={() => setDay(day)}
              className={cn(
                'h-8 rounded-full px-3 text-xs font-medium transition-colors',
                isDay(day) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
