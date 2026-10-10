import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

/** Layout untuk halaman utama yang menampilkan bottom navigation */
export default function Layout() {
  return (
    <>
      <main className="pb-32">
        <Outlet />
      </main>
      <BottomNav />
    </>
  )
}
