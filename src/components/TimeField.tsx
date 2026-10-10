import { Clock } from 'lucide-react'
import { toTimeInput } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  id?: string
  /** Epoch ms; hanya jam & menit yang diubah */
  value: number
  onChange: (value: number) => void
  className?: string
}

/**
 * Input jam dengan tampilan sama seperti DateField.
 * Input native tetap dipakai (picker bawaan iOS/Android paling nyaman), tapi tampilannya
 * dinormalisasi lewat kelas `.time-input` di index.css agar tidak meluber / berbeda ukuran di Safari.
 */
export default function TimeField({ id, value, onChange, className }: Props) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Clock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        id={id}
        type="time"
        value={toTimeInput(value)}
        onChange={(e) => {
          if (!e.target.value) return
          const [h, m] = e.target.value.split(':').map(Number)
          const d = new Date(value)
          d.setHours(h || 0, m || 0, 0, 0)
          onChange(d.getTime())
        }}
        className="time-input h-11 w-full min-w-0 rounded-xl border border-input bg-card pr-3 pl-10 text-left text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  )
}
