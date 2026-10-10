import { useEffect, useRef, useState } from 'react'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Getar singkat sebagai umpan balik sentuh (Android). iOS Safari tidak mendukung — diabaikan tanpa error. */
export function haptic(pattern: number | number[] = 8) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // tidak didukung
  }
}

/**
 * Angka yang beranimasi dari nilai sebelumnya ke nilai baru (efek "count-up").
 * Mengembalikan nilai akhir langsung bila pengguna memilih "Kurangi gerakan".
 */
export function useAnimatedNumber(value: number, duration = 650) {
  const [display, setDisplay] = useState(value)
  const from = useRef(value)
  const frame = useRef(0)

  useEffect(() => {
    if (reducedMotion() || from.current === value) {
      from.current = value
      setDisplay(value)
      return
    }
    const start = performance.now()
    const a = from.current
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      // easeOutCubic
      const eased = 1 - (1 - p) ** 3
      setDisplay(a + (value - a) * eased)
      if (p < 1) frame.current = requestAnimationFrame(step)
      else from.current = value
    }
    frame.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame.current)
      from.current = value
    }
  }, [value, duration])

  return display
}
