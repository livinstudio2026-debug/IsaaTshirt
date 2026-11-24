import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleAlert, Heart, Trash2 } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { fetchBySlugs } from '../lib/api'
import { useWishlist } from '../lib/wishlistContext'
import underline from '../assets/featuredDrop/underline-stroke.webp'

function Skeleton({ n }) {
  return Array.from({ length: Math.min(Math.max(n, 2), 8) }, (_, i) => (
    <li key={i} aria-hidden className="flex">
      <div className="w-full animate-pulse rounded-[22px] border border-sand bg-cream p-2 motion-reduce:animate-none sm:rounded-[28px] sm:p-2.5">
        <div className="aspect-[4/4.5] rounded-[16px] bg-sand/60 sm:rounded-[20px]" />
        <div className="mt-3 h-4 w-2/3 rounded bg-sand/70" /><div className="mt-2 h-3 w-1/3 rounded bg-sand/50" />
        <div className="mt-4 flex items-center justify-between"><div className="h-5 w-1/3 rounded bg-sand/70" /><div className="h-10 w-10 rounded-full bg-sand/70" /></div>
      </div>
    </li>
  ))
}

// Everything the shopper has hearted, with live prices and stock. Saved on this device (no account needed).
export default function Wishlist() {
  const { slugs, count, has, clear, remove } = useWishlist()
  const [attempt, setAttempt] = useState(0)
  const [byslug, setByslug] = useState({}) // everything fetched this visit (null = no longer sold), so Undo brings a piece straight back
  const [failed, setFailed] = useState('') // the request (pieces + attempt) that last failed
  const [sure, setSure] = useState(false)

  useEffect(() => { document.title = 'Wishlist — Isaa'; return () => { document.title = 'Isaa — Wear the Vibe' } }, [])

  // fetch only what we haven't got yet. No "already asked" guard: React StrictMode runs effects twice in dev, and a guard
  // would let the first (cancelled) request count as done, leaving the page loading forever.
  const need = slugs.filter((s) => !(s in byslug))
  const needKey = need.join(',')
  const errored = needKey !== '' && failed === `${needKey}|${attempt}`
  useEffect(() => {
    if (!needKey) return
    const list = needKey.split(',')
    const ac = new AbortController()
    fetchBySlugs(list, ac.signal).then(
      (found) => {
        setByslug((d) => ({ ...d, ...Object.fromEntries(list.map((s) => [s, found.find((p) => p.slug === s) ?? null])) }))
      },
      (err) => { if (err.name !== 'AbortError') setFailed(`${needKey}|${attempt}`) },
    )
    return () => ac.abort()
  }, [needKey, attempt])

  const items = slugs.map((s) => byslug[s]).filter(Boolean)
  const gone = slugs.filter((s) => byslug[s] === null) // saved, but no longer in the shop
  const loading = need.length > 0 && !errored
  const soldOut = items.filter((p) => p.inStock === false).length

  return (
    <section aria-labelledby="wish-heading" className="bg-cream pb-24 pt-10 sm:pb-28 lg:pb-[7vw] lg:pt-[3.4vw]">
      <div className="mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h1 id="wish-heading" className="font-black italic uppercase leading-[0.92] tracking-[-0.02em] text-[11vw] sm:text-[7vw] lg:text-[4.4vw]" style={{ fontVariationSettings: '"wdth" 84' }}>Your wishlist</h1>
            <img aria-hidden src={underline} alt="" className="mt-[1vw] h-[2.6vw] w-[min(60%,300px)] object-fill sm:h-[1.6vw] lg:mt-[0.4vw] lg:h-[0.9vw]" />
          </div>
          {count > 0 && (
            sure
              ? <span className="flex items-center gap-2"><span className="text-[14px] font-medium">Remove all {count}?</span>
                  <button type="button" onClick={() => { clear(); setSure(false) }} className="h-10 rounded-full bg-ink px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-red-700">Yes, clear</button>
                  <button type="button" onClick={() => setSure(false)} className="h-10 rounded-full border border-ink/25 px-5 text-[12px] font-bold uppercase tracking-wide hover:border-ink">Keep</button></span>
              : <button type="button" onClick={() => setSure(true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-ink/25 px-5 text-[12px] font-bold uppercase tracking-wide transition-colors hover:border-ink hover:bg-ink hover:text-white"><Trash2 size={15} aria-hidden />Clear all</button>
          )}
        </div>

        {count > 0 && <p className="mt-5 text-[15px] text-ink/65"><b className="tabular-nums text-ink">{count}</b> saved on this device{soldOut > 0 && ` · ${soldOut} sold out right now`}. Open a piece to pick a size and add it to your bag.</p>}

        {errored && (
          <div role="alert" className="mt-6 flex flex-wrap items-center gap-4 rounded-[24px] border border-red-600/25 bg-red-50 px-5 py-4 text-red-800">
            <CircleAlert size={20} aria-hidden /><span className="flex-1 text-[15px]">We couldn’t load your saved pieces.</span>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="h-10 rounded-full bg-red-800 px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-red-900">Try again</button>
          </div>
        )}

        {count === 0 ? (
          <div className="mt-8 max-w-2xl rounded-[28px] border border-sand bg-white/50 px-6 py-10 sm:px-9">
            <span className="grid size-14 place-items-center rounded-full bg-olive/12 text-olive"><Heart size={24} aria-hidden /></span>
            <h2 className="mt-4 text-[26px] font-black uppercase italic leading-none tracking-tight">Nothing saved yet</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink/65">Tap the heart on any piece to keep it here. It stays on this device, so you can come back to it later.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/shop" className="inline-flex h-12 items-center gap-2.5 rounded-full bg-ink px-7 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Shop all <ArrowRight size={16} aria-hidden /></Link>
              <Link to="/shop?collection=new" className="inline-flex h-12 items-center rounded-full border border-ink px-7 text-[13px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white">New arrivals</Link>
            </div>
          </div>
        ) : (
          <ul className="mt-8 grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {loading ? <Skeleton n={need.length} /> : items.filter((p) => has(p.slug)).map((p) => <ProductCard key={p.id} p={p} kind="shop" />)}
          </ul>
        )}

        {gone.length > 0 && !loading && (
          <p className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-dashed border-sand px-5 py-4 text-[14px] text-ink/65">
            {gone.length === 1 ? '1 saved piece is' : `${gone.length} saved pieces are`} no longer in the shop.
            <button type="button" onClick={() => gone.forEach(remove)} className="font-bold uppercase tracking-wide text-ink underline underline-offset-4 hover:text-olive">Remove {gone.length === 1 ? 'it' : 'them'}</button>
          </p>
        )}
      </div>
    </section>
  )
}
