import { Download } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import InstallSheet from '@/components/InstallSheet'
import { Button } from '@/components/ui/button'
import { useInstallPrompt } from '@/lib/pwa'
import { useSettings } from '@/lib/settings'

/**
 * Tombol "Install aplikasi". Memakai dialog bawaan browser bila tersedia (Chrome/Edge Android & desktop),
 * jika tidak, menampilkan panduan manual (Safari iOS dll). Tidak dirender bila sudah terinstal.
 */
export default function InstallButton(props: ComponentProps<typeof Button>) {
  const { t } = useSettings()
  const { canPrompt, standalone, promptInstall } = useInstallPrompt()
  const [guide, setGuide] = useState(false)

  if (standalone) return null

  return (
    <>
      <Button
        {...props}
        onClick={async () => {
          if (canPrompt) await promptInstall()
          else setGuide(true)
        }}
      >
        <Download data-icon="inline-start" aria-hidden />
        {t('pwa.install')}
      </Button>
      <InstallSheet open={guide} onOpenChange={setGuide} />
    </>
  )
}
