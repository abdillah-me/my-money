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
            <Toaster position="top-center" richColors />
          </ConfirmProvider>
        </MonthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </StrictMode>,
)
