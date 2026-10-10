import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSettings } from './lib/settings'
import Layout from './components/Layout'
import UpdatePrompt from './components/UpdatePrompt'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import Transactions from './pages/Transactions'
import TransactionForm from './pages/TransactionForm'
import Profile from './pages/Profile'
import Categories from './pages/Categories'

// Halaman yang jarang dibuka / berat (Recharts) dimuat terpisah agar bundle awal lebih kecil
const Analyze = lazy(() => import('./pages/Analyze'))
const Report = lazy(() => import('./pages/Report'))
const Budget = lazy(() => import('./pages/Budget'))
const SplitBills = lazy(() => import('./pages/SplitBills'))
const SplitBillForm = lazy(() => import('./pages/SplitBillForm'))
const Notes = lazy(() => import('./pages/Notes'))
const NoteForm = lazy(() => import('./pages/NoteForm'))

export default function App() {
  const { settings } = useSettings()

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-background">
      {!settings.onboarded ? (
        <Onboarding />
      ) : (
        <Suspense fallback={null}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="analyze" element={<Analyze />} />
              <Route path="report" element={<Report />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route path="transactions/new" element={<TransactionForm />} />
            <Route path="transactions/:id" element={<TransactionForm />} />
            <Route path="profile/categories" element={<Categories />} />
            <Route path="budget" element={<Budget />} />
            <Route path="split-bill" element={<SplitBills />} />
            <Route path="split-bill/new" element={<SplitBillForm />} />
            <Route path="split-bill/:id" element={<SplitBillForm />} />
            <Route path="note" element={<Notes />} />
            <Route path="note/new" element={<NoteForm />} />
            <Route path="note/:id" element={<NoteForm />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      )}
      <UpdatePrompt />
    </div>
  )
}
