import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type DictKey, type Lang } from './i18n'
import { formatMoney, type Currency } from './format'

export interface Settings {
  name: string
  lang: Lang
  currency: Currency
  onboarded: boolean
  hideBalance: boolean
}

const STORAGE_KEY = 'wahduid.settings'

const defaults: Settings = {
  name: '',
  lang: navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en',
  currency: 'IDR',
  onboarded: false,
  hideBalance: false,
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
    }
  } catch {
    return defaults
  }
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
