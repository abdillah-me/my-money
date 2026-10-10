import type { Category } from '@/db/db'
import { cn } from '@/lib/utils'

/** Lingkaran ikon emoji kategori dengan latar warna kategori (transparan) */
export default function CategoryIcon({ category, className }: { category?: Pick<Category, 'icon' | 'color'>; className?: string }) {
  return (
    <span
      className={cn('grid size-11 shrink-0 place-items-center rounded-full text-xl', className)}
      style={{ backgroundColor: `${category?.color ?? '#94a3b8'}22` }}
      aria-hidden
    >
      {category?.icon ?? '❔'}
    </span>
  )
}
