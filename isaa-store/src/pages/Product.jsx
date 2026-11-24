import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Banknote, Check, Flame, Heart, Minus, Plus, RotateCcw, ShoppingBag, Sparkle, Truck } from 'lucide-react'
import Gallery from '../components/pdp/Gallery'
import ProductCard from '../components/ProductCard'
import NotFound from './NotFound'
import { fetchProduct, fetchRelated, discount, sized } from '../lib/api'
import { FREE_SHIPPING_MIN, MAX_QTY, displayName, inr } from '../lib/format'
import { useWishlist } from '../lib/wishlistContext'
import { SHOP_CATEGORIES, taglineFor } from '../data/shop'
import { decor } from '../data/categories'

import underline from '../assets/featuredDrop/underline-stroke.webp'
import brushL from '../assets/hero/tshirts/brush-left.webp'
import brushR from '../assets/featuredDrop/brush-right.webp'
import buildingL from '../assets/featuredDrop/building-left.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const sizeName = (s) => (s === 'FREE' ? 'Free size' : s)
const LOW_STOCK = 5

// ---------------------------------------------------------------- loading + error

function PageSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading product" className="bg-cream pb-20 pt-7 sm:pt-10 lg:pt-[2.4vw]">
      <div className="mx-auto w-full max-w-[1680px] animate-pulse px-5 lg:px-[6vw]">
        <div className="h-3 w-56 rounded bg-sand/70" />
        <div className="mt-7 grid gap-8 lg:mt-[2vw] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:gap-[4vw]">
          <div className="aspect-[4/4.5] rounded-[22px] bg-sand/60 sm:rounded-[32px]" />
          <div className="space-y-5 lg:pt-6">
            <div className="h-6 w-28 rounded-full bg-sand/70" />
            <div className="h-14 w-4/5 rounded bg-sand/70" />
            <div className="h-6 w-1/3 rounded bg-sand/50" />
            <div className="h-10 w-1/2 rounded bg-sand/70" />
            <div className="h-12 w-full rounded-full bg-sand/60" />
            <div className="h-14 w-full rounded-full bg-sand/70" />
          </div>
        </div>
      </div>
    </section>
  )
}

function LoadError({ onRetry }) {
  return (
    <section className="grid min-h-[70vh] place-items-center bg-cream px-5 text-center" aria-live="polite">
      <div>
        <p className="text-lg font-bold">We couldn’t load this piece.</p>
        <p className="mt-1 text-ink/60">Check your connection and try again.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onRetry} className="rounded-full bg-ink px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Retry</button>
          <Link to="/shop" className="inline-flex items-center rounded-full border border-ink px-8 py-3 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white">Back to shop</Link>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- page (fetches, then hands off)

export default function Product({ onAdd = () => {} }) {
  const { slug = '' } = useParams()
  const [attempt, setAttempt] = useState(0)
  const key = `${slug}|${attempt}`
  // `key` tags the data, so moving to another product shows the skeleton without setting state inside an effect
  const [state, setState] = useState({ key: '', status: 'loading', product: null })

  useEffect(() => {
    const ac = new AbortController()
    fetchProduct(slug, ac.signal)
      .then((product) => setState({ key, status: 'ready', product }))
      .catch((err) => { if (err.name !== 'AbortError') setState({ key, status: err.status === 404 ? 'missing' : 'error', product: null }) })
    return () => ac.abort()
  }, [key, slug])

  const status = state.key === key ? state.status : 'loading'
  if (status === 'missing') return <NotFound />
  if (status === 'error') return <LoadError onRetry={() => setAttempt((n) => n + 1)} />
  if (status !== 'ready') return <PageSkeleton />
  return <ProductView key={state.product.slug} product={state.product} onAdd={onAdd} />
}

// ---------------------------------------------------------------- add-to-cart flight

// A copy of the photo flies to the navbar bag; `done` runs when it lands (that's when the count ticks up).
function flyToCart(done) {
  const bag = document.querySelector('[data-cart-btn]')
  const photo = document.querySelector('[data-pd=photo][data-active=true]')
  const bar = document.querySelector('[data-pd=bar-img]')
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0 }
  const src = photo && inView(photo) ? photo : bar && inView(bar) ? bar : null
  if (!bag || !src || calm()) return done()
  const a = src.getBoundingClientRect()
  const b = bag.getBoundingClientRect()
  const ghost = src.cloneNode()
  ghost.removeAttribute('data-pd')
  ghost.className = ''
  ghost.removeAttribute('id')
  Object.assign(ghost.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: '0', zIndex: '95', pointerEvents: 'none', objectFit: 'contain', opacity: '1' })
  ghost.setAttribute('aria-hidden', 'true')
  document.body.appendChild(ghost)
  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  gsap.timeline({ onComplete: () => { ghost.remove(); done() } })
    .to(ghost, { scale: 0.9, y: -14, duration: 0.18, ease: 'power2.out' })
    .to(ghost, { x: dx, y: dy, scale: 0.07, rotate: 24, opacity: 0.5, duration: 0.8, ease: 'power3.in' })
}

// ---------------------------------------------------------------- the product

function ProductView({ product, onAdd }) {
  const { name, slug, price, mrp, colors, sizes, category } = product
  const cat = SHOP_CATEGORIES.find((c) => c.id === category) ?? SHOP_CATEGORIES[0]
  const title = displayName(product)
  const off = discount(product)

  const onlyOne = sizes.filter((s) => s.stock > 0)
  // the colour can come in the address (?color=Brown), e.g. from the dots on a product card
  const [params, setParams] = useSearchParams()
  const [color, setColorState] = useState(() => colors.find((c) => c.name === params.get('color'))?.name ?? colors[0]?.name ?? '')
  const setColor = (name) => {
    setColorState(name)
    setParams((prev) => { const next = new URLSearchParams(prev); if (name === colors[0]?.name) next.delete('color'); else next.set('color', name); return next }, { replace: true })
  }
  const [size, setSize] = useState(onlyOne.length === 1 ? onlyOne[0].size : null) // one size left (or a free-size piece): no need to ask
  const [qty, setQty] = useState(1)
  const { has: isSaved, toggle: toggleSaved } = useWishlist()
  const liked = isSaved(product.slug)
  const [sizeError, setSizeError] = useState(false)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [barOn, setBarOn] = useState(false)

  const root = useRef(null)
  const sizeBox = useRef(null)
  const ctaRef = useRef(null)

  // each colour has its own hero picture; the shared pictures (back, details) follow it
  const current = colors.find((c) => c.name === color) ?? colors[0]
  const heroImg = current?.img || product.img
  const galleryProduct = useMemo(
    () => ({ ...product, images: [{ url: heroImg, alt: current?.alt || name }, ...product.images] }),
    [product, heroImg, current, name],
  )
  // load every colour's hero up front, so picking a colour swaps the picture at once
  useEffect(() => {
    colors.forEach((c) => { if (c.img) { const im = new Image(); im.src = sized(c.img, 700) } })
  }, [colors])

  const picked = sizes.find((s) => s.size === size)
  const maxQty = Math.min(MAX_QTY, picked ? picked.stock : MAX_QTY)
  const low = picked && picked.stock <= LOW_STOCK
  const total = price * qty
  const toFree = FREE_SHIPPING_MIN - total

  // tab title
  useEffect(() => {
    const prev = document.title
    document.title = `${name} — Isaa`
    return () => { document.title = prev }
  }, [name])

  // "Added" confirmation resets after a moment
  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(false), 2000)
    return () => clearTimeout(t)
  }, [added])

  // phones: the sticky bar appears once the real Add to Cart button scrolls away, and steps aside for the footer
  useEffect(() => {
    const seen = { cta: true, foot: false }
    const sync = () => setBarOn(!seen.cta && !seen.foot)
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { seen[e.target === ctaRef.current ? 'cta' : 'foot'] = e.isIntersecting })
      sync()
    })
    if (ctaRef.current) io.observe(ctaRef.current)
    const foot = document.querySelector('footer')
    if (foot) io.observe(foot)
    return () => io.disconnect()
  }, [])

  const pickSize = (s) => {
    setSize(s.size)
    setSizeError(false)
    setQty((q) => Math.min(q, Math.min(MAX_QTY, s.stock)))
  }

  const askForSize = () => {
    setSizeError(true)
    const el = sizeBox.current
    el?.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' })
    if (el && !calm()) gsap.fromTo(el, { x: 0 }, { keyframes: [{ x: -9 }, { x: 9 }, { x: -6 }, { x: 6 }, { x: 0 }], duration: 0.5, ease: 'power1.inOut', delay: 0.25 })
  }

  const add = () => {
    if (!product.inStock || adding) return
    if (sizes.length && !size) return askForSize()
    const item = { id: `${slug}|${size}|${color}`, slug, name, img: heroImg, price, mrp, size, color, qty }
    setAdding(true)
    flyToCart(() => { onAdd(item); setAdding(false); setAdded(true) })
  }

  // ---- arrival: crumbs, the title lifts out of its mask, the script is written, the details rise ----
  useGSAP(() => {
    if (calm()) return
    const q = (s) => root.current.querySelectorAll(s)
    const safe = gsap.delayedCall(6, () => gsap.set(q('[data-pd=rise], [data-pd=crumbs]'), { clearProps: 'opacity,visibility,transform' }))
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from(q('[data-pd=crumbs]'), { autoAlpha: 0, y: 10, duration: 0.6 }, 0)
      .from(q('[data-pd=line]'), { yPercent: 115, duration: 0.9, ease: 'power4.out' }, 0.15)
      .fromTo(q('[data-pd=script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -14 }, { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 0.4)
      .fromTo(q('[data-pd=underline]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.8, ease: 'power2.inOut' }, 0.65)
      .from(q('[data-pd=rise]'), { autoAlpha: 0, y: 20, duration: 0.7, stagger: 0.07, clearProps: 'transform,opacity,visibility' }, 0.45)
      .from(q('[data-pd=decor]'), { autoAlpha: 0, duration: 1.4, stagger: 0.15 }, 0)
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const st = { trigger: root.current, start: 'top top', end: 'bottom top', scrub: 0.6 }
      gsap.to(q('[data-pd=drift-a]'), { y: 90, ease: 'none', scrollTrigger: st })
      gsap.to(q('[data-pd=drift-b]'), { y: -60, ease: 'none', scrollTrigger: st })
    })
    return () => { safe.kill(); mm.revert() }
  }, { scope: root })

  const chip = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider sm:text-[12px]'
  const label = 'text-[13px] font-bold uppercase tracking-wide'

  return (
    <div ref={root}>
      <section aria-labelledby="pd-heading" className="relative isolate overflow-x-clip bg-cream pb-14 pt-7 sm:pt-10 lg:pb-[5vw] lg:pt-[2.4vw]">
        {/* backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div data-pd="drift-a" className="absolute -left-[4%] top-[2%] w-[34%] sm:w-[20%] lg:w-[13%]"><img data-pd="decor" src={brushL} alt="" loading="lazy" decoding="async" className="w-full opacity-70" /></div>
          <div data-pd="drift-b" className="absolute -right-[3%] bottom-[4%] h-[34%] sm:h-[44%]"><img data-pd="decor" src={brushR} alt="" loading="lazy" decoding="async" className="h-full w-auto opacity-60" /></div>
          <img data-pd="decor" src={buildingL} alt="" loading="lazy" decoding="async" className="absolute -left-[3%] bottom-0 hidden h-[64%] w-auto opacity-[.12] xl:block" />
          <img data-pd="decor" src="/squiggle.svg" alt="" className="absolute bottom-[9%] right-[44%] hidden w-[7vw] min-w-16 opacity-50 lg:block" />
        </div>

        <div className="mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
          <nav data-pd="crumbs" aria-label="Breadcrumb" className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink/55">
            <ol className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <li><Link to="/" className="transition-colors hover:text-ink">Home</Link></li>
              <li aria-hidden className="text-olive">/</li>
              <li><Link to="/shop" className="transition-colors hover:text-ink">Shop</Link></li>
              {cat.id && (<><li aria-hidden className="text-olive">/</li><li><Link to={cat.to} className="transition-colors hover:text-ink">{cat.label}</Link></li></>)}
              <li aria-hidden className="text-olive">/</li>
              <li><span aria-current="page" className="text-ink">{title}</span></li>
            </ol>
          </nav>

          <div className="mt-6 grid items-start gap-9 lg:mt-[1.8vw] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,.92fr)] lg:gap-[4.5vw]">
            {/* ------------------------------------------------ gallery */}
            <div className="min-w-0 lg:sticky lg:top-[134px]">
              <Gallery product={galleryProduct} resetKey={color} />
            </div>

            {/* ------------------------------------------------ details */}
            <div className="min-w-0 lg:pt-2">
              <div data-pd="rise" className="flex flex-wrap items-center gap-2">
                {product.isBest && <span className={`${chip} bg-ink text-white`}><Flame size={12} className="fill-amber-300 text-amber-300" aria-hidden />Best seller</span>}
                {product.isNew && <span className={`${chip} bg-ink text-white`}><Sparkle size={11} className="fill-amber-300 text-amber-300" aria-hidden />New</span>}
                {product.limited && <span className={`${chip} bg-olive text-white`}>Limited run</span>}
                {!product.inStock && <span className={`${chip} bg-ink/10 text-ink`}>Sold out</span>}
              </div>

              <h1 id="pd-heading" className="mt-4 lg:mt-[1vw]">
                <span className="-mx-[0.12em] -my-[0.05em] block overflow-hidden px-[0.12em] py-[0.05em]">
                  <span data-pd="line" className="cat-grunge block text-balance font-black italic uppercase leading-[0.92] tracking-[-0.025em] text-[12vw] sm:text-[8.6vw] lg:text-[4.5vw]" style={{ '--tex': `url(${decor.texture})`, fontVariationSettings: '"wdth" 84' }}>{title}</span>
                </span>
              </h1>
              <div className="mt-[1.4vw] inline-block -rotate-2 sm:mt-2 lg:mt-[0.3vw]">
                <p data-pd="script" className="whitespace-nowrap font-script text-[8.6vw] leading-[1.1] text-olive sm:text-[5.6vw] lg:text-[2.7vw]">{taglineFor(product)}</p>
                <div aria-hidden className="mt-[0.8vw] flex lg:mt-[0.2vw]"><img data-pd="underline" src={underline} alt="" loading="lazy" decoding="async" className="h-[2.4vw] w-[92%] object-fill sm:h-[1.6vw] lg:h-[0.9vw]" /></div>
              </div>

              <div data-pd="rise" className="mt-6 lg:mt-[1.8vw]">
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <b className="text-[clamp(32px,2.8vw,52px)] font-black leading-none tabular-nums">{inr(price)}</b>
                  <s className="text-[clamp(15px,1.1vw,20px)] tabular-nums text-ink/45">{inr(mrp)}</s>
                  {off > 0 && <span className="rounded-full bg-olive px-3 py-1 text-xs font-bold text-white">{off}% OFF</span>}
                </p>
                {mrp > price && <p className="mt-1.5 text-[13px] text-ink/55">You save {inr(mrp - price)} on this piece.</p>}
              </div>

              {product.description && <p data-pd="rise" className="mt-5 max-w-[34em] text-[clamp(15px,1.05vw,18px)] leading-relaxed text-ink/70">{product.description}</p>}

              {/* colour */}
              {colors.length > 0 && (
                <div data-pd="rise" role="radiogroup" aria-label="Colour" className="mt-7 lg:mt-[2vw]">
                  <p className={label}>Colour <span className="ml-2 font-medium normal-case tracking-normal text-ink/60">{color}</span></p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {colors.map((c) => {
                      const on = c.name === color
                      return (
                        <button key={c.name} type="button" role="radio" aria-checked={on} aria-label={c.name} title={c.name} onClick={() => setColor(c.name)}
                          className={`grid h-11 w-11 place-items-center rounded-full border-2 bg-cream transition-[border-color,transform] duration-300 active:scale-90 ${on ? 'border-ink' : 'border-transparent hover:border-ink/40'}`}>
                          <span className="h-7 w-7 rounded-full border border-ink/15 transition-transform duration-300" style={{ backgroundColor: c.hex, transform: on ? 'scale(1)' : 'scale(.92)' }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* size */}
              {sizes.length > 0 && (
                <div data-pd="rise" className="mt-6 lg:mt-[1.6vw]">
                  <div ref={sizeBox}>
                    <div className="flex items-baseline justify-between gap-4">
                      <p id="pd-size-label" className={label}>Size <span className="ml-2 font-medium normal-case tracking-normal text-ink/60">{size ? sizeName(size) : ''}</span></p>
                      {sizeError && <p role="alert" className="text-[13px] font-bold text-red-700">Pick a size to continue</p>}
                    </div>
                    <div role="radiogroup" aria-labelledby="pd-size-label" className="mt-3 flex flex-wrap gap-2.5">
                      {sizes.map((s) => {
                        const out = s.stock <= 0
                        const on = s.size === size
                        return (
                          <button key={s.size} type="button" role="radio" aria-checked={on} disabled={out} aria-label={out ? `${sizeName(s.size)}, sold out` : sizeName(s.size)} onClick={() => pickSize(s)}
                            className={`relative grid h-12 min-w-14 place-items-center overflow-hidden rounded-full border px-4 text-[14px] font-bold transition-[background-color,border-color,color,transform] duration-300 active:scale-95 ${out ? 'cursor-not-allowed border-sand bg-sand/30 text-ink/30' : on ? 'border-ink bg-ink text-white' : sizeError ? 'border-red-700/60 hover:border-ink' : 'border-ink/30 hover:border-ink'}`}>
                            {sizeName(s.size)}
                            {out && <span aria-hidden className="absolute inset-x-1.5 top-1/2 h-px -rotate-[24deg] bg-ink/35" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <p aria-live="polite" className="mt-2.5 min-h-5 text-[13px] font-semibold text-olive">{low ? `Only ${picked.stock} left in ${sizeName(size)}` : ''}</p>
                </div>
              )}

              {/* quantity + add */}
              <div data-pd="rise" className="mt-2 lg:mt-[0.4vw]">
                <p className={label}>Quantity</p>
                <div role="group" aria-label="Quantity" className="mt-3 inline-flex h-12 items-center rounded-full border border-ink/80">
                  <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-full w-12 place-items-center rounded-full transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30"><Minus size={16} /></button>
                  <output aria-live="polite" className="w-9 text-center text-[15px] font-bold tabular-nums">{qty}</output>
                  <button type="button" aria-label="Increase quantity" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))} className="grid h-full w-12 place-items-center rounded-full transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30"><Plus size={16} /></button>
                </div>

                <div ref={ctaRef} className="mt-5 flex items-stretch gap-3">
                  <button type="button" onClick={add} disabled={!product.inStock || adding}
                    className={`group inline-flex h-14 flex-1 items-center justify-center gap-3 rounded-full px-6 text-[13px] font-bold uppercase tracking-wide text-white transition-colors duration-300 active:scale-[.98] disabled:cursor-not-allowed lg:h-[clamp(56px,3.6vw,68px)] lg:text-[clamp(13px,.85vw,16px)] ${added ? 'bg-olive' : product.inStock ? 'bg-ink hover:bg-olive' : 'bg-ink/30'}`}>
                    {!product.inStock ? 'Sold out' : added ? <><Check size={18} strokeWidth={2.6} aria-hidden /> Added to cart</> : <><ShoppingBag size={18} aria-hidden /> Add to cart <span aria-hidden className="h-4 w-px bg-white/35" /> <span className="tabular-nums">{inr(total)}</span></>}
                  </button>
                  <button type="button" onClick={() => toggleSaved(product.slug, title)} aria-pressed={liked} aria-label={liked ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-ink/80 transition-[background-color,color,transform] hover:bg-ink hover:text-white active:scale-90 lg:h-[clamp(56px,3.6vw,68px)] lg:w-[clamp(56px,3.6vw,68px)]">
                    <Heart size={20} className={`transition-colors duration-300 ${liked ? 'fill-olive text-olive' : ''}`} />
                  </button>
                </div>
              </div>

              {/* delivery */}
              <ul data-pd="rise" className="mt-7 divide-y divide-sand overflow-hidden rounded-[22px] border border-sand bg-white/50 lg:mt-[2vw]">
                <li className="flex items-start gap-4 p-4 sm:p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-olive text-white"><Truck size={18} aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold">Free shipping above {inr(FREE_SHIPPING_MIN)}</p>
                    <p aria-live="polite" className="mt-0.5 text-[13px] text-ink/60">{toFree > 0 ? <>Add <b className="text-ink">{inr(toFree)}</b> more to ship this order free.</> : 'This order ships free.'}</p>
                    <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-olive transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, (total / FREE_SHIPPING_MIN) * 100)}%` }} /></div>
                  </div>
                </li>
                <li className="flex items-start gap-4 p-4 sm:p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-olive text-white"><Banknote size={18} aria-hidden /></span>
                  <div><p className="text-[15px] font-bold">Cash on delivery available</p><p className="mt-0.5 text-[13px] text-ink/60">Pay when it arrives.</p></div>
                </li>
                <li className="flex items-start gap-4 p-4 sm:p-5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-olive text-white"><RotateCcw size={18} aria-hidden /></span>
                  <div><p className="text-[15px] font-bold">Easy returns within 7 days</p><p className="mt-0.5 text-[13px] text-ink/60">Changed your mind? Send it back.</p></div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Related product={product} />

      {/* phones: sticky Add to Cart once the main button has scrolled away */}
      <div inert={!barOn} aria-hidden={!barOn}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-cream/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-500 ease-[cubic-bezier(.7,0,.2,1)] motion-reduce:transition-none lg:hidden ${barOn ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <img data-pd="bar-img" src={sized(heroImg, 160)} alt="" width="1200" height="1300" className="h-12 w-11 shrink-0 rounded-lg bg-sand/60 object-contain" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-black italic uppercase leading-tight tracking-tight [font-stretch:112%]">{title}</p>
            <p className="mt-0.5 truncate text-[13px] tabular-nums"><b>{inr(price)}</b> <s className="text-ink/45">{inr(mrp)}</s>{size && <span className="text-ink/60"> · {sizeName(size)}</span>}</p>
          </div>
          <button type="button" onClick={add} disabled={!product.inStock || adding}
            className={`inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[12px] font-bold uppercase tracking-wide text-white transition-colors duration-300 active:scale-95 disabled:cursor-not-allowed ${added ? 'bg-olive' : product.inStock ? 'bg-ink' : 'bg-ink/30'}`}>
            {!product.inStock ? 'Sold out' : added ? <><Check size={16} strokeWidth={2.6} aria-hidden /> Added</> : size || !sizes.length ? <><ShoppingBag size={16} aria-hidden /> Add</> : 'Pick size'}
          </button>
        </div>
      </div>

      <p className="sr-only" role="status">{added ? `${name} added to cart` : ''}</p>
    </div>
  )
}

// ---------------------------------------------------------------- you may also like

function Related({ product }) {
  const [state, setState] = useState({ status: 'loading', items: [] })
  const root = useRef(null)

  useEffect(() => {
    const ac = new AbortController()
    fetchRelated(product, ac.signal)
      .then((items) => setState({ status: 'ready', items }))
      .catch((err) => { if (err.name !== 'AbortError') setState({ status: 'error', items: [] }) })
    return () => ac.abort()
  }, [product])

  useGSAP(() => {
    if (state.status !== 'ready' || calm()) return
    const q = (s) => root.current.querySelectorAll(s)
    gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: root.current, start: 'top 80%', once: true } })
      .from(q('[data-rel=line]'), { yPercent: 115, duration: 0.9, ease: 'power4.out' }, 0)
      .fromTo(q('[data-rel=underline]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.8, ease: 'power2.inOut' }, 0.35)
    const cards = [...q('[data-sb=card]')]
    gsap.set(cards, { autoAlpha: 0, y: 56, rotate: (i) => (i % 2 ? 2 : -2) })
    ScrollTrigger.batch(cards, {
      start: 'top 94%',
      once: true,
      onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.8, ease: 'power3.out', stagger: 0.09, overwrite: true, clearProps: 'transform,opacity,visibility' }),
    })
  }, { scope: root, dependencies: [state.status] })

  if (state.status === 'error' || (state.status === 'ready' && state.items.length === 0)) return null

  return (
    <section ref={root} aria-labelledby="rel-heading" className="relative border-t border-sand bg-cream pb-[22vw] pt-12 sm:pb-[12vw] sm:pt-16 lg:pb-[6vw] lg:pt-[4.4vw]">
      <div className="mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h2 id="rel-heading" className="font-black italic uppercase leading-[0.92] tracking-[-0.02em] text-[9vw] sm:text-[6.4vw] lg:text-[3.6vw]" style={{ fontVariationSettings: '"wdth" 84' }}>
              <span className="-mx-[0.12em] -my-[0.05em] block overflow-hidden px-[0.12em] py-[0.05em]"><span data-rel="line" className="block">You may also like</span></span>
            </h2>
            <div aria-hidden className="mt-[1vw] flex lg:mt-[0.4vw]"><img data-rel="underline" src={underline} alt="" loading="lazy" decoding="async" className="h-[2.6vw] w-[min(70%,360px)] object-fill sm:h-[1.6vw] lg:h-[0.9vw]" /></div>
          </div>
          <Link to={product.category ? `/shop/${product.category}` : '/shop'} className="group inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-wide underline decoration-ink/30 decoration-2 underline-offset-8 transition-colors hover:decoration-olive">
            Shop more <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </Link>
        </div>

        {/* phones: swipe sideways; desktop: four across */}
        <ul className="-mx-5 mt-7 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:none] sm:mt-9 lg:mx-0 lg:mt-[2.2vw] lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden [&>li]:w-[62%] [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-[38%] lg:[&>li]:w-auto">
          {state.status === 'ready'
            ? state.items.map((p) => <ProductCard key={p.id} p={p} kind="shop" />)
            : Array.from({ length: 4 }, (_, i) => (
                <li key={i} aria-hidden className="flex"><div className="w-full animate-pulse rounded-[22px] border border-sand bg-cream p-2 sm:rounded-[28px] sm:p-2.5"><div className="aspect-[4/4.5] rounded-[16px] bg-sand/60 sm:rounded-[20px]" /><div className="mt-3 h-4 w-2/3 rounded bg-sand/70" /><div className="mt-2 h-3 w-1/3 rounded bg-sand/50" /></div></li>
              ))}
        </ul>
      </div>
    </section>
  )
}
