import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

interface Option<T extends string> {
  value: T
  label: string
  /** Kelas tambahan saat aktif, mis. warna pemasukan/pengeluaran */
  activeClassName?: string
}

interface Props<T extends string> {
  value: T
  onValueChange: (value: T) => void
  options: Option<T>[]
  label: string
  className?: string
}

/** Segmented control (pill) berbasis shadcn ToggleGroup — selalu ada satu pilihan aktif */
export default function Segmented<T extends string>({ value, onValueChange, options, label, className }: Props<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      // Abaikan "deselect" agar selalu ada nilai terpilih
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      spacing={1}
      className={cn('grid w-full auto-cols-fr grid-flow-col rounded-full bg-muted p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            // min-w-0 + truncate: label panjang tidak meluber di layar sempit (mis. 320px)
            'h-9 min-w-0 shrink rounded-full px-1.5 text-xs font-semibold text-muted-foreground hover:bg-transparent min-[360px]:px-2 min-[360px]:text-[13px] min-[400px]:text-sm data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm [&>span]:truncate',
            o.activeClassName,
          )}
        >
          <span>{o.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
