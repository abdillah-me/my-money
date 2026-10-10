import { Delete } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PIN_LENGTH } from '@/lib/lock'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

interface Props {
  title: string
  subtitle?: string
  error?: string | null
  /** Dipanggil saat semua digit terisi. Kembalikan false untuk mengosongkan isian (mis. PIN salah). */
  onComplete: (pin: string) => Promise<boolean | void> | boolean | void
  disabled?: boolean
}

/** Keypad PIN bergaya aplikasi bank: titik indikator + tombol angka besar, mendukung keyboard fisik */
export default function PinPad({ title, subtitle, error, onComplete, disabled }: Props) {
  const { t } = useSettings()
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  const press = async (d: string) => {
    if (busy || disabled || pin.length >= PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    if (next.length === PIN_LENGTH) {
      setBusy(true)
      const ok = await onComplete(next)
      setBusy(false)
      if (ok === false) setPin('')
    }
  }
  const back = () => !busy && setPin((p) => p.slice(0, -1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Isian dikosongkan saat ada pesan error baru
  useEffect(() => {
    if (error) setPin('')
  }, [error])

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="space-y-1 text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex gap-3" role="status" aria-label={`${pin.length}/${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn('size-3.5 rounded-full border-2 border-primary transition-colors', i < pin.length && 'bg-primary', error && 'border-destructive')}
          />
        ))}
      </div>
      <p className="h-5 text-sm text-destructive" aria-live="assertive">
        {error}
      </p>
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => (k === 'del' ? back() : press(k))}
              aria-label={k === 'del' ? t('common.delete') : k}
              className="grid size-18 place-items-center rounded-full bg-muted text-2xl font-semibold transition-transform active:scale-95 disabled:opacity-40"
            >
              {k === 'del' ? <Delete className="size-6" aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
