import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSettings } from '@/lib/settings'

interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  destructive?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const Ctx = createContext<ConfirmFn | null>(null)

/** Pengganti window.confirm berbasis AlertDialog shadcn: `if (await confirm({...})) ...` */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useSettings()
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(undefined)

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOpts(o)
      }),
    [],
  )

  const close = (value: boolean) => {
    resolver.current?.(value)
    resolver.current = undefined
    setOpts(null)
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(open) => !open && close(false)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && <AlertDialogDescription>{opts.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={opts?.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
            >
              {opts?.confirmText ?? (opts?.destructive ? t('common.delete') : t('common.save'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfirm must be used inside ConfirmProvider')
  return ctx
}
