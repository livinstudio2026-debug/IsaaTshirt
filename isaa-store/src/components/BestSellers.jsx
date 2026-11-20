import { Link } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight } from 'lucide-react'
import ProductCard from './ProductCard'
import { fetchShelves } from '../lib/api'

import underline from '../assets/featuredDrop/underline-stroke.webp'
import brushL from '../assets/hero/tshirts/brush-left.webp'
import brushR from '../assets/featuredDrop/brush-right.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const TABS = [
  { id: 'best', label: 'Best Sellers', script: 'Crowd favourites', blurb: 'The tees everyone keeps coming back for.', cta: 'Shop all best sellers' },
  { id: 'fresh', label: 'New Arrivals', script: 'Fresh off the press', blurb: 'Just landed. Small runs, big prints.', cta: 'Shop all new arrivals' },
]
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function Skeleton({ bento }) {
  return Array.from({ length: bento ? 5 : 4 }, (_, i) => (
    <li key={i} aria-hidden className={`flex ${bento && i === 0 ? 'col-span-2 lg:row-span-2' : ''}`}>
      <div className="w-full animate-pulse rounded-[22px] sm:rounded-[28px] border border-sand bg-cream p-2 sm:p-2.5">
        <div className={`rounded-[16px] sm:rounded-[20px] bg-sand/60 ${bento && i === 0 ? 'aspect-[5/4] sm:aspect-[16/10] lg:aspect-auto lg:h-[calc(100%-5.5rem)] lg:min-h-[360px]' : 'aspect-[4/4.5]'}`} />
        <div className="mt-3 h-4 w-2/3 rounded bg-sand/70" />
        <div className="mt-2 h-3 w-1/3 rounded bg-sand/50" />
      </div>
    </li>
  ))
}

export default function BestSellers() {
  const [tab, setTab] = useState('best')
  const [state, setState] = useState({ status: 'loading', best: [], fresh: [] })
  const [attempt, setAttempt] = useState(0)
  const [liked, setLiked] = useState(() => new Set())
  const root = useRef(null)
  const grid = useRef(null)

  useEffect(() => {
    const ac = new AbortController()
    fetchShelves(ac.signal)
      .then(({ best, fresh }) => setState({ status: 'ready', best, fresh }))
      .catch((err) => { if (err.name !== 'AbortError') setState({ status: 'error', best: [], fresh: [] }) })
    return () => ac.abort()
  }, [attempt])
  const retry = () => { setState({ status: 'loading', best: [], fresh: [] }); setAttempt((n) => n + 1) }

  const toggleLike = (id) => setLiked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const cfg = TABS.find((t) => t.id === tab)
  const items = state[tab]
  const bento = items.length === 5 || state.status !== 'ready'
  const ready = state.status === 'ready'

  // ---- header + backdrop: once, when scrolled into view ----
  useGSAP(() => {
    if (calm()) return
    const q = (s) => root.current.querySelectorAll(s)
    gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: root.current, start: 'top 75%', once: true } })
      .from(q('[data-sb=eyebrow]'), { autoAlpha: 0, y: 14, duration: 0.7 }, 0)
      .from(q('[data-sb=side]'), { autoAlpha: 0, y: 22, duration: 0.8, clearProps: 'transform,opacity,visibility' }, 0.5)
      .from(q('[data-sb=decor]'), { autoAlpha: 0, duration: 1.6, stagger: 0.15 }, 0)
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const st = { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      gsap.fromTo(q('[data-sb=drift-a]'), { y: 60 }, { y: -60, ease: 'none', scrollTrigger: st })
      gsap.fromTo(q('[data-sb=drift-b]'), { y: -40 }, { y: 80, ease: 'none', scrollTrigger: st })
    })
    return () => mm.revert()
  }, { scope: root })

  // ---- title + cards: on first view, and again every time the tab changes ----
  useGSAP(() => {
    if (!ready || calm()) return
    const q = (s) => root.current.querySelectorAll(s)
    gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: grid.current, start: 'top 90%', once: true } })
      .from(q('[data-sb=line]'), { yPercent: 115, duration: 0.9, ease: 'power4.out' }, 0)
      .fromTo(q('[data-sb=script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -14 }, { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 0.25)
      .fromTo(q('[data-sb=underline]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.8, ease: 'power2.inOut' }, 0.55)
      .from(q('[data-sb=card]'), { autoAlpha: 0, y: 60, rotate: (i) => (i % 2 ? 2.5 : -2.5), duration: 0.85, stagger: 0.1, clearProps: 'transform,opacity,visibility' }, 0.2)
  }, { scope: root, dependencies: [tab, ready], revertOnUpdate: true })

  const onTabKey = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = TABS[(TABS.findIndex((t) => t.id === tab) + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length]
    setTab(next.id)
    document.getElementById(`sb-tab-${next.id}`)?.focus()
  }

  return (
    <section ref={root} id="best-sellers" aria-labelledby="sb-heading" className="relative isolate overflow-hidden bg-sand/40 py-[14vw] sm:py-[9vw] lg:py-[5.4vw]">
      {/* backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div data-sb="drift-a" className="absolute -left-[4%] top-[2%] w-[36%] sm:w-[24%] lg:w-[17%]"><img data-sb="decor" src={brushL} alt="" loading="lazy" decoding="async" className="w-full opacity-70" /></div>
        <div data-sb="drift-b" className="absolute -right-[3%] bottom-[3%] h-[34%] sm:h-[40%]"><img data-sb="decor" src={brushR} alt="" loading="lazy" decoding="async" className="h-full w-auto opacity-60" /></div>
        <img data-sb="decor" src="/squiggle.svg" alt="" className="absolute left-0 bottom-[9%] hidden w-[8vw] min-w-20 opacity-80 lg:block" />
      </div>

      <div className="relative mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
        {/* heading + tabs */}
        <header className="flex flex-col items-center text-center lg:flex-row lg:items-end lg:justify-between lg:text-left gap-7 lg:gap-10">
          <div>
            <p data-sb="eyebrow" className="inline-flex items-center gap-[1.2vw] text-[clamp(11px,.9vw,17px)] font-bold uppercase tracking-[0.22em]">
              <span className="hidden sm:block h-px w-[8vw] lg:w-[4vw] bg-ink/30" />
              <span>Shop the Rack <span className="mx-1 text-olive">/</span> <span className="text-olive">Drop 02</span></span>
              <span className="hidden sm:block h-px w-[8vw] lg:hidden bg-ink/30" />
            </p>
            <h2 id="sb-heading" key={tab} className="mt-[1.2vw] font-black italic uppercase leading-[0.9] tracking-tight text-[12.5vw] sm:text-[9.6vw] lg:text-[6.4vw]" style={{ fontVariationSettings: '"wdth" 84' }}>
              <span className="block overflow-hidden py-[0.05em] -my-[0.05em] px-[0.12em] -mx-[0.12em]"><span data-sb="line" className="block">{cfg.label}</span></span>
            </h2>
            <div className="inline-block mt-[0.4vw] lg:mt-0 -rotate-2" key={`${tab}-s`}>
              <p data-sb="script" className="font-script text-olive text-[9vw] sm:text-[6.4vw] lg:text-[3.6vw] leading-[1.1] whitespace-nowrap">{cfg.script}</p>
              <div aria-hidden className="mt-[0.8vw] lg:mt-[0.3vw] flex justify-center lg:justify-start">
                <img data-sb="underline" src={underline} alt="" loading="lazy" decoding="async" className="w-[92%] h-[2.4vw] lg:h-[1.1vw] object-fill" />
              </div>
            </div>
          </div>

          <div data-sb="side" className="flex w-full max-w-[460px] flex-col items-center lg:items-end gap-4 lg:pb-[0.6vw]">
            <div role="tablist" aria-label="Choose a shelf" onKeyDown={onTabKey}
              className="relative grid w-full grid-cols-2 rounded-full border border-ink/80 bg-cream p-1 text-[clamp(11px,3vw,13px)] lg:text-[clamp(12px,.82vw,15px)] font-bold uppercase tracking-wide">
              <span aria-hidden className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-ink transition-transform duration-500 ease-[cubic-bezier(.7,0,.2,1)]" style={{ transform: tab === 'best' ? 'translateX(0)' : 'translateX(100%)' }} />
              {TABS.map((t) => (
                <button key={t.id} id={`sb-tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls="sb-panel" tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => setTab(t.id)}
                  className={`relative z-10 whitespace-nowrap rounded-full px-3 py-3 sm:px-5 transition-colors duration-300 ${tab === t.id ? 'text-white' : 'text-ink/70 hover:text-ink'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[clamp(14px,1vw,18px)] text-ink/60 lg:text-right">{cfg.blurb}</p>
          </div>
        </header>

        {/* products */}
        <div id="sb-panel" role="tabpanel" aria-labelledby={`sb-tab-${tab}`} ref={grid} className="mt-8 lg:mt-[2.4vw]" aria-busy={state.status === 'loading'}>
          {state.status === 'error' ? (
            <div className="grid place-items-center rounded-[28px] border border-sand bg-cream px-5 py-16 text-center">
              <div>
                <p className="text-lg font-bold">We couldn’t load this shelf.</p>
                <p className="mt-1 text-ink/60">Check your connection and try again.</p>
                <button type="button" onClick={retry} className="mt-5 rounded-full bg-ink px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Retry</button>
              </div>
            </div>
          ) : ready && items.length === 0 ? (
            <p className="rounded-[28px] border border-sand bg-cream px-5 py-16 text-center text-ink/60">No tees on this shelf yet. Check back soon.</p>
          ) : (
            <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:gap-4 lg:grid-cols-4 lg:gap-5">
              {ready
                ? items.map((p, i) => (
                    <ProductCard key={p.id} p={p} rank={i + 1} kind={tab} big={bento && i === 0} liked={liked.has(p.id)} onLike={toggleLike} />
                  ))
                : <Skeleton bento />}
            </ul>
          )}
        </div>

        {ready && items.length > 0 && (
          <div className="mt-9 flex justify-center lg:mt-[2.6vw]">
            <Link to={`/shop?collection=${tab === 'best' ? 'bestsellers' : 'new'}`} className="group inline-flex items-center gap-3 rounded-full border border-ink px-[clamp(28px,2.1vw,40px)] py-[clamp(14px,1vw,20px)] text-[clamp(13px,.85vw,16px)] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white">
              {cfg.cta} <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
