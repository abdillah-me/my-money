import { Check } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { db, type Category, type TxType } from '@/db/db'
import { useCategoryName } from '@/db/hooks'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export const CATEGORY_COLORS = ['#16a34a', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#64748b']

const EMOJIS = ['🍜', '🍔', '☕', '🛒', '🛍️', '🚗', '🛵', '⛽', '🏠', '💡', '📱', '🎮', '🎬', '✈️', '💊', '🏋️', '📚', '🎓', '🐶', '👶', '🎁', '💼', '💰', '💵', '🏷️', '📈', '🧾', '💳', '🔧', '📦']

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kategori yang diedit. Kosong = tambah baru. */
  category?: Category
  /** Tipe awal untuk kategori baru */
  defaultType?: TxType
  /** Kunci tipe (mis. saat dibuka dari form transaksi) */
  lockType?: boolean
  onSaved?: (id: number) => void
}

/** Bottom sheet untuk menambah / mengubah kategori. Dipakai di form transaksi & halaman kategori. */
export default function CategoryDialog({ open, onOpenChange, category, defaultType = 'expense', lockType, onSaved }: Props) {
  const { t } = useSettings()
  const catName = useCategoryName()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(EMOJIS[0])
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [type, setType] = useState<TxType>(defaultType)
  const [error, setError] = useState<string | null>(null)

  // Reset isi form setiap kali dibuka
  useEffect(() => {
    if (!open) return
    setName(category ? catName(category) : '')
    setIcon(category?.icon ?? EMOJIS[0])
    setColor(category?.color ?? CATEGORY_COLORS[0])
    setType(category?.type ?? defaultType)
    setError(null)
    // catName sengaja tidak dimasukkan: hanya perlu dibaca saat dialog dibuka
  }, [open, category, defaultType])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError(t('cat.nameError'))
    const data: Omit<Category, 'id'> = { name: trimmed, icon: icon.trim() || '📌', color, type }

    let id: number
    if (category?.id !== undefined) {
      // Nama bawaan diganti user -> lepas kunci terjemahan agar nama baru dipakai
      const keepBuiltin = category.builtin && trimmed === catName(category)
      await db.categories.update(category.id, { ...data, builtin: keepBuiltin ? category.builtin : undefined })
      id = category.id
    } else {
      id = (await db.categories.add(data)) as number
      toast.success(t('cat.added'))
    }
    onSaved?.(id)
    onOpenChange(false)
  }

  const isEdit = category?.id !== undefined

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="mx-auto max-w-md">
        <form onSubmit={save} className="flex min-h-0 flex-col">
          <DrawerHeader>
            <DrawerTitle>{isEdit ? t('cat.edit') : t('cat.add')}</DrawerTitle>
            <DrawerDescription className="sr-only">{t('cat.title')}</DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 overflow-y-auto px-4">
            {!lockType && !isEdit && (
              <Tabs value={type} onValueChange={(v) => setType(v as TxType)}>
                <TabsList className="h-10 w-full">
                  <TabsTrigger value="expense">{t('common.expense')}</TabsTrigger>
                  <TabsTrigger value="income">{t('common.income')}</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="flex items-end gap-3">
              <span
                className="grid size-11 shrink-0 place-items-center rounded-full text-xl"
                style={{ backgroundColor: `${color}22` }}
                aria-hidden
              >
                {icon}
              </span>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="cat-name">{t('cat.name')}</Label>
                <Input
                  id="cat-name"
                  value={name}
                  maxLength={30}
                  onChange={(e) => {
                    setName(e.target.value)
                    setError(null)
                  }}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'cat-name-err' : undefined}
                />
              </div>
            </div>
            {error && (
              <p id="cat-name-err" className="-mt-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('cat.icon')}</legend>
              <div className="grid grid-cols-8 gap-1.5">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={icon === e}
                    aria-label={e}
                    onClick={() => setIcon(e)}
                    className={cn(
                      'grid aspect-square place-items-center rounded-xl text-lg transition',
                      icon === e ? 'bg-secondary ring-2 ring-primary' : 'bg-muted hover:bg-secondary',
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <Input
                aria-label={t('cat.emojiCustom')}
                placeholder={t('cat.emojiCustom')}
                value={EMOJIS.includes(icon) ? '' : icon}
                onChange={(e) => {
                  const chars = [...e.target.value]
                  if (chars.length) setIcon(chars.slice(-2).join(''))
                }}
                className="h-10"
              />
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
