import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type DictKey, type Lang } from './i18n'
import { formatMoney, type Currency } from './format'

export type Theme = 'light' | 'dark' | 'system'
export type TextSize = 'normal' | 'large' | 'xlarge'

/** Skala ukuran root font; semua ukuran Tailwind berbasis rem sehingga ikut membesar */
const TEXT_SCALE: Record<TextSize, string> = { normal: '100%', large: '112.5%', xlarge: '125%' }

export interface Settings {
  name: string
  lang: Lang
  currency: Currency
  onboarded: boolean
  hideBalance: boolean
  theme: Theme
  /** Ukuran teks untuk keterbacaan (mis. pengguna lanjut usia) */
  textSize: TextSize
  /** Kategori terakhir per tipe, dipilih otomatis di form transaksi */
  lastCategory: { income?: number; expense?: number }
  /** Dompet terakhir dipakai */
  lastWallet?: number
}

const STORAGE_KEY = 'wahduid.settings'

const defaults: Settings = {
  name: '',
  lang: navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en',
  currency: 'IDR',
  onboarded: false,
  hideBalance: false,
  theme: 'system',
  textSize: 'normal',
  lastCategory: {},
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...defaults,
      ...parsed,
      lang: parsed.lang === 'en' || parsed.lang === 'id' ? parsed.lang : defaults.lang,
      currency: parsed.currency === 'USD' || parsed.currency === 'IDR' ? parsed.currency : defaults.currency,
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'system',
      textSize: parsed.textSize === 'large' || parsed.textSize === 'xlarge' ? parsed.textSize : 'normal',
      lastCategory: parsed.lastCategory && typeof parsed.lastCategory === 'object' ? parsed.lastCategory : {},
    }
  } catch {
    return defaults
  }
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && darkQuery.matches)
  document.documentElement.classList.toggle('dark', dark)
  // Warna status bar / title bar mengikuti tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1210' : '#16a34a')
}

interface SettingsCtx {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  t: (key: DictKey, vars?: Record<string, string | number>) => string
  money: (amount: number) => string
}

const Ctx = createContext<SettingsCtx | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    document.documentElement.lang = settings.lang
  }, [settings])

  useEffect(() => {
    document.documentElement.style.fontSize = TEXT_SCALE[settings.textSize]
  }, [settings.textSize])

  useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== 'system') return
    const onChange = () => applyTheme('system')
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [settings.theme])

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), [])

  const value = useMemo<SettingsCtx>(
    () => ({
      settings,
      update,
      t: (key, vars) => translate(settings.lang, key, vars),
      money: (amount) => formatMoney(amount, settings.currency, settings.lang),
    }),
    [settings, update],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSettings() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
