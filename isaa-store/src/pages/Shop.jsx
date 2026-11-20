import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, ArrowUp, ChevronDown, Flame, LoaderCircle, Sparkle, Zap } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import NotFound from './NotFound'
import { fetchProducts } from '../lib/api'
import { SHOP_CATEGORIES, COLLECTIONS, SORTS } from '../data/shop'
import { decor } from '../data/categories'
import { marquee } from '../data/marquee'

import hanger from '../assets/featuredDrop/hanger.webp'
import limitedTag from '../assets/featuredDrop/limited-tag.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'
import panel from '../assets/ShopByCategory/panel-tshirts.webp'
import brushL from '../assets/hero/tshirts/brush-left.webp'
import brushR from '../assets/featuredDrop/brush-right.webp'
import buildingL from '../assets/featuredDrop/building-left.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const COLLECTION_ICON = { new: Sparkle, bestsellers: Flame, limited: Zap }

// ---------------------------------------------------------------- small pieces

// the number on the paper tag counts up when the total arrives
function Count({ value }) {
  const ref = useRef(null)
  useGSAP(() => {
    if (value == null || !ref.current) return
    if (calm()) { ref.current.textContent = value; return }
    const o = { n: 0 }
    gsap.to(o, { n: value, duration: 1, ease: 'power2.out', onUpdate: () => { if (ref.current) ref.current.textContent = Math.round(o.n) } })
  }, { dependencies: [value] })
  return <b ref={ref} className="tabular-nums">{value ?? '–'}</b>
}

function MarqueeBand() {
  return (
    <div aria-hidden className="relative overflow-hidden bg-ink py-3 text-cream">
      <div className="flex w-max animate-[marquee_46s_linear_infinite] motion-reduce:animate-none">
        {[0, 1, 2, 3].map((n) => (
          <ul key={n} className="flex shrink-0 items-center">
            {marquee.map((m) => (
              <li key={m} className="flex items-center gap-6 whitespace-nowrap pr-6 text-[12px] font-bold uppercase tracking-[0.22em] sm:text-[13px]">
                {m}<Sparkle size={13} className="fill-amber-300 text-amber-300" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}

function SortSelect({ value, onChange, className = '' }) {
  return (
    <label className={`relative shrink-0 ${className}`}>
      <span className="sr-only">Sort by</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-11 cursor-pointer appearance-none rounded-full border border-ink/80 bg-cream pl-4 pr-10 text-[12px] font-bold uppercase tracking-wide outline-none transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-olive">
        {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <ChevronDown size={16} aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
    </label>
  )
}

function Skeleton() {
  return Array.from({ length: 8 }, (_, i) => (
    <li key={i} aria-hidden className="flex">
      <div className="w-full animate-pulse rounded-[22px] border border-sand bg-cream p-2 sm:rounded-[28px] sm:p-2.5">
        <div className="aspect-[4/4.5] rounded-[16px] bg-sand/60 sm:rounded-[20px]" />
        <div className="mt-3 h-4 w-2/3 rounded bg-sand/70" />
        <div className="mt-2 h-3 w-1/3 rounded bg-sand/50" />
        <div className="mt-4 flex items-center justify-between"><div className="h-5 w-1/3 rounded bg-sand/70" /><div className="h-10 w-10 rounded-full bg-sand/70" /></div>
      </div>
    </li>
  ))
}

// editorial tile dropped into the grid after the first row
function Spotlight() {
  return (
    <li data-sb="card" className="col-span-2 flex">
      <div className="relative isolate flex w-full flex-col justify-between gap-6 overflow-hidden rounded-[22px] bg-olive p-6 text-white sm:rounded-[28px] sm:p-8 lg:p-[2vw]">
        <img src={panel} alt="" aria-hidden loading="lazy" decoding="async" className="absolute left-1/2 top-1/2 -z-10 h-[140%] w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-olive/55 mix-blend-multiply" />
        <img src={brushL} alt="" aria-hidden loading="lazy" decoding="async" className="pointer-events-none absolute -bottom-8 -left-6 -z-10 w-40 opacity-30 sm:w-56" />
        <img data-sb="swing" src={hanger} alt="" aria-hidden width="1150" height="697" loading="lazy" decoding="async" className="pointer-events-none absolute -top-2 right-4 w-[30%] max-w-[190px] origin-top drop-shadow-[0_10px_12px_rgba(0,0,0,.35)] sm:right-8" />
        <img src={limitedTag} alt="" aria-hidden width="1539" height="501" loading="lazy" decoding="async" className="pointer-events-none absolute bottom-4 right-4 w-[34%] max-w-[210px] rotate-[-6deg] drop-shadow-[0_8px_10px_rgba(0,0,0,.35)] sm:bottom-6 sm:right-8" />
        <div className="max-w-[24rem]">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300 sm:text-[12px]"><Sparkle size={13} className="fill-amber-300" aria-hidden /> Limited runs</p>
          <h3 className="mt-3 font-black italic uppercase leading-[0.92] tracking-tight text-[clamp(28px,3.2vw,56px)]" style={{ fontVariationSettings: '"wdth" 84' }}>Small runs.<br />Big energy.</h3>
          <p className="mt-3 max-w-[20rem] text-[14px] leading-relaxed text-cream/80 sm:text-[15px]">Bold prints made in limited numbers. Grab yours before they sell out.</p>
        </div>
        <Link to="/shop?collection=limited" className="group inline-flex w-fit items-center gap-3 rounded-full bg-cream px-6 py-3.5 text-[12px] font-bold uppercase tracking-wide text-ink transition-colors hover:bg-white sm:text-[13px]">
          Shop limited <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </li>
  )
}

function Empty({ cat, filtered, onClear }) {
  return (
    <div className="relative grid place-items-center overflow-hidden rounded-[28px] border border-sand bg-cream px-5 py-14 text-center sm:py-20">
      <img src={hanger} alt="" aria-hidden width="1150" height="697" className="w-28 origin-top animate-[swing_4s_ease-in-out_infinite] motion-reduce:animate-none sm:w-36" />
      <h3 className="mt-4 font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(28px,4vw,56px)]" style={{ fontVariationSettings: '"wdth" 84' }}>Nothing here… yet</h3>
      <p className="mt-3 max-w-sm text-[15px] text-ink/60">{filtered ? 'No pieces match these filters.' : cat.empty}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        {filtered && <button type="button" onClick={onClear} className="rounded-full bg-ink px-7 py-3.5 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Clear filters</button>}
        {cat.id && <Link to="/shop" className="inline-flex items-center rounded-full border border-ink px-7 py-3.5 text-[13px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white">Shop all</Link>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- page

export default function Shop() {
  const { category = '' } = useParams()
  const cat = SHOP_CATEGORIES.find((c) => c.id === category)
  return cat ? <ShopView cat={cat} /> : <NotFound />
}

function ShopView({ cat }) {
  const [params, setParams] = useSearchParams()
  const collection = COLLECTIONS.some((c) => c.id === params.get('collection')) ? params.get('collection') : ''
  const sort = SORTS.some((s) => s.id === params.get('sort')) ? params.get('sort') : 'newest'
  const filtered = Boolean(collection) || sort !== 'newest'

  const [attempt, setAttempt] = useState(0)
  const key = `${cat.id}|${collection}|${sort}|${attempt}`
  // `key` tags the data, so a filter change shows the skeleton without setting state inside an effect
  const [data, setData] = useState({ key: '', status: 'loading', items: [], meta: null })
  const [more, setMore] = useState(false)
  const [liked, setLiked] = useState(() => new Set())
  const keyRef = useRef(key)
  const root = useRef(null)
  const head = useRef(null)
  const grid = useRef(null)
  const pills = useRef(null)
  const firstKey = useRef(true)

  useEffect(() => {
    keyRef.current = key
    const ac = new AbortController()
    fetchProducts({ category: cat.id, collection, sort, page: 1 }, ac.signal)
      .then(({ items, meta }) => setData({ key, status: 'ready', items, meta }))
      .catch((err) => { if (err.name !== 'AbortError') setData({ key, status: 'error', items: [], meta: null }) })
    return () => ac.abort()
  }, [key, cat.id, collection, sort])

  const fresh = data.key === key
  const status = fresh ? data.status : 'loading'
  const items = fresh ? data.items : []
  const meta = fresh ? data.meta : null
  const total = meta?.total ?? null
  const hasMore = meta ? meta.page < meta.pages : false

  const loadMore = async () => {
    if (more || !meta) return
    setMore(true)
    const at = key
    try {
      const next = await fetchProducts({ category: cat.id, collection, sort, page: meta.page + 1 })
      if (keyRef.current !== at) return // filters changed while loading
      setData((d) => (d.key === at ? { ...d, items: [...d.items, ...next.items], meta: next.meta } : d))
    } catch { /* keep what we have; the button stays so they can try again */ }
    setMore(false)
  }

  const toggleLike = (id) => setLiked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const setParam = (name, value, fallback) => setParams((prev) => {
    const n = new URLSearchParams(prev)
    if (!value || value === fallback) n.delete(name); else n.set(name, value)
    return n
  }, { preventScrollReset: true })
  const clearFilters = () => setParams({}, { preventScrollReset: true })

  // after the first paint, switching category/filter brings the grid back into view (only if you've scrolled past it)
  useEffect(() => {
    if (firstKey.current) { firstKey.current = false; return }
    const el = grid.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 200
    if (window.scrollY > top) window.scrollTo({ top, behavior: calm() ? 'auto' : 'smooth' })
  }, [key])

  // keep the active category pill in view in the scrolling bar
  useEffect(() => {
    pills.current?.querySelector('[aria-current=page]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: calm() ? 'auto' : 'smooth' })
  }, [cat.id])

  // ---- header: plays on arrival and whenever the category changes ----
  useGSAP(() => {
    if (calm()) return
    const q = (s) => head.current.querySelectorAll(s)
    gsap.set(q('[data-sh=hanger]'), { rotate: -3, transformOrigin: '50% 0%' })
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from(q('[data-sh=crumbs]'), { autoAlpha: 0, y: 10, duration: 0.6 }, 0)
      .from(q('[data-sh=eyebrow]'), { autoAlpha: 0, y: 14, duration: 0.7 }, 0.05)
      .from(q('[data-sh=line]'), { yPercent: 115, duration: 0.9, ease: 'power4.out' }, 0.1)
      .fromTo(q('[data-sh=script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -14 }, { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 0.35)
      .fromTo(q('[data-sh=underline]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.8, ease: 'power2.inOut' }, 0.6)
      .from(q('[data-sh=blurb]'), { autoAlpha: 0, y: 18, duration: 0.8, clearProps: 'transform,opacity,visibility' }, 0.5)
      .from(q('[data-sh=tag]'), { autoAlpha: 0, scale: 0.7, rotate: 8, duration: 0.8, ease: 'back.out(1.8)', clearProps: 'opacity,visibility' }, 0.7)
      .from(q('[data-sh=hanger]'), { yPercent: -110, duration: 1.1, ease: 'power3.out' }, 0.15)
      .from(q('[data-sh=decor]'), { autoAlpha: 0, duration: 1.4, stagger: 0.15 }, 0)
    gsap.fromTo(q('[data-sh=hanger]'), { rotate: -3 }, { rotate: 3, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.2 })
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const st = { trigger: head.current, start: 'top top', end: 'bottom top', scrub: 0.6 }
      gsap.to(q('[data-sh=drift-a]'), { y: 70, ease: 'none', scrollTrigger: st })
      gsap.to(q('[data-sh=drift-b]'), { y: -50, ease: 'none', scrollTrigger: st })
    })
    return () => mm.revert()
  }, { scope: head, dependencies: [cat.id], revertOnUpdate: true })

  // ---- cards: each card rises as it scrolls into view; load-more only animates the new ones ----
  useGSAP(() => {
    const cards = root.current ? [...root.current.querySelectorAll('[data-sb=card]:not([data-seen])')] : []
    if (!cards.length) return
    if (calm()) { cards.forEach((c) => { c.dataset.seen = '1' }); return }
    cards.forEach((c) => { c.dataset.seen = '1' })
    gsap.set(cards, { autoAlpha: 0, y: 56, rotate: (i) => (i % 2 ? 2 : -2) })
    ScrollTrigger.batch(cards, {
      start: 'top 94%',
      once: true,
      onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.8, ease: 'power3.out', stagger: 0.09, overwrite: true, clearProps: 'transform,opacity,visibility' }),
    })
    gsap.utils.toArray(root.current.querySelectorAll('[data-sb=swing]')).forEach((h) => {
      gsap.killTweensOf(h)
      gsap.fromTo(h, { rotate: -3, transformOrigin: '50% 0%' }, { rotate: 3, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    })
    // a StrictMode remount reverts the tweens above, so let the next run treat these cards as new again
    return () => root.current?.querySelectorAll('[data-seen]').forEach((c) => { delete c.dataset.seen })
  }, { scope: root, dependencies: [data.items, status] })

  const showSpotlight = collection !== 'limited' && items.length >= 5
  const cards = items.flatMap((p, i) => {
    const card = <ProductCard key={p.id} p={p} kind="shop" liked={liked.has(p.id)} onLike={toggleLike} />
    return showSpotlight && i === 4 ? [<Spotlight key="spotlight" />, card] : [card]
  })

  return (
    <div ref={root}>
      {/* ------------------------------------------------ header */}
      <section ref={head} aria-labelledby="sh-heading" className="relative isolate overflow-hidden bg-cream pb-10 pt-7 sm:pb-14 sm:pt-10 lg:pb-[3.6vw] lg:pt-[2.4vw]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div data-sh="drift-a" className="absolute -left-[4%] top-[6%] w-[34%] sm:w-[22%] lg:w-[15%]"><img data-sh="decor" src={brushL} alt="" loading="lazy" decoding="async" className="w-full opacity-70" /></div>
          <div data-sh="drift-b" className="absolute -right-[3%] bottom-[2%] h-[46%] sm:h-[56%]"><img data-sh="decor" src={brushR} alt="" loading="lazy" decoding="async" className="h-full w-auto opacity-60" /></div>
          <img data-sh="decor" src={buildingL} alt="" loading="lazy" decoding="async" className="absolute -left-[3%] bottom-0 hidden h-[78%] w-auto opacity-[.14] xl:block" />
          <img data-sh="decor" src="/squiggle.svg" alt="" className="absolute bottom-[14%] right-[28%] hidden w-[7vw] min-w-16 opacity-60 lg:block" />
        </div>

        {/* hanging from the navbar */}
        <img data-sh="hanger" src={hanger} alt="" aria-hidden width="1150" height="697" className="pointer-events-none absolute -top-[1px] right-[6vw] w-[24vw] origin-top drop-shadow-[0_14px_14px_rgba(70,45,15,.25)] sm:right-[9vw] sm:w-[15vw] lg:w-[11vw]" />

        <div className="relative mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
          <nav data-sh="crumbs" aria-label="Breadcrumb" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink/55">
            <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <li><Link to="/" className="transition-colors hover:text-ink">Home</Link></li>
              <li aria-hidden className="text-olive">/</li>
              <li>{cat.id ? <Link to="/shop" className="transition-colors hover:text-ink">Shop</Link> : <span aria-current="page" className="text-ink">Shop</span>}</li>
              {cat.id && (<><li aria-hidden className="text-olive">/</li><li><span aria-current="page" className="text-ink">{cat.label}</span></li></>)}
            </ol>
          </nav>

          <div className="mt-6 grid items-end gap-6 lg:mt-[1.6vw] lg:grid-cols-[1fr_auto] lg:gap-[5vw]">
            <div>
              <p data-sh="eyebrow" className="inline-flex items-center gap-4 text-[clamp(11px,.9vw,17px)] font-bold uppercase tracking-[0.22em]">
                <span>Shop the Rack <span className="mx-1 text-olive">/</span> <span className="text-olive">{cat.id ? cat.label : 'All pieces'}</span></span>
              </p>
              <h1 id="sh-heading" className="mt-[1.4vw] sm:mt-[1vw] lg:mt-[0.6vw]">
                <span className="-mx-[0.12em] -my-[0.05em] block overflow-hidden px-[0.12em] py-[0.05em]">
                  <span data-sh="line" className="cat-grunge block font-black italic uppercase leading-[0.92] tracking-[-0.025em] text-[15vw] sm:text-[11vw] lg:text-[7.4vw]" style={{ '--tex': `url(${decor.texture})`, fontVariationSettings: '"wdth" 84' }}>{cat.title}</span>
                </span>
              </h1>
              <div className="mt-[1vw] inline-block -rotate-2 lg:mt-[0.1vw]">
                <p data-sh="script" className="whitespace-nowrap font-script text-[9.5vw] leading-[1.1] text-olive sm:text-[6.6vw] lg:text-[3.4vw]">{cat.script}</p>
                <div aria-hidden className="mt-[0.8vw] flex lg:mt-[0.3vw]"><img data-sh="underline" src={underline} alt="" loading="lazy" decoding="async" className="h-[2.6vw] w-[92%] object-fill lg:h-[1.1vw]" /></div>
              </div>
            </div>

            <div className="flex items-center gap-5 lg:max-w-[440px] lg:flex-col lg:items-end lg:gap-6 lg:pb-[0.6vw]">
              <span data-sh="tag" aria-live="polite" style={{ backgroundImage: `url(${decor.label})` }} className="grid aspect-[3.2/1] w-[150px] shrink-0 -rotate-3 place-items-center bg-contain bg-center bg-no-repeat pb-1 text-[15px] font-black italic uppercase tracking-tight sm:w-[170px] lg:w-[11vw] lg:min-w-[170px] lg:text-[clamp(14px,1.1vw,20px)]">
                <span><Count value={total} /> {total === 1 ? 'piece' : 'pieces'}</span>
              </span>
              <p data-sh="blurb" className="text-[clamp(14px,1vw,18px)] leading-relaxed text-ink/65 lg:text-right">{cat.blurb}</p>
            </div>
          </div>
        </div>
      </section>

      <MarqueeBand />

      {/* ------------------------------------------------ toolbar + grid (one wrapper so the toolbar can stick) */}
      <section aria-label="Products" className="relative bg-cream">
        <div className="z-30 border-b border-sand bg-cream/90 backdrop-blur lg:sticky lg:top-[114px]">
          <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:px-[6vw] lg:py-4">
            <nav ref={pills} aria-label="Categories" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
              {SHOP_CATEGORIES.map((c) => {
                const on = c.id === cat.id
                return (
                  <Link key={c.id || 'all'} to={{ pathname: c.to, search: params.toString() ? `?${params}` : '' }} aria-current={on ? 'page' : undefined}
                    className={`shrink-0 rounded-full border px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide transition-colors duration-300 lg:text-[clamp(12px,.82vw,14px)] ${on ? 'border-ink bg-ink text-white' : 'border-ink/25 text-ink/75 hover:border-ink hover:text-ink'}`}>
                    {c.label}
                  </Link>
                )
              })}
            </nav>

            <div className="flex items-center gap-3">
              <div role="group" aria-label="Collection" className="-mx-5 flex min-w-0 flex-1 gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-none lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
                {COLLECTIONS.filter((c) => c.id).map((c) => {
                  const on = collection === c.id
                  const Icon = COLLECTION_ICON[c.id]
                  return (
                    <button key={c.id} type="button" aria-pressed={on} onClick={() => setParam('collection', on ? '' : c.id, '')}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide transition-colors duration-300 ${on ? 'border-olive bg-olive text-white' : 'border-sand bg-white/60 text-ink/75 hover:border-ink hover:text-ink'}`}>
                      <Icon size={13} className={on ? 'fill-amber-300 text-amber-300' : 'text-olive'} aria-hidden />{c.label}
                    </button>
                  )
                })}
              </div>

              <SortSelect value={sort} onChange={(v) => setParam('sort', v, 'newest')} className="hidden lg:block" />
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1680px] px-5 pb-[14vw] pt-6 sm:pb-[9vw] lg:px-[6vw] lg:pb-[5.4vw] lg:pt-[2vw]">
          <div className="mb-4 flex min-h-11 items-center justify-between gap-3 text-[13px] text-ink/60" aria-live="polite">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>{status === 'ready' && total != null ? (total === 0 ? 'No pieces found' : <>Showing <b className="text-ink">{items.length}</b> of <b className="text-ink">{total}</b></>) : '\u00a0'}</span>
              {filtered && <button type="button" onClick={clearFilters} className="font-bold uppercase tracking-wide text-olive underline decoration-olive/40 decoration-2 underline-offset-4 transition-colors hover:decoration-olive">Clear filters</button>}
            </p>
            <SortSelect value={sort} onChange={(v) => setParam('sort', v, 'newest')} className="lg:hidden" />
          </div>

          <div ref={grid} aria-busy={status === 'loading'}>
            {status === 'error' ? (
              <div className="grid place-items-center rounded-[28px] border border-sand bg-cream px-5 py-16 text-center">
                <div>
                  <p className="text-lg font-bold">We couldn’t load the collection.</p>
                  <p className="mt-1 text-ink/60">Check your connection and try again.</p>
                  <button type="button" onClick={() => setAttempt((n) => n + 1)} className="mt-5 rounded-full bg-ink px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Retry</button>
                </div>
              </div>
            ) : status === 'ready' && items.length === 0 ? (
              <Empty cat={cat} filtered={filtered} onClear={clearFilters} />
            ) : (
              <ul key={key} className="grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-4 lg:gap-5">
                {status === 'ready' ? cards : <Skeleton />}
              </ul>
            )}
          </div>

          {status === 'ready' && items.length > 0 && (
            <div className="mt-10 flex flex-col items-center gap-5 lg:mt-[3vw]">
              <div className="w-full max-w-[320px]" role="progressbar" aria-label="Pieces shown" aria-valuemin={0} aria-valuemax={total} aria-valuenow={items.length}>
                <div className="h-1 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-olive transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, (items.length / total) * 100)}%` }} /></div>
                <p className="mt-2 text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-ink/55">{items.length} of {total} pieces</p>
              </div>
              {hasMore ? (
                <button type="button" onClick={loadMore} disabled={more}
                  className="group inline-flex items-center gap-3 rounded-full border border-ink px-[clamp(28px,2.1vw,40px)] py-[clamp(14px,1vw,20px)] text-[clamp(13px,.85vw,16px)] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white disabled:cursor-wait disabled:opacity-70">
                  {more ? <><LoaderCircle size={18} className="animate-spin" aria-hidden /> Loading…</> : <>Load more <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden /></>}
                </button>
              ) : (
                <div className="text-center">
                  <p className="font-script text-[28px] leading-none text-olive">You’ve seen it all</p>
                  <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: calm() ? 'auto' : 'smooth' })} className="group mt-4 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide underline decoration-ink/30 decoration-2 underline-offset-8 transition-colors hover:decoration-olive">
                    Back to top <ArrowUp size={14} className="transition-transform duration-300 group-hover:-translate-y-0.5" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
