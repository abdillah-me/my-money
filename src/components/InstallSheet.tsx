import { MoreVertical, Plus, Share, SquarePlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useInstallPrompt } from '@/lib/pwa'
import { useSettings } from '@/lib/settings'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Panduan install untuk browser yang tidak mendukung dialog install otomatis
 * (Safari iOS, atau browser lain saat event `beforeinstallprompt` tidak tersedia).
 */
export default function InstallSheet({ open, onOpenChange }: Props) {
  const { t } = useSettings()
  const { ios } = useInstallPrompt()

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader>
          <DrawerTitle className="text-lg font-semibold">{ios ? t('pwa.iosTitle') : t('pwa.manualTitle')}</DrawerTitle>
          <DrawerDescription>{t('pwa.installDesc')}</DrawerDescription>
        </DrawerHeader>

        {ios ? (
          <ol className="space-y-3 px-4">
            <Step n={1} icon={<Share className="size-4" />}>
              {t('pwa.iosStep1')}
            </Step>
            <Step n={2} icon={<SquarePlus className="size-4" />}>
              {t('pwa.iosStep2')}
            </Step>
            <Step n={3} icon={<Plus className="size-4" />}>
              {t('pwa.iosStep3')}
            </Step>
          </ol>
        ) : (
          <div className="flex items-start gap-3 px-4 text-sm">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary" aria-hidden>
              <MoreVertical className="size-4" />
            </span>
            <p className="text-muted-foreground">{t('pwa.manualDesc')}</p>
          </div>
        )}

        <DrawerFooter className="pb-safe">
          <Button size="lg" onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5 text-sm">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {n}
      </span>
      <span className="flex-1">{children}</span>
      <span className="text-primary" aria-hidden>
        {icon}
      </span>
    </li>
  )
}
