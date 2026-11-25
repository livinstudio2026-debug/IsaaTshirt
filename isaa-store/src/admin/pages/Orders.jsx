import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, CircleAlert, PackageOpen, RefreshCw, Search, X } from 'lucide-react'
import { listOrders } from '../../lib/adminApi'
import { inr } from '../../lib/format'
import { useAdminPage } from '../useAdminPage'
import { PaymentBadge, StatusBadge } from '../orders/shared'
import { ago, dateTime } from '../orders/format'

const TABS = [
  { id: 'new', label: 'New' },
  { id: 'packed', label: 'Packed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
]
const IDS = TABS.map((t) => t.id)

function Thumbs({ images, count }) {
  return (
    <span className="flex items-center">
      {images.map((src, i) => (
        <span key={i} className="-ml-3 first:ml-0 block h-11 w-9 shrink-0 overflow-hidden rounded-lg border-2 border-cream bg-sand/60">
          {src && <img src={src} alt="" loading="lazy" className="size-full object-contain" />}
        </span>
      ))}
      <span className="ml-2.5 text-[13px] text-ink/60 tabular-nums">{count} {count === 1 ? 'piece' : 'pieces'}</span>
    </span>
  )
}

function Skeleton() {
  return (
    <div aria-hidden className="space-y-3">
      {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-sand/45 motion-reduce:animate-none" />)}
    </div>
  )
}

export default function Orders() {
  useAdminPage('Orders')
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const status = IDS.includes(params.get('status')) ? params.get('status') : 'new'
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [search, setSearch] = useState(q)
  const [data, setData] = useState(null) // { items, meta, counts }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0) // bump to reload
  const first = useRef(true)

  const update = (patch) => setParams((p) => {
    const next = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    return next
  }, { replace: true })

  // typing in the search box updates the URL after a short pause
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => update({ q: search.trim(), page: '' }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    const ac = new AbortController()
    listOrders({ status, q, page }, ac.signal).then(
      (d) => { setData(d); setError(''); setLoading(false) },
      (err) => { if (err.name === 'AbortError') return; setError(err.message); setLoading(false) },
    )
    return () => ac.abort()
  }, [status, q, page, tick])

  // coming back to this tab picks up orders placed in the meantime
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setTick((n) => n + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const reload = () => { setLoading(true); setTick((n) => n + 1) }
  const counts = data?.counts
  const items = data?.items ?? []
  const meta = data?.meta
  const go = (to) => nav(`/admin/orders/${to}`)
  const setTab = (id) => { setLoading(true); update({ status: id === 'new' ? '' : id, page: '' }) }

  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-olive">Back office</p>
          <h1 className="mt-2 font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(30px,4.4vw,52px)]" style={{ fontVariationSettings: '"wdth" 86' }}>Orders</h1>
        </div>
        <button type="button" onClick={reload} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 px-4 text-[12px] font-bold uppercase tracking-wide transition-colors hover:border-ink hover:bg-ink hover:text-white disabled:opacity-60">
          <RefreshCw size={15} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden /> Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Order status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const on = t.id === status
            return (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-pressed={on}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-sand bg-white/60 text-ink/70 hover:border-ink/40 hover:text-ink'}`}>
                {t.label}
                {counts && <span className={`grid min-w-6 place-items-center rounded-full px-1.5 text-[11px] leading-5 tabular-nums ${on ? 'bg-white/20' : 'bg-sand/80'} ${t.id === 'new' && counts.new > 0 && !on ? 'bg-amber-200 text-amber-950' : ''}`}>{counts[t.id]}</span>}
              </button>
            )
          })}
        </nav>

        <div className="relative w-full lg:max-w-sm">
          <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/45" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={60} placeholder="Order no., name, email or phone" aria-label="Search orders" autoComplete="off"
            className="h-12 w-full rounded-full border border-sand bg-white/80 pl-11 pr-11 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-ink/40 hover:border-ink/40 focus:border-olive focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)] [&::-webkit-search-cancel-button]:hidden" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink/55 hover:bg-sand/60 hover:text-ink"><X size={16} /></button>}
        </div>
      </div>

      <div className="mt-6" aria-live="polite" aria-busy={loading}>
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-600/25 bg-red-50 px-5 py-4 text-[14px] text-red-800">
            <span className="flex items-start gap-2.5"><CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />{error}</span>
            <button type="button" onClick={reload} className="rounded-full border border-red-800/40 px-4 py-2 text-[12px] font-bold uppercase tracking-wide hover:bg-red-800 hover:text-white">Try again</button>
          </div>
        )}

        {!data && !error && <Skeleton />}

        {data && items.length === 0 && !error && (
          <div className="grid place-items-center rounded-[28px] border border-dashed border-sand bg-white/40 px-6 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-sand/60 text-ink/55"><PackageOpen size={26} aria-hidden /></span>
            <p className="mt-4 text-[17px] font-black uppercase italic tracking-tight">{q ? 'No orders match that search' : status === 'new' ? 'No new orders right now' : `No ${status === 'all' ? '' : status + ' '}orders`}</p>
            <p className="mt-1.5 max-w-sm text-[14px] text-ink/60">{q ? 'Check the spelling, or try part of the order number, the email or the last digits of the phone.' : 'New orders show up here as soon as customers check out.'}</p>
            {(q || status !== 'all') && <button type="button" onClick={() => { setSearch(''); setLoading(true); update({ q: '', status: 'all', page: '' }) }} className="mt-5 rounded-full border border-ink px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide hover:bg-ink hover:text-white">Show all orders</button>}
          </div>
        )}

        {items.length > 0 && (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {/* desktop: table */}
            <div className="hidden overflow-hidden rounded-[24px] border border-sand bg-white/70 md:block">
              <table className="w-full text-left text-[14px]">
                <thead className="border-b border-sand bg-cream/70 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">
                  <tr><th scope="col" className="px-5 py-3.5">Order</th><th scope="col" className="px-3 py-3.5">Customer</th><th scope="col" className="px-3 py-3.5">Items</th><th scope="col" className="px-3 py-3.5 text-right">Total</th><th scope="col" className="px-5 py-3.5 text-right">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-sand/70">
                  {items.map((o) => (
                    <tr key={o.orderNumber} onClick={() => go(o.orderNumber)} className="cursor-pointer transition-colors hover:bg-cream/80">
                      <td className="px-5 py-4 align-middle">
                        <Link to={`/admin/orders/${o.orderNumber}`} onClick={(e) => e.stopPropagation()} className="font-black tracking-wide tabular-nums underline-offset-4 hover:underline">{o.orderNumber}</Link>
                        <span className="block text-[12.5px] text-ink/50" title={dateTime(o.createdAt)}>{ago(o.createdAt)}</span>
                      </td>
                      <td className="px-3 py-4 align-middle"><b className="block max-w-[14rem] truncate">{o.customer.name}</b><span className="block max-w-[14rem] truncate text-[12.5px] text-ink/50">{o.place}</span></td>
                      <td className="px-3 py-4 align-middle"><Thumbs images={o.images} count={o.itemCount} /></td>
                      <td className="px-3 py-4 text-right align-middle"><b className="block tabular-nums">{inr(o.total)}</b><PaymentBadge payment={o.payment} className="mt-1" /></td>
                      <td className="px-5 py-4 text-right align-middle"><StatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile: cards */}
            <ul className="space-y-3 md:hidden">
              {items.map((o) => (
                <li key={o.orderNumber}>
                  <Link to={`/admin/orders/${o.orderNumber}`} className="block rounded-[22px] border border-sand bg-white/75 p-4 transition-colors active:bg-cream">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0"><b className="block truncate font-black tracking-wide tabular-nums">{o.orderNumber}</b><span className="text-[12.5px] text-ink/50">{ago(o.createdAt)}</span></div>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="mt-3 truncate font-bold">{o.customer.name}<span className="font-normal text-ink/50"> · {o.place}</span></p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Thumbs images={o.images} count={o.itemCount} />
                      <span className="text-right"><b className="block tabular-nums">{inr(o.total)}</b><PaymentBadge payment={o.payment} className="mt-1" /></span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            {meta && meta.pages > 1 && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink/55 tabular-nums">Page {meta.page} of {meta.pages} · {meta.total} orders</p>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1 || loading} onClick={() => update({ page: page > 2 ? String(page - 1) : '' })} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/25 pl-3 pr-4 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-40"><ChevronLeft size={16} aria-hidden />Prev</button>
                  <button type="button" disabled={page >= meta.pages || loading} onClick={() => update({ page: String(page + 1) })} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/25 pl-4 pr-3 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-40">Next<ChevronRight size={16} aria-hidden /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
