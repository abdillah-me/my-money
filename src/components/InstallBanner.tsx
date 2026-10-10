import { Smartphone, X } from 'lucide-react'
import { useState } from 'react'
import InstallButton from '@/components/InstallButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useInstallPrompt } from '@/lib/pwa'
import { useSettings } from '@/lib/settings'

const KEY = 'wahduid.installDismissed'

/** Ajakan install di Beranda. Disembunyikan bila sudah terinstal atau pernah ditutup. */
export default function InstallBanner() {
  const { t } = useSettings()
  const { standalone } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(KEY) === '1')

  if (standalone || dismissed) return null

  const dismiss = () => {
    localStorage.setItem(KEY, '1')
    setDismissed(true)
  }

  return (
    <Card className="mx-5 mt-6 flex-row items-center gap-3 rounded-3xl bg-secondary px-4 py-3 shadow-none ring-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-primary" aria-hidden>
        <Smartphone className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs text-secondary-foreground">{t('pwa.installDesc')}</p>
        <InstallButton size="sm" className="rounded-full" />
      </div>
      <Button variant="ghost" size="icon" className="size-8 self-start text-secondary-foreground" onClick={dismiss} aria-label={t('pwa.later')}>
        <X className="size-4" aria-hidden />
      </Button>
    </Card>
  )
}
