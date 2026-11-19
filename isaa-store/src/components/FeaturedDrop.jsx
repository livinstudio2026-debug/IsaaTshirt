import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Check, ChevronLeft, ChevronRight, ShoppingBag, Sparkle } from 'lucide-react'
import { featured, marquee } from '../data/featured'

import hanger from '../assets/featuredDrop/hanger.webp'
import tag from '../assets/featuredDrop/limited-tag.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'
import brushL from '../assets/featuredDrop/brush-left.webp'
import brushR from '../assets/featuredDrop/brush-right.webp'
import buildingL from '../assets/featuredDrop/building-left.webp'
import buildingR from '../assets/featuredDrop/building-right.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const N = featured.length
// Poses by offset from the centred tee (-4..3 for 8 tees). xPercent is in tee-widths and includes the -50 centring.
// Desktop: 5 visible (centre + 2 per side at 70%). Mobile: 3 visible. Everything else waits off-screen, invisible.
const START = 3 // the tee shown in the centre on load (0-based); 8 tees, so 3 sit to its left and 4 to its right
// Pose for a tee `o` places from the centred one. xPercent is in tee-widths and includes the -50 centring.
// Desktop: 5 visible (centre + 2 per side at 70%). Mobile: 3 visible. Everything else waits off-screen, invisible.
const poseFor = (o, mobile) => {
  const a = Math.abs(o), sign = Math.sign(o)
  const vis = a <= (mobile ? 1 : 2)
  const x = mobile ? (a === 0 ? 0 : 72 + (a - 1) * 68) : [0, 83, 152][a] ?? 152 + (a - 2) * 75
  const scale = a === 0 ? 1 : vis ? (mobile ? 0.72 : 0.7) : 0.6
  return { xPercent: -50 + sign * x, scale, autoAlpha: vis ? 1 : 0, zIndex: vis ? 5 - a : 1 }
}

const isMobile = () => window.matchMedia('(max-width: 1023px)').matches
const pose = (o) => poseFor(o, isMobile())
const offsetOf = (i, active) => i - active
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pad = (n) => String(n).padStart(2, '0')
const inr = (n) => '₹' + n.toLocaleString('en-IN')
const off = (p) => Math.round(((p.mrp - p.price) / p.mrp) * 100)

function Marquee() {
  const group = (hidden) => (
    <ul aria-hidden={hidden || undefined} className={`flex shrink-0 items-center gap-8 sm:gap-12 pr-8 sm:pr-12 ${hidden ? 'motion-reduce:hidden' : 'motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:w-screen motion-reduce:pr-0'}`}>
      {marquee.map((m) => (
        <li key={m} className="flex items-center gap-8 sm:gap-12 whitespace-nowrap">
          <span>{m}</span><Sparkle size={13} className="text-olive fill-olive shrink-0" />
        </li>
      ))}
    </ul>
  )
  return (
    <div className="bg-ink text-white overflow-hidden text-[12px] sm:text-[13px] font-semibold uppercase tracking-[0.12em] h-11 flex items-center">
      <div className="flex w-max animate-[marquee_42s_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none">
        {group(false)}{group(true)}{group(true)}{group(true)}
      </div>
    </div>
  )
}

export default function FeaturedDrop({ onAdd = () => {} }) {
  const [active, setActive] = useState(START)
  const [added, setAdded] = useState(null)
  const root = useRef(null)
  const stage = useRef(null)
  const detailsEl = useRef(null)
  const shown = useRef(START)
  const items = useRef([])
  const swings = useRef([])
  const sways = useRef([])
  const wobbles = useRef([])
  const prev = useRef(START)
  const lock = useRef(false)
  const pointer = useRef({ x: null, moved: false })

  const go = (to) => {
    if (to < 0 || to > N - 1 || lock.current) return // finite rail: it ends on both sides
    lock.current = true
    setTimeout(() => (lock.current = false), 700)
    setActive(to)
  }

  // ---- setup, entrance (once, when scrolled into view), idle sway, scroll depth ----
  useGSAP(() => {
    const q = (s) => root.current.querySelector(s)
    const qa = (s) => root.current.querySelectorAll(s)
    const origin = () => gsap.set([...items.current, ...swings.current, ...sways.current, ...wobbles.current], { transformOrigin: '50% 0%' })
    const place = () => items.current.forEach((el, i) => gsap.set(el, pose(offsetOf(i, prev.current))))
    origin(); place()

    // keep poses and pivots right across breakpoints / resizes
    const mq = window.matchMedia('(max-width: 1023px)')
    const ro = new ResizeObserver(origin)
    ro.observe(stage.current)
    mq.addEventListener('change', place)

    if (calm()) return () => { ro.disconnect(); mq.removeEventListener('change', place) }

    // idle: every hanger sways a little, each out of phase; paused while off-screen
    const idle = sways.current.map((el, i) => {
      const t = gsap.fromTo(el, { rotation: -1.1 }, { rotation: 1.1, duration: 2.8 + (i % 4) * 0.45, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true })
      return t.progress((i * 0.137) % 1)
    })

    // entrance
    lock.current = true
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' }, onComplete: () => { lock.current = false } })
    tl.from(qa('[data-fd=decor]'), { opacity: 0, duration: 1.6, stagger: 0.12 }, 0)
      .from(q('[data-fd=eyebrow]'), { opacity: 0, y: 14, duration: 0.7 }, 0.1)
      .from(qa('[data-fd=line]'), { yPercent: 115, duration: 1, ease: 'power4.out', stagger: 0.12 }, 0.2)
      .fromTo(q('[data-fd=script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -16 }, { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 1, ease: 'power2.inOut' }, 0.7)
      .fromTo(q('[data-fd=underline]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 1.0)
      .from(q('[data-fd=rail]'), { scaleX: 0, duration: 1, ease: 'power3.inOut' }, 0.9)
    items.current.forEach((el, i) => {
      const o = Math.abs(offsetOf(i, prev.current))
      if (pose(offsetOf(i, prev.current)).autoAlpha !== 1) return
      tl.from(el, { y: -50, autoAlpha: 0, duration: 0.9 }, 1.3 + o * 0.14)
        .fromTo(swings.current[i], { rotation: i % 2 ? 7 : -7 }, { rotation: 0, duration: 2, ease: 'elastic.out(1,0.32)' }, 1.4 + o * 0.14)
    })
    tl.from(q('[data-fd=controls]'), { opacity: 0, y: 18, duration: 0.8, clearProps: 'opacity,transform' }, 2.0)

    let started = false
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { idle.forEach((t) => t.play()); if (!started) { started = true; tl.play() } } else idle.forEach((t) => t.pause())
    }, { threshold: 0.2 })
    io.observe(root.current)

    // safety net: if the entrance is interrupted, the copy and controls never stay hidden
    const safe = gsap.delayedCall(12, () => { if (started) gsap.set(qa('[data-fd=eyebrow], [data-fd=controls]'), { clearProps: 'opacity,transform' }) })

    // scroll depth (desktop): the buildings and brushes drift against the page
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const st = { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      gsap.fromTo(qa('[data-fd=drift-slow]'), { y: 50 }, { y: -50, ease: 'none', scrollTrigger: st })
      gsap.fromTo(qa('[data-fd=drift-fast]'), { y: -70 }, { y: 70, ease: 'none', scrollTrigger: st })
    })

    return () => { io.disconnect(); ro.disconnect(); mq.removeEventListener('change', place); safe.kill(); idle.forEach((t) => t.kill()); mm.revert() }
  }, { scope: root })

  // ---- move the rail when the active tee changes ----
  useEffect(() => {
    const from = prev.current
    if (from === active) return
    prev.current = active
    const step = active - from
    items.current.forEach((el, i) => {
      const o0 = offsetOf(i, from), o1 = offsetOf(i, active), to = pose(o1)
      if (calm()) { gsap.set(el, to); return }
      gsap.to(el, { ...to, duration: 0.9, ease: 'power3.inOut', overwrite: true })
      if (to.autoAlpha === 1 || pose(o0).autoAlpha === 1) {
        // hangers lag behind the move, then swing back and settle
        gsap.fromTo(swings.current[i], { rotation: (step > 0 ? -1 : 1) * Math.min(Math.abs(step), 2) * 4.5 }, { rotation: 0, duration: 1.9, ease: 'elastic.out(1,0.32)', overwrite: true })
      }
    })
  }, [active])

  // ---- the centre tee's details (name, price, buttons) rise in whenever the active tee changes ----
  useEffect(() => {
    if (shown.current === active) return
    shown.current = active
    if (calm()) return
    gsap.fromTo(detailsEl.current.querySelectorAll('[data-detail]'), { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.07, delay: 0.12, ease: 'power3.out', clearProps: 'opacity,transform', overwrite: true })
  }, [active])

  // "Added" confirmation on the cart button resets after a moment
  useEffect(() => {
    if (!added) return
    const t = setTimeout(() => setAdded(null), 1600)
    return () => clearTimeout(t)
  }, [added])
  const addToCart = (p) => { onAdd(p); setAdded(p.id) }

  // ---- input: horizontal scroll / shift+wheel, swipe, keyboard (only while the rail has focus) ----
  useEffect(() => {
    const el = stage.current
    const onWheel = (e) => {
      const d = e.shiftKey ? e.deltaY : e.deltaX
      if (Math.abs(d) < 25 || (Math.abs(e.deltaX) < Math.abs(e.deltaY) && !e.shiftKey)) return
      e.preventDefault()
      go(active + (d > 0 ? 1 : -1))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // hover: a mild, smooth wobble about the hook
  const wobble = (i) => {
    if (calm() || gsap.isTweening(wobbles.current[i]) || Math.abs(offsetOf(i, active)) > (isMobile() ? 1 : 2)) return
    gsap.to(wobbles.current[i], { keyframes: [{ rotation: 2.4 }, { rotation: -2 }, { rotation: 1.2 }, { rotation: -0.6 }, { rotation: 0 }], duration: 1.3, ease: 'sine.inOut' })
  }

  const onKeyDown = (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault(); e.stopPropagation() // don't also drive the hero carousel
    go(active + (e.key === 'ArrowRight' ? 1 : -1))
  }

  const cur = featured[active]

  const arrow = 'hidden lg:grid absolute z-20 top-[calc(var(--rail)+var(--w)*0.5)] -mt-6 w-[3.2vw] h-[3.2vw] min-w-11 min-h-11 rounded-full bg-cream border border-ink/80 place-items-center transition-colors hover:bg-ink hover:text-white disabled:opacity-30 disabled:pointer-events-none'

  return (
    <section ref={root} aria-label="Featured drop" className="relative overflow-hidden bg-cream">
      <Marquee />

      {/* backdrop */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div data-fd="drift-fast" className="absolute left-0 top-[6%] h-[40%] md:h-[44%]"><img data-fd="decor" src={brushL} alt="" loading="lazy" decoding="async" className="h-full w-auto opacity-60" /></div>
        <div data-fd="drift-fast" className="absolute right-0 bottom-[10%] h-[40%] md:h-[46%]"><img data-fd="decor" src={brushR} alt="" loading="lazy" decoding="async" className="h-full w-auto opacity-60" /></div>
        <div data-fd="drift-slow" className="absolute left-0 top-[7%] h-[38%] md:h-[72%]"><img data-fd="decor" src={buildingL} alt="" loading="lazy" decoding="async" className="h-full w-auto max-w-none opacity-40 md:opacity-60" /></div>
        <div data-fd="drift-slow" className="absolute right-0 top-[7%] h-[38%] md:h-[72%]"><img data-fd="decor" src={buildingR} alt="" loading="lazy" decoding="async" className="h-full w-auto max-w-none opacity-40 md:opacity-60" /></div>
        <img data-fd="decor" src="/squiggle.svg" alt="" className="absolute left-0 bottom-[17%] w-[8vw] min-w-20 hidden lg:block opacity-90" />
      </div>

      {/* heading */}
      <header className="relative z-10 text-center px-5 pt-[9vw] sm:pt-[6vw] lg:pt-[2.6vw] pb-[3vw] lg:pb-[1.2vw]">
        <p data-fd="eyebrow" className="inline-flex items-center gap-[1.2vw] text-[clamp(11px,.9vw,17px)] font-bold uppercase tracking-[0.22em]">
          <span className="hidden sm:block h-px w-[8vw] lg:w-[8.5vw] bg-ink/30" />
          <span>The Rotation <span className="mx-1 text-olive">/</span> <span className="text-olive">Drop 02</span></span>
          <span className="hidden sm:block h-px w-[8vw] lg:w-[8.5vw] bg-ink/30" />
        </p>
        <h2 className="mt-[1.2vw] font-black italic uppercase leading-[0.9] tracking-tight text-[8.2vw] sm:text-[7.4vw] lg:text-[6.2vw]" style={{ fontVariationSettings: '"wdth" 84' }}>
          {['Built for the', 'Everyday Outlier'].map((t) => (
            <span key={t} className="block overflow-hidden py-[0.05em] -my-[0.05em] px-[0.12em] -mx-[0.12em]"><span data-fd="line" className="block">{t}</span></span>
          ))}
        </h2>
        <div className="inline-block mt-[0.4vw] lg:-mt-[0.4vw] -rotate-2">
          <p data-fd="script" className="font-script text-olive text-[10.5vw] sm:text-[7.5vw] lg:text-[4.9vw] leading-[1.1] whitespace-nowrap">Wear it your way</p>
          {/* in the flow, below the line box — never overlaps the lettering */}
          <div aria-hidden className="mt-[1vw] lg:mt-[0.5vw] flex justify-center">
            <img data-fd="underline" src={underline} alt="" loading="lazy" decoding="async" className="w-[92%] h-[2.4vw] lg:h-[1.3vw] object-fill" />
          </div>
        </div>
      </header>

      {/* rail + hangers */}
      <div
        ref={stage}
        role="group" aria-roledescription="carousel" aria-label="Featured tees — use the left and right arrow keys" tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => { pointer.current = { x: e.clientX, moved: false } }}
        onPointerUp={(e) => {
          const { x } = pointer.current
          if (x == null) return
          const dx = e.clientX - x
          pointer.current = { x: null, moved: Math.abs(dx) > 10 }
          if (Math.abs(dx) > 50) go(active + (dx < 0 ? 1 : -1))
        }}
        className="relative z-10 touch-pan-y select-none [--w:56vw] [--rail:5vw] lg:[--w:min(23vw,440px)] lg:[--rail:1.8vw] h-[calc(var(--rail)+var(--w)*1.12)] mt-[2vw] lg:mt-0"
      >
        {/* rail: full-bleed matte-black steel tube with a top highlight, a soft wall shadow, and ends that blur and fade into the page */}
        <div aria-hidden className="absolute inset-x-0 top-[calc(var(--rail)-var(--rod)/2)] h-[calc(var(--rod)*5)] [--rod:clamp(8px,.75vw,14px)]"
          style={{ maskImage: 'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)' }}>
          <div data-fd="rail" className="absolute inset-0">
            {/* wall shadow */}
            <div className="absolute inset-x-0 top-[calc(var(--rod)*0.7)] h-[calc(var(--rod)*3)] blur-[5px] opacity-80"
              style={{ background: 'linear-gradient(to bottom, rgba(70,45,15,.34), rgba(70,45,15,0))' }} />
            {/* tube body: dark core, lit from above */}
            <div className="absolute inset-x-0 top-0 h-[var(--rod)] rounded-full"
              style={{ background: 'linear-gradient(to bottom, #4a4a4a 0%, #1d1d1d 26%, #0b0b0b 58%, #000 78%, #1c1c1c 100%)', boxShadow: '0 1px 0 rgba(255,255,255,.18) inset, 0 2px 3px rgba(0,0,0,.35)' }} />
            {/* specular line along the top */}
            <div className="absolute inset-x-0 top-[calc(var(--rod)*0.16)] h-[calc(var(--rod)*0.14)] rounded-full blur-[0.6px]"
              style={{ background: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,.55) 14%, rgba(255,255,255,.16) 32%, rgba(255,255,255,.5) 55%, rgba(255,255,255,.12) 78%, rgba(255,255,255,0) 100%)' }} />
            {/* faint broad reflections */}
            <div className="absolute inset-x-0 top-0 h-[var(--rod)] rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,.07) 18%, transparent 34%, rgba(255,255,255,.06) 68%, transparent 84%)' }} />
          </div>
          {/* end blur: softens the tube and its shadow as they leave the screen */}
          {['left-0 [mask-image:linear-gradient(to_right,#000,transparent)]', 'right-0 [mask-image:linear-gradient(to_left,#000,transparent)]'].map((c) => (
            <div key={c} className={`absolute inset-y-0 w-[9vw] backdrop-blur-[4px] ${c}`} />
          ))}
        </div>

        {featured.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => (items.current[i] = el)}
            onClick={() => { if (pointer.current.moved) { pointer.current.moved = false; return } go(i) }}
            aria-label={`Show ${p.name}`}
            aria-current={i === active || undefined}
            tabIndex={-1}
            onPointerEnter={(e) => e.pointerType === 'mouse' && wobble(i)}
            className="absolute left-1/2 top-[calc(var(--rail)-var(--w)*0.035)] block w-[var(--w)] p-0 border-0 bg-transparent cursor-pointer"
          >
            <div ref={(el) => (swings.current[i] = el)}>
              <div ref={(el) => (sways.current[i] = el)}>
              <div ref={(el) => (wobbles.current[i] = el)} className="relative">
                <img src={hanger} alt="" width="1150" height="697" decoding="async" draggable="false"
                  className="absolute left-[25.7%] top-[calc(var(--w)*0.002)] w-[47.9%] h-auto" />
                <img src={p.img} alt={p.name} width="1200" height="1300" decoding="async" draggable="false"
                  className="relative block w-full h-auto mt-[calc(var(--w)*0.02)] drop-shadow-[0_22px_22px_rgba(70,45,15,.3)]" />
                {p.limited && (
                  <img src={tag} alt="Limited run" width="1539" height="501" decoding="async" draggable="false"
                    className="absolute left-[57%] top-[calc(var(--w)*0.15)] w-[46%] h-auto rotate-[5deg] drop-shadow-[0_5px_6px_rgba(0,0,0,.3)]" />
                )}
              </div>
              </div>
            </div>
          </button>
        ))}

        <button aria-label="Previous tee" disabled={active === 0} onClick={() => go(active - 1)} className={`${arrow} left-[1.6vw]`}><ChevronLeft size={22} /></button>
        <button aria-label="Next tee" disabled={active === N - 1} onClick={() => go(active + 1)} className={`${arrow} right-[1.6vw]`}><ChevronRight size={22} /></button>
      </div>

      {/* counter, details of the centred tee, CTAs */}
      <div data-fd="controls" className="relative z-10 flex flex-col items-center text-center px-5 pt-[2vw] pb-[10vw] sm:pb-[6vw] lg:pt-[1.2vw] lg:pb-[3vw]">
        <p className="flex items-center gap-4 text-sm font-semibold tabular-nums text-ink/60">
          <span>{pad(active + 1)} / {pad(N)}</span>
          <span aria-hidden className="relative h-[2px] w-[clamp(90px,10vw,170px)] bg-ink/15 overflow-hidden rounded-full">
            <span className="absolute inset-0 bg-olive origin-left transition-transform duration-700 ease-[cubic-bezier(.7,0,.2,1)]" style={{ transform: `scaleX(${(active + 1) / N})` }} />
          </span>
        </p>

        <div ref={detailsEl} className="mt-4 lg:mt-[1vw] flex flex-col items-center w-full">
          {/* title block reserves two lines on phones so the buttons never jump between tees */}
          <div className="flex items-center justify-center w-full min-h-[2.1em] lg:min-h-[1.1em] text-[clamp(26px,7.4vw,42px)] sm:text-[clamp(32px,4.6vw,50px)] lg:text-[clamp(34px,3.3vw,64px)]">
            <h3 data-detail className="font-black italic uppercase leading-[0.95] tracking-tight text-balance max-w-[18em]" style={{ fontVariationSettings: '"wdth" 84' }}>
              {cur.name.replace(/\s*Tee$/, '')}{' '}
              <span className="font-script not-italic normal-case font-normal text-olive text-[1.15em] inline-block -rotate-3 align-baseline">Tee</span>
            </h3>
          </div>

          <p data-detail className="mt-2 lg:mt-[0.5vw] flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
            <b className="text-[clamp(20px,1.7vw,32px)] tabular-nums">{inr(cur.price)}</b>
            <s className="text-ink/45 text-[clamp(13px,.95vw,18px)] tabular-nums">{inr(cur.mrp)}</s>
            <span className="bg-olive text-white text-xs font-bold px-3 py-1 rounded-full">{off(cur)}% OFF</span>
          </p>
          <p data-detail className="mt-1 text-[13px] lg:text-[clamp(13px,.9vw,17px)] text-ink/55">{cur.color} · Oversized fit</p>

          <div data-detail className="mt-4 lg:mt-[1.2vw] grid grid-cols-2 gap-2.5 w-full max-w-[320px] sm:flex sm:w-auto sm:max-w-none sm:justify-center sm:gap-3">
            <a href="#" className="inline-flex items-center justify-center gap-1.5 sm:gap-2.5 bg-ink text-white rounded-full font-bold uppercase tracking-wide whitespace-nowrap text-[clamp(11px,.75vw,14px)] px-3 sm:px-[clamp(20px,1.5vw,30px)] py-[clamp(10px,.75vw,15px)] transition-colors hover:bg-olive">
              View Drop <ArrowRight size={15} />
            </a>
            <button type="button" onClick={() => addToCart(cur)} aria-live="polite"
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2.5 border rounded-full font-bold uppercase tracking-wide whitespace-nowrap text-[clamp(11px,.75vw,14px)] px-3 sm:px-[clamp(20px,1.5vw,30px)] py-[clamp(10px,.75vw,15px)] transition-colors duration-300 active:scale-[.98] ${added === cur.id ? 'bg-olive border-olive text-white' : 'border-ink hover:bg-ink hover:text-white'}`}>
              {added === cur.id ? <><Check size={15} strokeWidth={2.6} /> Added</> : <><ShoppingBag size={15} /> Add to Cart</>}
            </button>
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{featured[active].name}, {active + 1} of {N}</p>
    </section>
  )
}