import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useGoBack } from '@/lib/nav'
import { useSettings } from '@/lib/settings'

interface Props {
  title: string
  right?: ReactNode
  /** Tujuan saat tombol kembali ditekan jika tidak ada riwayat */
  fallback?: string
  /** Sembunyikan tombol kembali (halaman tab utama) */
  hideBack?: boolean
}

export default function PageHeader({ title, right, fallback = '/', hideBack }: Props) {
  const back = useGoBack(fallback)
  const { t } = useSettings()

  return (
    <header className="pt-safe sticky top-0 z-20 grid grid-cols-[2.75rem_1fr_auto] items-center gap-2 bg-background/90 px-4 pb-3 backdrop-blur">
      {hideBack ? (
        <span />
      ) : (
        <Button variant="ghost" size="icon" onClick={back} aria-label={t('common.back')}>
          <ArrowLeft aria-hidden />
        </Button>
      )}
      <h1 className="truncate text-center text-lg font-semibold">{title}</h1>
      <div className="flex min-w-11 justify-end">{right}</div>
    </header>
  )
}
