import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PinPad from '@/components/PinPad'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { clearPin, setPin, verifyPin } from '@/lib/lock'
import { useSettings } from '@/lib/settings'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** enable = buat PIN baru (2x), disable = verifikasi PIN lama lalu hapus */
  mode: 'enable' | 'disable'
  onDone: () => void
}

export default function PinSetup({ open, onOpenChange, mode, onDone }: Props) {
  const { t } = useSettings()
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setFirst(null)
      setError(null)
    }
  }, [open])

  const title = mode === 'disable' ? t('lock.enterCurrent') : first ? t('lock.confirm') : t('lock.create')

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{t('lock.desc')}</DrawerDescription>
        </DrawerHeader>
        <div className="pb-safe px-4 pt-4">
          <PinPad
            key={`${mode}-${first ?? ''}`}
            title={title}
            subtitle={mode === 'enable' && !first ? t('lock.desc') : undefined}
            error={error}
            onComplete={async (pin) => {
              if (mode === 'disable') {
                const res = await verifyPin(pin)
                if (res !== 'ok') {
                  setError(res === 'cooldown' ? t('lock.tooMany') : t('lock.wrong'))
                  return false
                }
                clearPin()
                toast.success(t('lock.disabled'))
              } else if (!first) {
                setFirst(pin)
                setError(null)
                return
              } else if (pin !== first) {
                setFirst(null)
                setError(t('lock.mismatch'))
                return false
              } else {
                await setPin(pin)
                toast.success(t('lock.enabled'))
              }
              onDone()
              onOpenChange(false)
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
