import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface Props {
  icon: LucideIcon
  text: string
  action?: { to: string; label: string }
}

export default function EmptyState({ icon: Icon, text, action }: Props) {
  return (
    <div className="mt-16 flex flex-col items-center gap-4 px-8 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-secondary text-primary">
        <Icon className="size-9" aria-hidden />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
      {action && (
        <Button asChild className="rounded-full">
          <Link to={action.to}>{action.label}</Link>
        </Button>
      )}
    </div>
  )
}
