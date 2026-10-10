import { useLiveQuery } from 'dexie-react-hooks'
import { Pin, Plus, Search, StickyNote } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from '@/components/EmptyState'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { db } from '@/db/db'
import { formatDate } from '@/lib/format'
import { useSettings } from '@/lib/settings'

export default function Notes() {
  const { settings, t } = useSettings()
  const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), [])
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (notes ?? [])
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned))
  }, [notes, query])

  return (
    <div className="min-h-dvh pb-10">
      <PageHeader
        title={t('menu.note')}
        right={
          <Button asChild variant="ghost" size="icon">
            <Link to="/note/new" aria-label={t('note.new')}>
              <Plus aria-hidden />
            </Link>
          </Button>
        }
      />

      <div className="space-y-3 px-5">
        {(notes?.length ?? 0) > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('note.search')}
              aria-label={t('note.search')}
              className="pl-10"
            />
          </div>
        )}

        {notes && notes.length === 0 && (
          <EmptyState icon={StickyNote} text={t('note.empty')} action={{ to: '/note/new', label: t('note.new') }} />
        )}
        {notes && notes.length > 0 && list.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">{t('list.empty')}</p>
        )}

        <ul className="grid grid-cols-2 gap-3">
          {list.map((n) => (
            <li key={n.id}>
              <Link
                to={`/note/${n.id}`}
                className="flex h-full min-h-32 flex-col rounded-3xl bg-card p-4 text-card-foreground shadow-card transition-colors hover:bg-accent"
              >
                <span className="flex items-start gap-1">
                  <span className="line-clamp-2 flex-1 text-sm font-semibold">{n.title || t('note.untitled')}</span>
                  {n.pinned && <Pin className="size-3.5 shrink-0 fill-primary text-primary" aria-label={t('note.pin')} />}
                </span>
                <span className="mt-1 line-clamp-4 flex-1 text-xs whitespace-pre-line text-muted-foreground">{n.content}</span>
                <span className="mt-2 text-[10px] text-muted-foreground">{formatDate(n.updatedAt, settings.lang, false)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
