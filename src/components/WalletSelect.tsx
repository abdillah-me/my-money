import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useBalances, useWalletName, useWallets } from '@/db/hooks'
import { useSettings } from '@/lib/settings'

interface Props {
  id?: string
  value?: number
  onChange: (id: number) => void
  /** Sembunyikan dompet ini (mis. dompet asal saat memilih tujuan transfer) */
  exclude?: number
  placeholder?: string
  invalid?: boolean
}

/** Pilihan dompet aktif (non-arsip) beserta saldonya */
export default function WalletSelect({ id, value, onChange, exclude, placeholder, invalid }: Props) {
  const { money } = useSettings()
  const wallets = useWallets()
  const { byWallet } = useBalances()
  const walletName = useWalletName()
  // Dompet terarsip tetap ditampilkan bila sedang terpilih (mis. saat mengedit transaksi lama)
  const options = wallets.filter((w) => w.id !== exclude && (!w.archived || w.id === value))

  return (
    <Select value={value !== undefined ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((w) => (
          <SelectItem key={w.id} value={String(w.id)}>
            <span aria-hidden>{w.icon}</span>
            <span>{walletName(w)}</span>
            <span className="ml-auto pl-2 text-xs text-muted-foreground">{money(byWallet.get(w.id!) ?? 0)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
