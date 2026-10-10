import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ConfirmProvider } from './components/confirm'
import { Toaster } from './components/ui/sonner'
import { SettingsProvider } from './lib/settings'
import { MonthProvider } from './lib/month'
// Dimuat sedini mungkin agar event `beforeinstallprompt` tidak terlewat
import './lib/pwa'
import './index.css'

// Data hanya ada di IndexedDB perangkat: minta penyimpanan persisten agar tidak dihapus otomatis
// oleh browser saat ruang penyimpanan menipis. Browser bisa menolak; aplikasi tetap berjalan.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <MonthProvider>
          <ConfirmProvider>
            <App />
            {/*
              Toast di bawah, tepat di atas bottom navigation, agar tidak menutupi header
              maupun Dynamic Island / notch. Offset ikut safe area home indicator.
            */}
            <Toaster
              position="bottom-center"
              richColors
              offset={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
              mobileOffset={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)', left: '12px', right: '12px' }}
            />
          </ConfirmProvider>
        </MonthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
