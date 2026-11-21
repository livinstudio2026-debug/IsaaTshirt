import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ListOrdered, PackageOpen, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react'
import { listProducts, setProductVisibility } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { inr } from '../../lib/format'
import { useAdminPage } from '../useAdminPage'
import { CATEGORIES, categoryLabel, PLACEMENTS } from '../products/catalog'
import { btnGhost, btnSolid, ErrorBanner, PageTitle, StockBadge, Switch } from '../products/ui'
import { useToast } from '../products/useToast'
import SizeStock from '../products/SizeStock'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Live' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'low', label: 'Low stock' },
  { id: 'out', label: 'Sold out' },
]
const IDS = TABS.map((t) => t.id)
const SORTS = [{ id: 'newest', label: 'Newest first' }, { id: 'name', label: 'Name A–Z' }, { id: 'price-asc', label: 'Price: low to high' }, { id: 'price-desc', label: 'Price: high to low' }]
const selectCls = 'h-12 rounded-full border border-sand bg-white/80 px-4 text-[14px] font-medium outline-none transition-[border-color,box-shadow] hover:border-ink/40 focus:border-olive focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)]'

function Thumb({ product }) {
  const src = product.images[0]?.thumb
  return (
    <span className={`block h-[4.25rem] w-[3.4rem] shrink-0 overflow-hidden rounded-xl border border-sand bg-sand/50 ${product.isActive ? '' : 'opacity-50 grayscale'}`}>
      {src && <img src={src} alt="" loading="lazy" className="size-full object-contain" />}
    </span>
  )
}

function Chips({ product }) {
  const on = PLACEMENTS.filter((p) => product.placements[p.id] != null)
  if (!on.length && !product.isLimited) return null
  return (
    <span className="mt-1.5 flex flex-wrap gap-1.5">
      {product.isLimited && <span className="rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">Limited</span>}
      {on.map((p) => <span key={p.id} className="rounded-full bg-olive/12 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-olive">{p.short} #{product.placements[p.id]}</span>)}
    </span>
  )
}

function Sizes({ product, onSaved, onError }) {
  return (
    <span className="flex flex-wrap gap-2">
      {product.sizes.map((s) => <SizeStock key={s.size} product={product} size={s.size} stock={s.stock} low={s.low} onSaved={onSaved} onError={onError} />)}
    </span>
  )
}

function Skeleton() {
  return <div aria-hidden className="space-y-3">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-sand/45 motion-reduce:animate-none" />)}</div>
}

export default function Products() {
  useAdminPage('Products')
  const { admin } = useAdminAuth()
  const isOwner = admin.role === 'owner'
  const [toast, say] = useToast()
  const [params, setParams] = useSearchParams()
  const status = IDS.includes(params.get('status')) ? params.get('status') : 'all'
  const category = CATEGORIES.some((c) => c.id === params.get('category')) ? params.get('category') : ''
  const sort = SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'newest'
  const q = params.get('q') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [search, setSearch] = useState(q)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [busySlug, setBusySlug] = useState('')
  const first = useRef(true)

  const update = (patch) => setParams((p) => {
    const next = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    return next
  }, { replace: true })

  useEffect(() => {
    if (first.current) { first.current = false; return }
    const t = setTimeout(() => update({ q: search.trim(), page: '' }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    const ac = new AbortController()
    listProducts({ status, q, category, sort, page }, ac.signal).then(
      (d) => { setData(d); setError(''); setLoading(false) },
      (err) => { if (err.name === 'AbortError') return; setError(err.message); setLoading(false) },
    )
    return () => ac.abort()
  }, [status, q, category, sort, page, tick])

  // coming back to this tab picks up stock changes made meanwhile (orders, a teammate)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') setTick((n) => n + 1) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const reload = () => { setLoading(true); setTick((n) => n + 1) }
  // a row changed: swap it in, and refresh quietly so the tab counts stay right
  const onSaved = (product, message) => {
    setData((d) => d && { ...d, items: d.items.map((i) => (i.slug === product.slug ? product : i)) })
    if (message) say(message)
    setTick((n) => n + 1)
  }
  const toggle = async (p, isActive) => {
    setBusySlug(p.slug)
    try { onSaved(await setProductVisibility(p.slug, isActive), `${p.name} is ${isActive ? 'live on the store' : 'hidden from the store'}`) } catch (err) { say(err.message, 'error') } finally { setBusySlug('') }
  }

  const items = data?.items ?? []
  const counts = data?.counts
  const meta = data?.meta
  const filtered = Boolean(q || category || status !== 'all')
  const clearAll = () => { setSearch(''); setLoading(true); update({ q: '', category: '', status: '', page: '' }) }

  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle>Products</PageTitle>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/products/placements" className={btnGhost}><ListOrdered size={15} aria-hidden />Home page order</Link>
          <button type="button" onClick={reload} disabled={loading} className={btnGhost}><RefreshCw size={15} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden />Refresh</button>
          {isOwner && <Link to="/admin/products/new" className={btnSolid}><Plus size={16} aria-hidden />Add product</Link>}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <nav aria-label="Product status" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const on = t.id === status
            const warn = (t.id === 'low' || t.id === 'out') && counts?.[t.id] > 0 && !on
            return (
              <button key={t.id} type="button" aria-pressed={on} onClick={() => { setLoading(true); update({ status: t.id === 'all' ? '' : t.id, page: '' }) }}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-sand bg-white/60 text-ink/70 hover:border-ink/40 hover:text-ink'}`}>
                {t.label}
                {counts && <span className={`grid min-w-6 place-items-center rounded-full px-1.5 text-[11px] leading-5 tabular-nums ${on ? 'bg-white/20' : warn ? 'bg-amber-200 text-amber-950' : 'bg-sand/80'}`}>{counts[t.id]}</span>}
              </button>
            )
          })}
        </nav>

        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative w-full md:max-w-sm">
            <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/45" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={60} placeholder="Search by name" aria-label="Search products" autoComplete="off"
              className="h-12 w-full rounded-full border border-sand bg-white/80 pl-11 pr-11 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-ink/40 hover:border-ink/40 focus:border-olive focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)] [&::-webkit-search-cancel-button]:hidden" />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink/55 hover:bg-sand/60 hover:text-ink"><X size={16} /></button>}
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex">
            <select aria-label="Category" value={category} onChange={(e) => { setLoading(true); update({ category: e.target.value, page: '' }) }} className={selectCls}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => { setLoading(true); update({ sort: e.target.value === 'newest' ? '' : e.target.value, page: '' }) }} className={selectCls}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {meta && <p className="mt-4 text-[13px] text-ink/55">Tap a size to change its stock; it saves straight away. <span className="whitespace-nowrap">Amber = {meta.lowStockAt} or fewer left.</span>{!isOwner && ' Only the owner can add products or change details and prices.'}</p>}

      <div className="mt-4" aria-live="polite" aria-busy={loading}>
        {error && <ErrorBanner onRetry={reload}>{error}</ErrorBanner>}
        {!data && !error && <Skeleton />}

        {data && items.length === 0 && !error && (
          <div className="grid place-items-center rounded-[28px] border border-dashed border-sand bg-white/40 px-6 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-sand/60 text-ink/55"><PackageOpen size={26} aria-hidden /></span>
            <p className="mt-4 text-[17px] font-black uppercase italic tracking-tight">{filtered ? 'No products match' : 'No products yet'}</p>
            <p className="mt-1.5 max-w-sm text-[14px] text-ink/60">{filtered ? 'Try a different search or filter.' : isOwner ? 'Add your first product to put it on the store.' : 'The owner can add products.'}</p>
            {filtered ? <button type="button" onClick={clearAll} className="mt-5 rounded-full border border-ink px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide hover:bg-ink hover:text-white">Show all products</button>
              : isOwner && <Link to="/admin/products/new" className={`${btnSolid} mt-5`}><Plus size={16} aria-hidden />Add product</Link>}
          </div>
        )}

        {items.length > 0 && (
          <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {/* desktop: table */}
            <div className="hidden overflow-hidden rounded-[24px] border border-sand bg-white/70 md:block">
              <table className="w-full text-left text-[14px]">
                <thead className="border-b border-sand bg-cream/70 text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">
                  <tr><th scope="col" className="px-5 py-3.5">Product</th><th scope="col" className="px-3 py-3.5">Stock by size</th><th scope="col" className="px-3 py-3.5 text-center">Live</th><th scope="col" className="px-5 py-3.5"><span className="sr-only">Open</span></th></tr>
                </thead>
                <tbody className="divide-y divide-sand/70">
                  {items.map((p) => (
                    <tr key={p.slug} className="align-top">
                      <td className="px-5 py-4">
                        <div className="flex gap-3.5">
                          <Thumb product={p} />
                          <div className="min-w-0">
                            <Link to={`/admin/products/${p.slug}`} className="block max-w-[17rem] truncate font-black underline-offset-4 hover:underline">{p.name}</Link>
                            <span className="block text-[12.5px] text-ink/55">{categoryLabel(p.category)} · <b className="text-ink">{inr(p.price)}</b>{p.mrp > p.price && <s className="ml-1.5">{inr(p.mrp)}</s>}</span>
                            <span className="mt-1.5 flex flex-wrap items-center gap-1.5"><StockBadge state={p.stockState} />{!p.isActive && <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/60">Hidden</span>}</span>
                            <Chips product={p} />
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[26rem] px-3 py-4"><Sizes product={p} onSaved={onSaved} onError={(m) => say(m, 'error')} /><span className="mt-2 block text-[12.5px] text-ink/50 tabular-nums">{p.totalStock} in total</span></td>
                      <td className="px-3 py-4 text-center"><Switch checked={p.isActive} busy={busySlug === p.slug} onChange={(v) => toggle(p, v)} label={`${p.name} is ${p.isActive ? 'live' : 'hidden'}. Switch to ${p.isActive ? 'hide' : 'show'}`} /></td>
                      <td className="px-5 py-4 text-right"><Link to={`/admin/products/${p.slug}`} className={btnGhost}>{isOwner ? <><Pencil size={14} aria-hidden />Edit</> : 'View'}</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile: cards */}
            <ul className="space-y-3 md:hidden">
              {items.map((p) => (
                <li key={p.slug} className="rounded-[22px] border border-sand bg-white/75 p-4">
                  <div className="flex gap-3.5">
                    <Thumb product={p} />
                    <div className="min-w-0 flex-1">
                      <Link to={`/admin/products/${p.slug}`} className="block truncate font-black">{p.name}</Link>
                      <span className="block text-[12.5px] text-ink/55">{categoryLabel(p.category)} · <b className="text-ink">{inr(p.price)}</b></span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5"><StockBadge state={p.stockState} />{!p.isActive && <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/60">Hidden</span>}</span>
                    </div>
                    <Switch checked={p.isActive} busy={busySlug === p.slug} onChange={(v) => toggle(p, v)} label={`${p.name} is ${p.isActive ? 'live' : 'hidden'}. Switch to ${p.isActive ? 'hide' : 'show'}`} />
                  </div>
                  <div className="mt-3.5"><Sizes product={p} onSaved={onSaved} onError={(m) => say(m, 'error')} /></div>
                  <Chips product={p} />
                  <Link to={`/admin/products/${p.slug}`} className="mt-3.5 inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-olive">{isOwner ? 'Edit details' : 'View details'}<ChevronRight size={14} aria-hidden /></Link>
                </li>
              ))}
            </ul>

            {meta && meta.pages > 1 && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink/55 tabular-nums">Page {meta.page} of {meta.pages} · {meta.total} products</p>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1 || loading} onClick={() => update({ page: page > 2 ? String(page - 1) : '' })} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/25 pl-3 pr-4 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-40"><ChevronLeft size={16} aria-hidden />Prev</button>
                  <button type="button" disabled={page >= meta.pages || loading} onClick={() => update({ page: String(page + 1) })} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/25 pl-4 pr-3 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-40">Next<ChevronRight size={16} aria-hidden /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {toast}
    </div>
  )
}
