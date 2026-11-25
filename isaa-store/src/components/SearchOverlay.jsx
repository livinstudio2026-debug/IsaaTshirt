import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUpLeft, CircleAlert, Clock, Search, X } from 'lucide-react'
import { searchProducts, sized, discount } from '../lib/api'
import { displayName, inr, kindLine } from '../lib/format'
import { forgetSearches, readRecent, rememberSearch } from '../lib/recentSearches'
import { QUICK_LINKS, chip } from '../lib/searchLinks'
import CategoryTiles from './CategoryTiles'
import Highlight from './Highlight'

const label = 'text-[11px] font-bold uppercase tracking-[0.16em] text-ink/50'

// The search panel: opens from the magnifier (or the / key), suggests pieces as you type, and "See all" opens the full results page.
// Phones get a full-screen sheet, larger screens a panel dropping from the top. Arrow keys move between the box and the
// suggestions; Esc closes; Enter searches.
export default function SearchOverlay({ onClose }) {
  const navigate = useNavigate()
  const panel = useRef(null)
  const input = useRef(null)
  const [term, setTerm] = useState('')
  const [recent, setRecent] = useState(readRecent)
  const [result, setResult] = useState({ q: '', status: 'idle', items: [], total: 0 })
  const q = term.trim()
  const searching = q.length >= 2
  const fresh = result.q === q
  const loading = searching && !fresh
  const items = searching && fresh ? result.items : []

  useEffect(() => {
    input.current?.focus()
    document.documentElement.classList.add('is-search-open')
    return () => document.documentElement.classList.remove('is-search-open')
  }, [])

  // wait for a pause in typing, and forget answers for words already replaced
  useEffect(() => {
    if (q.length < 2) return
    const ac = new AbortController()
    const t = setTimeout(() => {
      searchProducts({ q, limit: 6 }, ac.signal).then(
        ({ items: found, meta }) => setResult({ q, status: 'ready', items: found, total: meta.total }),
        (err) => { if (err.name !== 'AbortError') setResult({ q, status: 'error', items: [], total: 0 }) },
      )
    }, 220)
    return () => { clearTimeout(t); ac.abort() }
  }, [q])

  const results = (text) => `/search?q=${encodeURIComponent(text)}`
  const submit = (e) => {
    e.preventDefault()
    if (!q) return input.current?.focus()
    setRecent(rememberSearch(q))
    onClose()
    navigate(results(q))
  }
  const picked = () => { if (q) rememberSearch(q); onClose() }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    const stops = [...panel.current.querySelectorAll('[data-stop]')].filter((el) => !el.disabled)
    const at = stops.indexOf(document.activeElement)
    if (e.key === 'Tab') { // keep Tab inside the panel
      const last = stops.length - 1
      if (e.shiftKey && at <= 0) { e.preventDefault(); stops[last]?.focus() } else if (!e.shiftKey && at === last) { e.preventDefault(); stops[0]?.focus() }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // arrows walk the box and the suggestions; the clear and close buttons are reached with Tab
      const walk = stops.filter((el) => !el.hasAttribute('data-skip-arrows'))
      const here = walk.indexOf(document.activeElement)
      if (!walk.length || here < 0) return
      e.preventDefault()
      walk[e.key === 'ArrowDown' ? Math.min(here + 1, walk.length - 1) : Math.max(here - 1, 0)]?.focus()
    }
  }

  const row = 'group flex items-center gap-3.5 rounded-[20px] border border-transparent p-2 outline-none transition-colors hover:border-sand hover:bg-white/70 focus-visible:border-olive focus-visible:bg-white sm:gap-4 sm:p-2.5'
  return (
    <div role="dialog" aria-modal="true" aria-label="Search the shop" className="fixed inset-0 z-[80]" onKeyDown={onKeyDown}>
      <div aria-hidden onClick={onClose} className="absolute inset-0 animate-[fade-in_.2s_ease-out_both] bg-ink/55 backdrop-blur-sm motion-reduce:animate-none" />
      <div ref={panel} className="relative mx-auto flex h-dvh w-full max-w-4xl animate-[rise_.3s_ease-out_both] flex-col overflow-hidden bg-cream pt-[env(safe-area-inset-top)] shadow-[0_30px_80px_-20px_rgba(0,0,0,.5)] motion-reduce:animate-none sm:mt-5 sm:h-auto sm:max-h-[min(88dvh,46rem)] sm:rounded-[32px] sm:pt-0">
        <form role="search" onSubmit={submit} className="flex items-center gap-2 border-b border-sand px-3 py-3 sm:gap-3 sm:px-5 sm:py-4">
          <button data-stop data-skip-arrows type="button" onClick={onClose} aria-label="Close search" className="grid size-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-sand/60 sm:hidden"><ArrowLeft size={22} aria-hidden /></button>
          <div className="relative min-w-0 flex-1">
            <Search size={20} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/50" />
            <input ref={input} data-stop type="search" value={term} onChange={(e) => setTerm(e.target.value)} maxLength={60} enterKeyHint="search" autoComplete="off" autoCapitalize="off" spellCheck="false"
              placeholder="Search tees, hoodies, colours…" aria-label="Search the shop"
              className="h-12 w-full rounded-full border border-ink/20 bg-white/80 pl-12 pr-12 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-ink/40 hover:border-ink/40 focus:border-olive focus:bg-white focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)] [&::-webkit-search-cancel-button]:hidden sm:h-14 sm:text-[17px]" />
            {term && <button data-stop data-skip-arrows type="button" onClick={() => { setTerm(''); input.current?.focus() }} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink/55 transition-colors hover:bg-sand/70 hover:text-ink sm:size-10"><X size={18} aria-hidden /></button>}
          </div>
          <button data-stop data-skip-arrows type="button" onClick={onClose} className="hidden h-11 shrink-0 items-center gap-2 rounded-full border border-ink/25 px-4 text-[12px] font-bold uppercase tracking-wide transition-colors hover:border-ink hover:bg-ink hover:text-white sm:inline-flex">Close <kbd className="rounded border border-current/30 px-1 text-[10px] font-semibold opacity-60">Esc</kbd></button>
        </form>

        <div aria-live="polite" className="sr-only">{searching && fresh ? (result.status === 'error' ? 'Search failed' : `${result.total} ${result.total === 1 ? 'result' : 'results'}`) : ''}</div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
          {!searching && (
            <div className="grid gap-7 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:gap-8">
              <div className="space-y-6">
                {q.length === 1 && <p className="text-[14px] text-ink/55">Keep typing…</p>}
                {recent.length > 0 && (
                  <section aria-label="Recent searches">
                    <div className="flex items-center justify-between"><h2 className={label}>Recent</h2><button data-stop type="button" onClick={() => setRecent(forgetSearches())} className="text-[12px] font-bold uppercase tracking-wide text-ink/55 underline-offset-4 hover:text-ink hover:underline">Clear</button></div>
                    <ul className="mt-2 space-y-0.5">{recent.map((r) => (
                      <li key={r}><Link data-stop to={results(r)} onClick={onClose} className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-[15px] outline-none transition-colors hover:bg-white/70 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-olive">
                        <Clock size={15} aria-hidden className="shrink-0 text-ink/40" /><span className="min-w-0 flex-1 truncate">{r}</span><ArrowUpLeft size={15} aria-hidden className="shrink-0 text-ink/30 transition-colors group-hover:text-olive" />
                      </Link></li>
                    ))}</ul>
                  </section>
                )}
                <section aria-label="Collections">
                  <h2 className={label}>Collections</h2>
                  <ul className="mt-2 flex flex-wrap gap-2">{QUICK_LINKS.filter((l) => l.to.includes('collection')).map((l) => <li key={l.label}><Link data-stop to={l.to} onClick={onClose} className={chip}>{l.label}</Link></li>)}</ul>
                </section>
              </div>
              <section aria-label="Shop by category">
                <h2 className={label}>Shop by category</h2>
                <div className="mt-2"><CategoryTiles stop onPick={onClose} /></div>
              </section>
            </div>
          )}

          {loading && (
            <ul aria-hidden className="grid gap-1 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <li key={i} className="flex animate-pulse items-center gap-4 p-2.5 motion-reduce:animate-none"><div className="size-[72px] shrink-0 rounded-2xl bg-sand/60" /><div className="flex-1 space-y-2"><div className="h-4 w-2/3 rounded bg-sand/70" /><div className="h-3 w-1/3 rounded bg-sand/50" /></div></li>)}</ul>
          )}

          {searching && fresh && result.status === 'error' && (
            <p role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />We couldn’t search just now. Check your connection and try again.</p>
          )}

          {items.length > 0 && (
            <>
              <p className={`${label} px-1 pb-2`}>{result.total} {result.total === 1 ? 'piece' : 'pieces'}</p>
              <ul className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
                {items.map((p) => (
                  <li key={p.slug}>
                    <Link data-stop to={`/product/${p.slug}`} onClick={picked} className={row}>
                      <span className="relative block size-[72px] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-sand/80 to-sand/40 sm:size-20"><img src={sized(p.img, 200)} alt="" loading="lazy" width="80" height="80" className={`size-full object-contain p-1.5 transition-transform duration-300 group-hover:scale-105 ${p.inStock === false ? 'opacity-50 saturate-50' : ''}`} /></span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[15px] font-black uppercase italic leading-tight tracking-tight"><Highlight text={displayName(p)} q={q} /></b>
                        <span className="mt-0.5 block truncate text-[12.5px] text-ink/55"><Highlight text={kindLine(p)} q={q} /></span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <b className="text-[14px] tabular-nums">{inr(p.price)}</b>
                          {p.inStock === false
                            ? <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Sold out</span>
                            : <><s className="text-[12px] tabular-nums text-ink/40">{inr(p.mrp)}</s><span className="text-[11px] font-bold text-olive">{discount(p)}% off</span></>}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {searching && fresh && result.status === 'ready' && items.length === 0 && (
            <div className="px-1 py-3">
              <span className="grid size-12 place-items-center rounded-full bg-sand/60 text-ink/60"><Search size={22} aria-hidden /></span>
              <p className="mt-3 text-[20px] font-black uppercase italic leading-none tracking-tight">Nothing for “{q}”</p>
              <p className="mt-2 text-[14px] text-ink/60">Check the spelling, or try a colour, a print or a kind of piece, like “hoodie” or “olive”.</p>
              <ul className="mt-4 flex flex-wrap gap-2">{QUICK_LINKS.slice(0, 5).map((l) => <li key={l.label}><Link data-stop to={l.to} onClick={onClose} className={chip}>{l.label}</Link></li>)}</ul>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-sand bg-cream px-3 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-4">
            <Link data-stop to={results(q)} onClick={picked} className="flex h-13 items-center justify-between gap-3 rounded-full bg-ink px-6 text-[13px] font-bold uppercase tracking-wide text-white outline-none transition-colors hover:bg-olive focus-visible:ring-2 focus-visible:ring-olive focus-visible:ring-offset-2 focus-visible:ring-offset-cream">
              <span className="min-w-0 truncate">See all {result.total} {result.total === 1 ? 'result' : 'results'} for “{q}”</span><ArrowRight size={17} aria-hidden className="shrink-0" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
