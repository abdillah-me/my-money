import { useSyncExternalStore } from 'react'

/** Event non-standar dari Chromium (Android / desktop) untuk memicu dialog install */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

// Didaftarkan saat modul dimuat (lebih awal dari render) karena event bisa muncul sebelum halaman Profil dibuka
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
  window.matchMedia('(display-mode: standalone)').addEventListener('change', emit)
}

export function isStandalone() {
  return (
    installed ||
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS() {
  const ua = navigator.userAgent
  // iPadOS 13+ mengaku sebagai Mac, deteksi lewat dukungan touch
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
}

type Snapshot = { canPrompt: boolean; standalone: boolean }
let snapshot: Snapshot = { canPrompt: false, standalone: false }

function getSnapshot(): Snapshot {
  const next = { canPrompt: deferred !== null, standalone: isStandalone() }
  if (next.canPrompt !== snapshot.canPrompt || next.standalone !== snapshot.standalone) snapshot = next
  return snapshot
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Status kemampuan install PWA + fungsi untuk memunculkan dialog install bawaan browser */
export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, getSnapshot)

  const promptInstall = async (): Promise<boolean> => {
    if (!deferred) return false
    const e = deferred
    await e.prompt()
    const { outcome } = await e.userChoice
    // Event hanya bisa dipakai sekali
    deferred = null
    emit()
    return outcome === 'accepted'
  }

  return { ...state, ios: isIOS(), promptInstall }
}
