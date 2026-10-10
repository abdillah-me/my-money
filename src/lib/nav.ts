import { useNavigate } from 'react-router-dom'

/** Kembali ke halaman sebelumnya, atau ke `fallback` jika halaman dibuka langsung */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
