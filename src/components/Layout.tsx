import { Outlet, useLocation } from 'react-router-dom'
import BottomNav from './BottomNav'

/** Layout untuk halaman utama yang menampilkan bottom navigation */
export default function Layout() {
  const { pathname } = useLocation()
  return (
    <>
      {/* Ruang bawah = tinggi bottom nav + tombol tambah + safe area home indicator */}
      <main className="pb-[calc(7rem+var(--safe-bottom))]">
        {/* key = pathname: animasi masuk diputar ulang setiap pindah tab */}
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </>
  )
}
