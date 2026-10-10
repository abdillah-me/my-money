import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

interface MonthCtx {
  year: number
  month: number
  shift: (delta: number) => void
  isCurrent: boolean
}

const Ctx = createContext<MonthCtx | null>(null)

/** Bulan aktif dibagi antara Beranda, Analisis, dan Laporan */
export function MonthProvider({ children }: { children: ReactNode }) {
  const now = new Date()
  const [ym, setYm] = useState({ year: now.getFullYear(), month: now.getMonth() })

  const value = useMemo<MonthCtx>(() => {
    const today = new Date()
    return {
      ...ym,
      isCurrent: ym.year === today.getFullYear() && ym.month === today.getMonth(),
      shift: (delta) =>
        setYm((s) => {
          const d = new Date(s.year, s.month + delta, 1)
          return { year: d.getFullYear(), month: d.getMonth() }
        }),
    }
  }, [ym])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMonth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMonth must be used inside MonthProvider')
  return ctx
}
