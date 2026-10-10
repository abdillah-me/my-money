import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useSettings } from './lib/settings'
import { runRecurring } from './lib/recurring'
import AppLock from './components/AppLock'
import Layout from './components/Layout'
import UpdatePrompt from './components/UpdatePrompt'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Transactions from './pages/Transactions'
import Profile from './pages/Profile'
import Categories from './pages/Categories'
import Wallets from './pages/Wallets'

// Halaman yang jarang dibuka / berat (Recharts) dimuat terpisah agar bundle awal lebih kecil
const TransactionForm = lazy(() => import('./pages/TransactionForm'))
const Analyze = lazy(() => import('./pages/Analyze'))
const Report = lazy(() => import('./pages/Report'))
const Budget = lazy(() => import('./pages/Budget'))
const SplitBills = lazy(() => import('./pages/SplitBills'))
const SplitBillForm = lazy(() => import('./pages/SplitBillForm'))
const Notes = lazy(() => import('./pages/Notes'))
const NoteForm = lazy(() => import('./pages/NoteForm'))
const Debts = lazy(() => import('./pages/Debts'))
const Recurring = lazy(() => import('./pages/Recurring'))

/** Pembungkus halaman non-tab: animasi masuk diputar ulang tiap pindah halaman */
function PageShell() {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="page-enter">
      <Outlet />
    </div>
  )
}

/** Buat transaksi berulang yang jatuh tempo saat aplikasi dibuka / kembali aktif */
function useRecurringRunner(enabled: boolean) {
  const { t } = useSettings()
  useEffect(() => {
    if (!enabled) return
    const run = () =>
      runRecurring()
        .then((n) => n > 0 && toast.success(t('recurring.created', { n })))
        .catch(() => {})
    run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [enabled, t])
}

export default function App() {
  const { settings } = useSettings()
  useRecurringRunner(settings.onboarded)

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background">
      {!settings.onboarded ? (
        <Onboarding />
      ) : (
        <AppLock>
          <Suspense fallback={null}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="analyze" element={<Analyze />} />
                <Route path="report" element={<Report />} />
                <Route path="wallets" element={<Wallets />} />
                <Route path="profile" element={<Profile />} />
              </Route>
              {/* Halaman detail/form (tanpa bottom nav) juga mendapat animasi masuk */}
              <Route element={<PageShell />}>
                <Route path="transactions/new" element={<TransactionForm />} />
                <Route path="transactions/:id" element={<TransactionForm />} />
                <Route path="profile/categories" element={<Categories />} />
                <Route path="budget" element={<Budget />} />
                <Route path="debts" element={<Debts />} />
                <Route path="recurring" element={<Recurring />} />
                <Route path="split-bill" element={<SplitBills />} />
                <Route path="split-bill/new" element={<SplitBillForm />} />
                <Route path="split-bill/:id" element={<SplitBillForm />} />
                <Route path="note" element={<Notes />} />
                <Route path="note/new" element={<NoteForm />} />
                <Route path="note/:id" element={<NoteForm />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppLock>
      )}
      <UpdatePrompt />
    </div>
  )
}
