import { BarChart3, ShieldCheck, Wallet } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Segmented from '@/components/Segmented'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { DictKey, Lang } from '@/lib/i18n'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

const slides: { title: DictKey; desc: DictKey; Icon: typeof Wallet }[] = [
  { title: 'onboarding.title1', desc: 'onboarding.desc1', Icon: Wallet },
  { title: 'onboarding.title2', desc: 'onboarding.desc2', Icon: ShieldCheck },
  { title: 'onboarding.title3', desc: 'onboarding.desc3', Icon: BarChart3 },
]

export default function Onboarding() {
  const { t, update, settings } = useSettings()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(settings.name)
  const isLast = step === slides.length - 1
  const { Icon, title, desc } = slides[step]

  const finish = (e?: FormEvent) => {
    e?.preventDefault()
    update({ name: name.trim(), onboarded: true })
  }

  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col bg-card px-6">
      <div className="flex items-center justify-between py-2">
        <span className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" aria-hidden />
          </span>
          Wahduid
        </span>
        <Segmented<Lang>
          className="w-28"
          label={t('profile.language')}
          value={settings.lang}
          onValueChange={(lang) => update({ lang })}
          options={[
            { value: 'id', label: 'ID' },
            { value: 'en', label: 'EN' },
          ]}
        />
      </div>

      <section className="mt-8 text-center" aria-live="polite">
        <h1 className="text-2xl leading-snug font-semibold text-balance">{t(title)}</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">{t(desc)}</p>
        <div className="mt-5 flex justify-center gap-1.5" aria-hidden>
          {slides.map((_, i) => (
            <span
              key={i}
              className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-5 bg-primary' : 'w-1.5 bg-border')}
            />
          ))}
        </div>
      </section>

      <div className="hero-gradient relative mx-auto mt-8 grid w-full max-w-xs flex-1 place-items-center overflow-hidden rounded-[2rem]">
        <div className="grid size-40 place-items-center rounded-3xl bg-card shadow-card">
          <Icon className="size-20 text-primary" aria-hidden />
        </div>
      </div>

      <form onSubmit={finish} className="mt-6 space-y-3">
        {isLast && (
          <div className="space-y-1.5">
            <Label htmlFor="onb-name">{t('onboarding.nameLabel')}</Label>
            <Input
              id="onb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('onboarding.namePlaceholder')}
              maxLength={40}
              autoComplete="given-name"
            />
          </div>
        )}
        {isLast ? (
          <Button type="submit" size="lg" className="w-full">
            {t('onboarding.start')}
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button type="button" variant="ghost" size="lg" className="flex-1" onClick={() => setStep(slides.length - 1)}>
              {t('onboarding.skip')}
            </Button>
            <Button type="button" size="lg" className="flex-1" onClick={() => setStep((s) => s + 1)}>
              {t('onboarding.next')}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
