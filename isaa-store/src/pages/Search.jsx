import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, CircleAlert, LoaderCircle, Search as SearchIcon, X } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import CategoryTiles from '../components/CategoryTiles'
import { QUICK_LINKS, chip } from '../lib/searchLinks'
import { searchProducts } from '../lib/api'
import { forgetSearches, readRecent, rememberSearch } from '../lib/recentSearches'
import underline from '../assets/featuredDrop/underline-stroke.webp'

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Best match' },
  { id: 'newest', label: 'Newest first' },
  { id: 'price-asc', label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
]

function Skeleton() {
  return Array.from({ length: 8 }, (_, i) => (
    <li key={i} aria-hidden className="flex">
      <div className="w-full animate-pulse rounded-[22px] border border-sand bg-cream p-2 motion-reduce:animate-none sm:rounded-[28px] sm:p-2.5">
        <div className="aspect-[4/4.5] rounded-[16px] bg-sand/60 sm:rounded-[20px]" />
        <div className="mt-3 h-4 w-2/3 rounded bg-sand/70" /><div className="mt-2 h-3 w-1/3 rounded bg-sand/50" />
        <div className="mt-4 flex items-center justify-between"><div className="h-5 w-1/3 rounded bg-sand/70" /><div className="h-10 w-10 rounded-full bg-sand/70" /></div>
      </div>
    </li>
  ))
}

// The search box on the page itself. Remounted (key) when the address changes so it always shows what was searched.
function Box({ initial, onSearch }) {
  const [text, setText] = useState(initial)
  const ref = useRef(null)
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); onSearch(text) }} className="relative">
      <SearchIcon size={22} aria-hidden className="pointer-events-none absolute left-4 top-1/2 sm:left-5 -translate-y-1/2 text-ink/50" />
      <input ref={ref} type="search" value={text} onChange={(e) => setText(e.target.value)} maxLength={60} enterKeyHint="search" autoComplete="off" aria-label="Search the shop" placeholder="Search tees, hoodies, colours…"
        className="h-14 w-full rounded-full border border-ink/25 bg-white/80 pl-12 pr-[7.5rem] text-[16px] sm:h-16 sm:pl-14 sm:pr-36 sm:text-[17px] outline-none transition-[border-color,box-shadow] placeholder:text-ink/40 hover:border-ink/45 focus:border-olive focus:bg-white focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)] [&::-webkit-search-cancel-button]:hidden" />
      {text && <button type="button" onClick={() => { setText(''); ref.current?.focus() }} aria-label="Clear search" className="absolute right-[5.25rem] top-1/2 grid size-9 sm:right-[6.5rem] sm:size-10 -translate-y-1/2 place-items-center rounded-full text-ink/55 hover:bg-sand/60 hover:text-ink"><X size={18} aria-hidden /></button>}
      <button type="submit" className="absolute right-1.5 top-1/2 h-11 -translate-y-1/2 rounded-full bg-ink px-5 text-[12px] sm:right-2 sm:h-12 sm:px-7 font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Search</button>
    </form>
  )
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim().slice(0, 60)
  const sort = SORT_OPTIONS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'relevance'
  const [attempt, setAttempt] = useState(0)
  const key = `${q}|${sort}|${attempt}`
  const [data, setData] = useState({ key: '', status: 'loading', items: [], meta: null })
  const [more, setMore] = useState(false)
  const [recent, setRecent] = useState(readRecent)
  const keyRef = useRef(key)

  useEffect(() => { document.title = q ? `“${q}” — Search — Isaa` : 'Search — Isaa'; return () => { document.title = 'Isaa — Wear the Vibe' } }, [q])
  useEffect(() => {
    keyRef.current = key
    if (!q) return
    const ac = new AbortController()
    searchProducts({ q, sort, page: 1 }, ac.signal)
      .then(({ items, meta }) => { setData({ key, status: 'ready', items, meta }); rememberSearch(q) })
      .catch((err) => { if (err.name !== 'AbortError') setData({ key, status: 'error', items: [], meta: null }) })
    return () => ac.abort()
  }, [key, q, sort])

  const fresh = data.key === key
  const status = !q ? 'idle' : fresh ? data.status : 'loading'
  const items = fresh ? data.items : []
  const meta = fresh ? data.meta : null
  const hasMore = meta ? meta.page < meta.pages : false

  const loadMore = async () => {
    if (more || !meta) return
    setMore(true)
    const at = key
    try {
      const next = await searchProducts({ q, sort, page: meta.page + 1 })
      if (keyRef.current !== at) return
      setData((d) => (d.key === at ? { ...d, items: [...d.items, ...next.items], meta: next.meta } : d))
    } catch { /* keep what we have; the button stays */ }
    setMore(false)
  }
  const go = (text) => { const t = text.trim(); if (t) setParams({ q: t }) }

  return (
    <section aria-labelledby="search-heading" className="bg-cream pb-24 pt-10 sm:pb-28 lg:pb-[7vw] lg:pt-[3.4vw]">
      <div className="mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
        <h1 id="search-heading" className="font-black italic uppercase leading-[0.92] tracking-[-0.02em] text-[11vw] sm:text-[7vw] lg:text-[4.4vw]" style={{ fontVariationSettings: '"wdth" 84' }}>Search</h1>
        <img aria-hidden src={underline} alt="" className="mt-[1vw] h-[2.6vw] w-[min(60%,300px)] object-fill sm:h-[1.6vw] lg:mt-[0.4vw] lg:h-[0.9vw]" />

        <div className="mt-7 max-w-3xl"><Box key={q} initial={q} onSearch={go} /></div>

        {status === 'idle' && (
          <div className="mt-8 max-w-4xl space-y-8">
            {recent.length > 0 && (
              <section aria-label="Recent searches">
                <div className="flex items-center gap-4"><h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/50">Recent</h2><button type="button" onClick={() => setRecent(forgetSearches())} className="text-[12px] font-bold uppercase tracking-wide text-ink/55 underline-offset-4 hover:text-ink hover:underline">Clear</button></div>
                <ul className="mt-2 flex flex-wrap gap-2">{recent.map((r) => <li key={r}><Link to={`/search?q=${encodeURIComponent(r)}`} className={chip}>{r}</Link></li>)}</ul>
              </section>
            )}
            <section aria-label="Browse"><h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/50">Or browse</h2><div className="mt-2"><CategoryTiles cols="grid-cols-2 sm:grid-cols-4" /></div><ul className="mt-4 flex flex-wrap gap-2">{QUICK_LINKS.filter((l) => l.to.includes('collection')).map((l) => <li key={l.label}><Link to={l.to} className={chip}>{l.label}</Link></li>)}</ul></section>
          </div>
        )}

        {status === 'ready' && meta.total > 0 && (
          <div className="mb-5 mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-y border-sand py-3">
            <p aria-live="polite" className="text-[15px] text-ink/65"><b className="tabular-nums text-ink">{meta.total}</b> {meta.total === 1 ? 'piece' : 'pieces'} for “{q}”</p>
            <label className="relative">
              <span className="sr-only">Sort by</span>
              <select value={sort} onChange={(e) => setParams((p) => { const n = new URLSearchParams(p); if (e.target.value === 'relevance') n.delete('sort'); else n.set('sort', e.target.value); return n }, { preventScrollReset: true })}
                className="h-11 cursor-pointer appearance-none rounded-full border border-ink/80 bg-cream pl-4 pr-10 text-[12px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-olive">
                {SORT_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
            </label>
          </div>
        )}

        {status === 'error' && (
          <div role="alert" className="mt-4 flex flex-wrap items-center gap-4 rounded-[24px] border border-red-600/25 bg-red-50 px-5 py-4 text-red-800">
            <CircleAlert size={20} aria-hidden /><span className="flex-1 text-[15px]">We couldn’t search just now.</span>
            <button type="button" onClick={() => { setData({ key: '', status: 'loading', items: [], meta: null }); setAttempt((n) => n + 1) }} className="h-10 rounded-full bg-red-800 px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-red-900">Try again</button>
          </div>
        )}

        {(status === 'loading' || (status === 'ready' && items.length > 0)) && (
          <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {status === 'ready' ? items.map((p) => <ProductCard key={p.id} p={p} kind="shop" />) : <Skeleton />}
          </ul>
        )}

        {status === 'ready' && items.length > 0 && hasMore && (
          <div className="mt-10 flex justify-center">
            <button type="button" onClick={loadMore} disabled={more} className="inline-flex h-14 items-center gap-3 rounded-full border border-ink px-9 text-[13px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white disabled:cursor-wait disabled:opacity-70">
              {more ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden />Loading…</> : `Show more (${meta.total - items.length} left)`}
            </button>
          </div>
        )}

        {status === 'ready' && items.length === 0 && (
          <div className="mt-8 max-w-2xl rounded-[28px] border border-sand bg-white/50 px-6 py-10 sm:px-9">
            <span className="grid size-14 place-items-center rounded-full bg-sand/60 text-ink/60"><SearchIcon size={24} aria-hidden /></span>
            <h2 className="mt-4 text-[26px] font-black uppercase italic leading-none tracking-tight">Nothing for “{q}”</h2>
            <p className="mt-3 text-[15px] text-ink/65">Check the spelling, or try a colour, a print name or a kind of piece, like “hoodie” or “olive”.</p>
            <ul className="mt-5 flex flex-wrap gap-2">{QUICK_LINKS.map((l) => <li key={l.label}><Link to={l.to} className={chip}>{l.label}</Link></li>)}</ul>
          </div>
        )}
      </div>
    </section>
  )
}
