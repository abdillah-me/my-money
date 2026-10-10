import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useSettings } from '@/lib/settings'

/** Registrasi service worker + notifikasi siap offline, versi baru, dan status koneksi */
export default function UpdatePrompt() {
  const { t } = useSettings()
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Cek pembaruan tiap jam saat aplikasi terbuka lama (umum pada PWA terinstal)
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    toast.success(t('offline.ready'))
    setOfflineReady(false)
  }, [offlineReady, setOfflineReady, t])

  useEffect(() => {
    if (!needRefresh) return
    toast(t('update.available'), {
      duration: Infinity,
      action: { label: t('update.reload'), onClick: () => updateServiceWorker(true) },
      onDismiss: () => setNeedRefresh(false),
    })
  }, [needRefresh, setNeedRefresh, updateServiceWorker, t])

  useEffect(() => {
    const onOffline = () => toast.warning(t('pwa.offline'), { id: 'offline' })
    const onOnline = () => toast.dismiss('offline')
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [t])

  return null
}
