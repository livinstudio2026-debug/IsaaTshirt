import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Pencil, Plus, Ruler, Trash2 } from 'lucide-react'
import { deleteSizeChart, listSizeCharts } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { useAdminPage } from '../useAdminPage'
import { categoryLabel } from '../products/catalog'
import ConfirmDialog from '../orders/ConfirmDialog'
import { btnGhost, btnSolid, ErrorBanner, PageTitle } from '../products/ui'
import { useToast } from '../products/useToast'

// The shared size charts: set one up once ("Oversized Tee"), then pick it on any product that fits the same way.
export default function SizeCharts() {
  useAdminPage('Size charts')
  const { admin } = useAdminAuth()
  const isOwner = admin.role === 'owner'
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [doomed, setDoomed] = useState(null) // the chart the owner is about to delete
  const [toast, say] = useToast()

  useEffect(() => {
    const ac = new AbortController()
    listSizeCharts(ac.signal).then(
      (d) => { setItems(d); setError('') },
      (err) => { if (err.name !== 'AbortError') setError(err.message) },
    )
    return () => ac.abort()
  }, [tick])

  const head = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <PageTitle eyebrow="Catalogue">Size charts</PageTitle>
      <div className="flex flex-wrap gap-2">
        <Link to="/admin/products" className={btnGhost}>Products</Link>
        {isOwner && <Link to="/admin/products/size-charts/new" className={btnSolid}><Plus size={16} aria-hidden />New chart</Link>}
      </div>
    </div>
  )

  if (error) return <div className="space-y-5">{head}<ErrorBanner onRetry={() => { setError(''); setTick((n) => n + 1) }}>{error}</ErrorBanner></div>
  if (!items) return <div aria-hidden className="space-y-4"><div className="h-12 w-1/2 animate-pulse rounded-2xl bg-sand/45" /><div className="h-28 animate-pulse rounded-[24px] bg-sand/45" /><div className="h-28 animate-pulse rounded-[24px] bg-sand/45" /></div>

  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      {head}
      <p className="mt-4 max-w-2xl text-[14.5px] text-ink/65">Set a chart up once, then pick it on each product. Change a chart and every product using it updates. A product that fits differently can have its own table instead.</p>

      {items.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-[24px] border border-dashed border-ink/25 bg-white/50 px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-olive/15 text-olive"><Ruler size={24} aria-hidden /></span>
          <p className="mt-4 text-lg font-black">No size charts yet</p>
          <p className="mt-1 max-w-sm text-[14px] text-ink/60">{isOwner ? 'Add one for your oversized tees to start with.' : 'The owner can add them.'}</p>
          {isOwner && <Link to="/admin/products/size-charts/new" className={`${btnSolid} mt-5`}><Plus size={16} aria-hidden />New chart</Link>}
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((c) => (
            <li key={c.slug} className="rounded-[24px] border border-sand bg-white/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-black">{c.name}</p>
                  <p className="mt-0.5 text-[13px] text-ink/55">{c.category ? `Made for ${categoryLabel(c.category).toLowerCase()}` : 'Any product'} · {c.usedBy === 0 ? 'not used yet' : `used by ${c.usedBy} ${c.usedBy === 1 ? 'product' : 'products'}`}</p>
                </div>
                <Link to={`/admin/products/size-charts/${c.slug}`} className={btnGhost}>{isOwner ? <><Pencil size={14} aria-hidden />Edit</> : 'View'}</Link>
              </div>
              <p className="mt-3 text-[13px] text-ink/65"><b className="text-ink">Sizes:</b> {c.rows.map((r) => r.size).join(', ')}</p>
              <p className="mt-1 text-[13px] text-ink/65"><b className="text-ink">Measurements:</b> {c.columns.join(', ')}</p>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                <Link to={`/admin/products/size-charts/${c.slug}`} className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-olive">{isOwner ? 'Edit numbers' : 'See numbers'}<ChevronRight size={14} aria-hidden /></Link>
                {isOwner && (c.usedBy > 0
                  ? <span className="text-[12px] text-ink/50">In use: switch its products to another chart to delete it</span>
                  : <button type="button" onClick={() => setDoomed(c)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-700/40 px-3.5 text-[11.5px] font-bold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-700 hover:text-white"><Trash2 size={13} aria-hidden />Delete</button>)}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog open={Boolean(doomed)} onClose={() => setDoomed(null)} title="Delete this chart?" confirmLabel="Delete for good" busyLabel="Deleting…" danger
        onConfirm={async () => {
          await deleteSizeChart(doomed.slug) // refused by the server while a product uses it: the message shows in the box
          setItems((list) => list.filter((x) => x.slug !== doomed.slug))
          say(`${doomed.name} deleted.`)
          setDoomed(null)
        }}>
        <p><b>{doomed?.name}</b> will be removed. This can’t be undone.</p>
      </ConfirmDialog>
      {toast}
    </div>
  )
}
