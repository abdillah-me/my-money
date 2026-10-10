/** Placeholder daftar transaksi saat data IndexedDB sedang dimuat */
export default function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-1" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-2 py-2.5">
          <span className="skeleton size-11 shrink-0 rounded-full" />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-3.5 w-2/3" />
            <span className="skeleton block h-3 w-1/2" />
          </span>
          <span className="skeleton h-4 w-16" />
        </li>
      ))}
    </ul>
  )
}
