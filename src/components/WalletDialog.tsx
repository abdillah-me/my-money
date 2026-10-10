import { Check } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { CATEGORY_COLORS } from '@/components/CategoryDialog'
import MoneyInput from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { insert, patch, type Wallet } from '@/db/db'
import { useWalletName } from '@/db/hooks'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

const ICONS = ['💵', '🏦', '💳', '📱', '🐷', '💰', '🪙', '👛', '🏧', '📈']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  wallet?: Wallet
}

export default function WalletDialog({ open, onOpenChange, wallet }: Props) {
  const { t } = useSettings()
  const walletName = useWalletName()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[1])
  const [color, setColor] = useState(CATEGORY_COLORS[3])
  const [initial, setInitial] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(wallet ? walletName(wallet) : '')
    setIcon(wallet?.icon ?? ICONS[1])
    setColor(wallet?.color ?? CATEGORY_COLORS[3])
    setInitial(wallet?.initial ?? 0)
    setError(null)
    // walletName hanya dibaca saat dialog dibuka
  }, [open, wallet])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError(t('cat.nameError'))
    if (wallet) {
      const keepBuiltin = wallet.builtin && trimmed === walletName(wallet)
      // `builtin: undefined` menghapus kunci terjemahan bila nama diganti user
      await patch('wallets', wallet.id, { name: keepBuiltin ? '' : trimmed, icon, color, initial, builtin: keepBuiltin ? wallet.builtin : undefined })
    } else {
      await insert('wallets', { name: trimmed, icon, color, initial }, { keep: ['initial'] })
    }
    toast.success(t('common.saved'))
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="mx-auto max-w-md">
        <form onSubmit={save}>
          <DrawerHeader>
            <DrawerTitle className="text-lg font-semibold">{wallet ? t('wallet.edit') : t('wallet.add')}</DrawerTitle>
            <DrawerDescription>{t('wallet.desc')}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4">
            <div className="flex items-end gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full text-xl" style={{ backgroundColor: `${color}22` }} aria-hidden>
                {icon}
              </span>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="w-name">{t('wallet.name')}</Label>
                <Input
                  id="w-name"
                  value={name}
                  maxLength={30}
                  placeholder={t('wallet.namePlaceholder')}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                  aria-invalid={!!error}
                />
              </div>
            </div>
            {error && <p className="-mt-2 text-xs text-destructive">{error}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="w-initial">{t('wallet.initial')}</Label>
              <MoneyInput id="w-initial" value={initial} onValueChange={setInitial} />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('cat.icon')}</legend>
              <div className="grid grid-cols-5 gap-1.5">
                {ICONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={icon === e}
                    aria-label={e}
                    onClick={() => setIcon(e)}
                    className={cn('grid h-11 place-items-center rounded-xl text-xl', icon === e ? 'bg-secondary ring-2 ring-primary' : 'bg-muted')}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('cat.color')}</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                    className="grid size-9 place-items-center rounded-full text-white ring-offset-2 ring-offset-background aria-pressed:ring-2 aria-pressed:ring-foreground"
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check className="size-4" aria-hidden />}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <DrawerFooter className="pb-safe flex-row">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="lg" className="flex-1">
              {t('common.save')}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
