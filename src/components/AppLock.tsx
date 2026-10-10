import { Wallet } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import PinPad from '@/components/PinPad'
import { cooldownLeft, hasPin, verifyPin } from '@/lib/lock'
import { useSettings } from '@/lib/settings'

/** Kunci otomatis bila aplikasi ditinggal (di latar belakang) lebih lama dari ini */
const AUTO_LOCK_MS = 60_000

/** Menampilkan layar PIN saat aplikasi dibuka atau kembali dari latar belakang */
export default function AppLock({ children }: { children: ReactNode }) {
  const { t } = useSettings()
  const [locked, setLocked] = useState(hasPin)
  const [error, setError] = useState<string | null>(null)
  const [wait, setWait] = useState(0)

  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now()
      else if (hiddenAt && Date.now() - hiddenAt > AUTO_LOCK_MS && hasPin()) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Hitung mundur saat cooldown setelah terlalu banyak percobaan salah
  useEffect(() => {
    if (!locked) return
    const tick = () => setWait(Math.ceil(cooldownLeft() / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [locked])

  if (!locked) return <>{children}</>

  return (
    <div className="pt-safe pb-safe fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background px-6">
      <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground" aria-hidden>
        <Wallet className="size-7" />
      </span>
      <PinPad
        title={t('lock.enter')}
        subtitle={wait > 0 ? t('lock.wait', { s: wait }) : undefined}
        error={error}
        disabled={wait > 0}
        onComplete={async (pin) => {
          const res = await verifyPin(pin)
          if (res === 'ok') {
            setError(null)
            setLocked(false)
            return true
          }
          setError(res === 'cooldown' ? t('lock.tooMany') : t('lock.wrong'))
          setWait(Math.ceil(cooldownLeft() / 1000))
          return false
        }}
      />
    </div>
  )
}
