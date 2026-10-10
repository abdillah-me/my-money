import { Pin, PinOff, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfirm } from '@/components/confirm'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getAlive, insert, patch, remove as removeRecord } from '@/db/db'
import { useGoBack } from '@/lib/nav'
import { useSettings } from '@/lib/settings'

export default function NoteForm() {
  const { id } = useParams()
  const editId = id || undefined
  const goBack = useGoBack('/note')
  const confirm = useConfirm()
  const { t } = useSettings()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [loaded, setLoaded] = useState(editId === undefined)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (editId === undefined) return
    getAlive('notes', editId).then((n) => {
      if (!n) return setNotFound(true)
      setTitle(n.title ?? '')
      setContent(n.content ?? '')
      setPinned(!!n.pinned)
      setLoaded(true)
    })
  }, [editId])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    // Catatan kosong tidak disimpan
    if (!title.trim() && !content.trim()) return goBack()
    const data = { title: title.trim(), content, pinned }
    if (editId !== undefined) await patch('notes', editId, data)
    else await insert('notes', data)
    toast.success(t('common.saved'))
    goBack()
  }

  const remove = async () => {
    if (editId === undefined) return
    if (!(await confirm({ title: t('note.deleteConfirm'), description: title || undefined, destructive: true }))) return
    await removeRecord('notes', editId)
    toast.success(t('common.deleted'))
    goBack()
  }

  const heading = editId !== undefined ? t('note.edit') : t('note.new')

  if (notFound) {
    return (
      <div className="min-h-dvh">
        <PageHeader title={heading} fallback="/note" />
        <p className="mt-16 text-center text-sm text-muted-foreground">{t('tx.notFound')}</p>
      </div>
    )
  }
  if (!loaded) return null

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title={heading}
        fallback="/note"
        right={
          <div className="flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPinned((p) => !p)}
              aria-pressed={pinned}
              aria-label={pinned ? t('note.unpin') : t('note.pin')}
              className="text-primary hover:text-primary"
            >
              {pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
            </Button>
            {editId !== undefined && (
              <Button variant="ghost" size="icon" onClick={remove} aria-label={t('common.delete')} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 aria-hidden />
              </Button>
            )}
          </div>
        }
      />
      <form onSubmit={submit} className="flex flex-1 flex-col gap-3 px-5 pb-6">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('note.titlePlaceholder')}
          aria-label={t('note.titlePlaceholder')}
          maxLength={80}
          className="h-12 text-lg font-semibold"
        />
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('note.contentPlaceholder')}
          aria-label={t('note.contentPlaceholder')}
          autoFocus={editId === undefined}
          className="min-h-64 flex-1 resize-none leading-relaxed [field-sizing:fixed]"
        />
        <Button type="submit" size="lg" className="w-full">
          {t('common.save')}
        </Button>
      </form>
    </div>
  )
}
