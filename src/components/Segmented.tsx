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
      className={cn('@container grid w-full auto-cols-fr grid-flow-col rounded-[1.5rem] bg-muted p-1', className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            // Label boleh turun ke 2 baris (bukan dipotong "…") saat teks diperbesar / layar sempit
            // Ukuran label mengikuti lebar kontrol (container query): kata panjang seperti "Pengeluaran"
            // tetap muat utuh walau teks diperbesar atau layar sempit
            'h-auto min-h-10 min-w-0 shrink rounded-[1.25rem] px-1 py-1.5 text-center text-[min(0.875rem,4.3cqw)] leading-tight font-semibold whitespace-nowrap text-muted-foreground transition-all duration-200 hover:bg-transparent data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm',
            o.activeClassName,
          )}
        >
          <span>{o.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
