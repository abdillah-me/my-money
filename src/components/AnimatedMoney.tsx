import { useAnimatedNumber } from '@/lib/motion'
import { fractionDigits } from '@/lib/format'
import { useSettings } from '@/lib/settings'

interface Props {
  value: number
  /** Tampilkan •••••• (mode sembunyikan saldo) */
  masked?: boolean
  className?: string
}

/** Nominal uang dengan animasi count-up saat nilainya berubah */
export default function AnimatedMoney({ value, masked, className }: Props) {
  const { settings, money } = useSettings()
  const animated = useAnimatedNumber(value)
  const decimals = fractionDigits(settings.currency)
  const rounded = Math.round(animated * 10 ** decimals) / 10 ** decimals

  return (
    // tabular-nums: lebar angka tetap sehingga teks tidak "bergoyang" saat beranimasi
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {masked ? '••••••' : money(rounded)}
      {/* Pembaca layar membaca nilai akhir, bukan setiap frame animasi */}
      <span className="sr-only">{masked ? '' : ` (${money(value)})`}</span>
    </span>
  )
}
