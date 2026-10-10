import { useEffect, useState, type ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { fractionDigits, localeOf, parseAmount } from '@/lib/format'
import { useSettings } from '@/lib/settings'

type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: number
  onValueChange: (value: number) => void
  /** Pakai elemen input polos (tanpa gaya shadcn) untuk tampilan nominal besar */
  bare?: boolean
}

/** Input nominal sesuai mata uang aktif. IDR ditampilkan dengan pemisah ribuan. */
export default function MoneyInput({ value, onValueChange, bare, ...rest }: Props) {
  const { settings } = useSettings()
  const decimals = fractionDigits(settings.currency)
  const [raw, setRaw] = useState(value ? String(value) : '')

  // Sinkronkan jika nilai diubah dari luar (mis. data dimuat)
  useEffect(() => {
    setRaw((r) => (parseAmount(r, decimals) === value ? r : value ? String(value) : ''))
  }, [value, decimals])

  const display =
    decimals === 0 && raw ? new Intl.NumberFormat(localeOf(settings.lang)).format(parseAmount(raw, 0)) : raw

  const props = {
    ...rest,
    inputMode: decimals === 0 ? ('numeric' as const) : ('decimal' as const),
    value: display,
    placeholder: rest.placeholder ?? '0',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = decimals === 0 ? e.target.value.replace(/\D/g, '') : e.target.value.replace(/[^\d.,]/g, '')
      setRaw(next)
      onValueChange(parseAmount(next, decimals))
    },
  }

  return bare ? <input {...props} /> : <Input {...props} />
}
