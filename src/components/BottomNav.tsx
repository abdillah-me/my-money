import { BarChart3, Home, Plus, User, Wallet } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import type { DictKey } from '@/lib/i18n'
import { haptic } from '@/lib/motion'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

type Item = { to: string; label: DictKey; Icon: typeof Home; end?: boolean }

const left: Item[] = [
  { to: '/', label: 'nav.home', Icon: Home, end: true },
  { to: '/analyze', label: 'nav.stats', Icon: BarChart3 },
]
const right: Item[] = [
  { to: '/wallets', label: 'nav.wallets', Icon: Wallet },
  { to: '/profile', label: 'nav.profile', Icon: User },
]

/**
 * Navigasi bawah bergaya Material 3: menempel penuh di bawah layar, ikon + label teks
 * (lebih mudah dipahami semua kalangan), area sentuh besar, dan tombol tambah menonjol di tengah.
 */
export default function BottomNav() {
  const { t } = useSettings()

  const tab = ({ to, label, Icon, end }: Item) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={() => haptic()}
      className="group flex min-h-16 min-w-0 flex-1 flex-col items-center justify-end gap-1 rounded-2xl pb-2 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-foreground"
    >
      {({ isActive }) => (
        <>
          <span className="relative grid h-8 w-16 place-items-center">
            {/* Indikator aktif: pil yang melebar dari tengah */}
            <span
              aria-hidden
              className={cn(
                'absolute inset-0 rounded-full bg-secondary transition-all duration-300 ease-[var(--ease-spring)]',
                isActive ? 'scale-x-100 opacity-100' : 'scale-x-50 opacity-0',
              )}
            />
            <Icon
              className={cn(
                'relative size-6 transition-transform duration-300 group-active:scale-90',
                isActive && 'text-primary',
              )}
              strokeWidth={isActive ? 2.4 : 2}
              aria-hidden
            />
          </span>
          <span className={cn('text-xs leading-none transition-colors', isActive ? 'font-semibold text-primary' : 'font-medium')}>
            {t(label)}
          </span>
        </>
      )}
    </NavLink>
  )

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md rounded-t-3xl border-t bg-card/95 px-2 pt-1.5 shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.18)] backdrop-blur-lg"
    >
      <div className="flex items-end">
        {left.map(tab)}
        {/* Tombol tambah: paling sering dipakai, jadi paling besar dan di tengah */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <Link
            to="/transactions/new"
            onClick={() => haptic(12)}
            aria-label={t('nav.add')}
            className="-mt-7 grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 ring-4 ring-background transition-transform duration-200 hover:scale-105 active:scale-95"
          >
            <Plus className="size-8" strokeWidth={2.5} aria-hidden />
          </Link>
          <span className="pb-2 text-xs leading-none font-medium text-muted-foreground" aria-hidden>
            {t('nav.addShort')}
          </span>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  )
}
