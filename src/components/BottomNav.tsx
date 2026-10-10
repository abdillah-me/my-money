import { BarChart3, Home, Plus, User, Wallet } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import type { DictKey } from '@/lib/i18n'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

const left: { to: string; label: DictKey; Icon: typeof Home; end?: boolean }[] = [
  { to: '/', label: 'nav.home', Icon: Home, end: true },
  { to: '/analyze', label: 'nav.stats', Icon: BarChart3 },
]
const right: typeof left = [
  { to: '/wallets', label: 'nav.wallets', Icon: Wallet },
  { to: '/profile', label: 'nav.profile', Icon: User },
]

export default function BottomNav() {
  const { t } = useSettings()

  const item = ({ isActive }: { isActive: boolean }) =>
    cn(
      'grid size-11 place-items-center rounded-full transition-colors',
      isActive ? 'bg-primary text-primary-foreground' : 'text-white/75 hover:text-white',
    )

  const render = (list: typeof left) =>
    list.map(({ to, label, Icon, end }) => (
      <NavLink key={to} to={to} end={end} className={item} aria-label={t(label)} title={t(label)}>
        <Icon className="size-5" aria-hidden />
      </NavLink>
    ))

  return (
    <nav aria-label="Main" className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center">
      <div className="pointer-events-auto mb-2 flex items-center gap-1.5 rounded-full bg-slate-900 p-1.5 shadow-xl dark:bg-slate-800">
        {render(left)}
        <Link
          to="/transactions/new"
          aria-label={t('nav.add')}
          className="mx-1 grid size-12 place-items-center rounded-full bg-white text-slate-900 transition-transform hover:bg-secondary active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2.5} aria-hidden />
        </Link>
        {render(right)}
      </div>
    </nav>
  )
}
