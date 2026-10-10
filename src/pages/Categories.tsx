import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import CategoryDialog from '@/components/CategoryDialog'
import CategoryIcon from '@/components/CategoryIcon'
import { useConfirm } from '@/components/confirm'
import PageHeader from '@/components/PageHeader'
import Segmented from '@/components/Segmented'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db, type Category, type TxType } from '@/db/db'
import { useCategories, useCategoryName } from '@/db/hooks'
import { useSettings } from '@/lib/settings'

export default function Categories() {
  const { t } = useSettings()
  const confirm = useConfirm()
  const categories = useCategories()
  const catName = useCategoryName()
  const [type, setType] = useState<TxType>('expense')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | undefined>()

  const list = categories.filter((c) => c.type === type)

  const openNew = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }
  const openEdit = (c: Category) => {
    setEditing(c)
    setDialogOpen(true)
  }

  const remove = async (c: Category) => {
    const used = await db.transactions.where('categoryId').equals(c.id!).count()
    if (used > 0) {
      toast.error(t('cat.inUse', { n: used }))
      return
    }
    if (!(await confirm({ title: t('cat.deleteConfirm'), description: catName(c), destructive: true }))) return
    await db.transaction('rw', db.categories, db.budgets, async () => {
      await db.categories.delete(c.id!)
      await db.budgets.delete(c.id!)
    })
    toast.success(t('common.deleted'))
  }

  return (
    <div className="min-h-dvh pb-28">
      <PageHeader
        title={t('cat.title')}
        fallback="/profile"
        right={
          <Button variant="ghost" size="icon" onClick={openNew} aria-label={t('cat.add')}>
            <Plus aria-hidden />
          </Button>
        }
      />

      <div className="space-y-4 px-5">
        <Segmented<TxType>
          label={t('cat.title')}
          value={type}
          onValueChange={setType}
          options={[
            { value: 'expense', label: t('common.expense') },
            { value: 'income', label: t('common.income') },
          ]}
        />

        <Card className="gap-0 overflow-hidden rounded-3xl py-0 shadow-card ring-0">
          <ul className="divide-y">
            {list.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <CategoryIcon category={c} className="size-10 text-lg" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{catName(c)}</span>
                {!c.builtin && (
                  <Badge variant="secondary" className="shrink-0">
                    {t('cat.newShort')}
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" onClick={() => openEdit(c)} aria-label={`${t('common.edit')} ${catName(c)}`}>
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(c)}
                  aria-label={`${t('common.delete')} ${catName(c)}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Button variant="outline" size="lg" className="w-full border-dashed border-primary/40 text-primary hover:text-primary" onClick={openNew}>
          <Plus data-icon="inline-start" aria-hidden />
          {t('cat.add')}
        </Button>
      </div>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
        defaultType={type}
        onSaved={() => {
          if (editing) toast.success(t('common.saved'))
        }}
      />
    </div>
  )
}
