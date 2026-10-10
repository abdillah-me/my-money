import { Home, Plus, User } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export default function BottomNav() {
  const { t } = useSettings()

  const item = ({ isActive }: { isActive: boolean }) =>
    cn(
      'grid size-11 place-items-center rounded-full transition-colors',
      isActive ? 'bg-primary text-primary-foreground' : 'text-white/80 hover:text-white',
    )

  return (
    <nav aria-label="Main" className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
      <div className="pointer-events-auto mb-2 flex items-center gap-3 rounded-full bg-slate-900 p-1.5 shadow-xl">
        <NavLink to="/" end className={item} aria-label={t('nav.home')}>
          <Home className="size-5" aria-hidden />
        </NavLink>
        <Link
          to="/transactions/new"
          aria-label={t('nav.add')}
          className="grid size-11 place-items-center rounded-full bg-white text-slate-900 transition-colors hover:bg-secondary"
        >
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
        </Link>
        <NavLink to="/profile" className={item} aria-label={t('nav.profile')}>
          <User className="size-5" aria-hidden />
        </NavLink>
      </div>
    </nav>
  )
}
