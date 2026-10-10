import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

/** Progress anggaran: hijau < 80%, kuning 80–100%, merah > 100% */
export default function BudgetBar({ pct, label }: { pct: number; label: string }) {
  const color = pct > 100 ? '*:bg-expense' : pct >= 80 ? '*:bg-amber-400' : '*:bg-primary'
  return <Progress value={Math.min(pct, 100)} aria-label={label} className={cn('h-2', color)} />
}
