import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowUpRight, ChevronLeft, ChevronRight, Heart, MessageCircle, Pause, Play, Send, Sparkle } from 'lucide-react'
import { fetchReels, srcSet } from '../lib/api'
import { fallbackReels, HANDLE, PROFILE_URL } from '../data/instagram'

import favicon from '../assets/logo/favIcon.webp'
import panel from '../assets/ShopByCategory/panel-tshirts.webp'
import paper from '../assets/ShopByCategory/label-paper.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'
import brushL from '../assets/hero/tshirts/brush-left.webp'
import brushR from '../assets/featuredDrop/brush-right.webp'
import buildingL from '../assets/featuredDrop/building-left.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const DURATION = 6500
const DEFAULT_ACCENT = '#c9a27a'
const SPREAD = { narrow: [0, 62, 112], wide: [0, 92, 172] }
const TILT = [0, 36, 50]
const DEPTH = [0, -150, -320]
const DROP = [0, 5, 17]
const SCALE = [1, 0.87, 0.74]
const ALPHA = [1, 0.8, 0.42]

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pad = (n) => String(n).padStart(2, '0')
const mod = (i, n) => ((i % n) + n) % n
const accentOf = (r) => r.accent || DEFAULT_ACCENT
const hosted = (url) => url.includes('/upload/f_auto,q_auto:good/')

function signedDistance(i, cur, n) {
  const d = mod(i - cur, n)
  return d > n / 2 ? d - n : d
}

function pose(d, wide) {
  const a = Math.min(Math.abs(d), 2)
  const s = Math.sign(d)
  return {
    xPercent: -50 + s * SPREAD[wide ? 'wide' : 'narrow'][a],
    yPercent: DROP[a],
    z: DEPTH[a],
    rotationY: s * TILT[a],
    rotation: s * a * 3.5,
    scale: SCALE[a],
    autoAlpha: Math.abs(d) > 2 ? 0 : ALPHA[a],
    zIndex: 10 - a,
  }
}

function InstagramGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
    </svg>
  )
}

function Card({ r, i, n, active, playing, video, onHit, onBroken, setRef, setBar, setVideo }) {
  return (
    <article
      ref={setRef}
      role="group"
      aria-roledescription="slide"
      aria-label={`Reel ${i + 1} of ${n}`}
      className="absolute left-1/2 top-0 w-[var(--cw)] will-change-transform"
      style={{ '--accent': accentOf(r), visibility: 'hidden' }}
    >
      <div className={`relative aspect-[9/16] overflow-hidden rounded-[22px] bg-ink ring-1 ring-white/15 transition-shadow duration-700 sm:rounded-[28px] ${active ? 'shadow-[0_26px_50px_-32px_var(--accent)]' : 'shadow-[0_20px_40px_-26px_rgba(0,0,0,.75)]'}`}>
        <img
          src={r.poster}
          srcSet={hosted(r.poster) ? srcSet(r.poster, [420, 700]) : undefined}
          sizes="(min-width: 1024px) 340px, 260px"
          alt={r.caption}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
        {video && active && (
          <video
            ref={setVideo}
            src={r.video}
            poster={r.poster}
            muted
            playsInline
            preload="metadata"
            onError={onBroken}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[28%] bg-gradient-to-b from-black/55 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

        <div aria-hidden className="absolute inset-x-0 top-0 px-3.5 pt-3.5 sm:px-4 sm:pt-4">
          <span className="block h-[3px] overflow-hidden rounded-full bg-white/30">
            <i ref={setBar} className="block h-full origin-left bg-white" style={{ transform: 'scaleX(var(--p,0))' }} />
          </span>
          <span className="mt-3 flex items-center justify-between gap-2">
            <span className="inline-flex max-w-[70%] items-center gap-1.5 truncate rounded-full bg-cream px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-ink sm:text-[10px]">
              <Sparkle size={9} className="shrink-0 fill-olive text-olive" />
              <span className="truncate">{r.tag || 'Reel'}</span>
            </span>
            <span className="text-[10px] font-bold tabular-nums tracking-wider text-white/85">{pad(i + 1)} / {pad(n)}</span>
          </span>
        </div>

        {active && !playing && (
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-cream/90 text-ink backdrop-blur">
            <Play size={26} className="ml-1 fill-ink" />
          </span>
        )}

        <div aria-hidden className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 px-3 pb-3.5 sm:px-3.5 sm:pb-4">
          <span className="relative inline-flex min-w-0 -rotate-1 items-center gap-2 py-2 pl-3 pr-5">
            <img src={paper} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-fill" />
            <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-olive ring-1 ring-ink/20">
              <img src={favicon} alt="" loading="lazy" decoding="async" className="h-full w-full scale-[1.15] object-contain" />
            </span>
            <b className="relative truncate text-[12px] font-extrabold tracking-tight text-ink sm:text-[13px]">@{HANDLE}</b>
          </span>
          <span className="flex shrink-0 flex-col items-center gap-3 pb-1 text-white">
            <Heart size={19} className="drop-shadow" />
            <MessageCircle size={19} className="drop-shadow" />
            <Send size={19} className="drop-shadow" />
          </span>
        </div>

        <button
          type="button"
          onClick={onHit}
          aria-label={active ? (playing ? 'Pause this reel' : 'Play this reel') : `Show reel ${i + 1}`}
          className="absolute inset-0 cursor-pointer focus-visible:outline-offset-[-4px]"
        />
      </div>
    </article>
  )
}

export default function InstagramWall() {
  const root = useRef(null)
  const cards = useRef([])
  const bars = useRef([])
  const videoEl = useRef(null)
  const prev = useRef([])
  const lastLayout = useRef({ reels: null, wide: null })
  const progress = useRef(0)
  const gesture = useRef({ x: 0, y: 0, down: false, swiped: false })

  const [reels, setReels] = useState(fallbackReels)
  const [cur, setCur] = useState(0)
  const [playing, setPlaying] = useState(() => !calm())
  const [inView, setInView] = useState(false)
  const [awake, setAwake] = useState(() => !document.hidden)
  const [broken, setBroken] = useState({})
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  const n = reels.length
  const active = reels[cur] ?? reels[0]
  const running = playing && inView && awake && n > 1

  useEffect(() => {
    const ac = new AbortController()
    fetchReels(ac.signal)
      .then((list) => {
        if (!list.length) return
        setReels(list)
        setCur(0)
        setBroken({})
      })
      .catch(() => {})
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    const on = () => setAwake(!document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 })
    io.observe(root.current)
    return () => io.disconnect()
  }, [])

  useLayoutEffect(() => {
    cards.current.length = n
    bars.current.length = n
    const fresh = lastLayout.current.reels !== reels || lastLayout.current.wide !== wide
    if (fresh) prev.current = []
    lastLayout.current = { reels, wide }
    const t = calm() ? 0 : 1

    cards.current.forEach((el, i) => {
      if (!el) return
      const d = signedDistance(i, cur, n)
      const to = pose(d, wide)
      const before = prev.current[i]
      prev.current[i] = d
      gsap.killTweensOf(el)
      if (before === undefined || t === 0) {
        gsap.set(el, to)
      } else if (Math.abs(d - before) > n / 2) {
        gsap.timeline().to(el, { autoAlpha: 0, duration: 0.2 }).set(el, { ...to, autoAlpha: 0 }).to(el, { autoAlpha: to.autoAlpha, duration: 0.5 })
      } else {
        gsap.to(el, { ...to, duration: 0.95, ease: 'power3.out' })
      }
    })
  }, [cur, reels, wide, n])

  const setProgress = useCallback((v) => {
    bars.current[cur]?.style.setProperty('--p', Math.min(1, Math.max(0, v)).toFixed(4))
  }, [cur])

  const go = useCallback((to) => {
    progress.current = 0
    setCur((c) => mod(typeof to === 'function' ? to(c) : to, n))
  }, [n])

  useEffect(() => {
    bars.current.forEach((b, i) => { if (i !== cur) b?.style.setProperty('--p', 0) })
  }, [cur, reels])

  const useVideo = Boolean(active?.video) && !broken[active?.id]

  useEffect(() => {
    if (!active) return undefined
    const video = videoEl.current
    if (useVideo && video) {
      if (!running) { video.pause(); return undefined }
      const tick = () => { if (video.duration) setProgress(video.currentTime / video.duration) }
      const end = () => go((c) => c + 1)
      video.addEventListener('timeupdate', tick)
      video.addEventListener('ended', end)
      video.play().catch(() => {})
      return () => {
        video.removeEventListener('timeupdate', tick)
        video.removeEventListener('ended', end)
      }
    }
    if (!running) return undefined
    let raf = 0
    let last = 0
    const frame = (t) => {
      if (last) progress.current += (t - last) / DURATION
      last = t
      setProgress(progress.current)
      if (progress.current >= 1) { go((c) => c + 1); return }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [active, cur, running, useVideo, go, setProgress])

  const onPointerDown = (e) => { gesture.current = { x: e.clientX, y: e.clientY, down: true, swiped: false } }
  const onPointerUp = (e) => {
    const g = gesture.current
    if (!g.down) return
    g.down = false
    const dx = e.clientX - g.x
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(e.clientY - g.y)) {
      g.swiped = true
      go((c) => c + (dx < 0 ? 1 : -1))
    }
  }
  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go((c) => c + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go((c) => c - 1) }
  }
  const hit = (i) => () => {
    if (gesture.current.swiped) { gesture.current.swiped = false; return }
    if (i === cur) setPlaying((p) => !p)
    else go(i)
  }

  useGSAP(() => {
    if (calm()) return
    const q = (s) => root.current.querySelector(s)
    const qa = (s) => root.current.querySelectorAll(s)
    gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: root.current, start: 'top 72%', once: true } })
      .from(qa('[data-ig=decor]'), { autoAlpha: 0, duration: 1.6, stagger: 0.12 }, 0)
      .from(q('[data-ig=eyebrow]'), { autoAlpha: 0, y: 14, duration: 0.7 }, 0.1)
      .from(qa('[data-ig=line]'), { yPercent: 115, duration: 0.95, ease: 'power4.out', stagger: 0.12 }, 0.2)
      .fromTo(q('[data-ig=script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -14 }, { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 0.65)
      .fromTo(q('[data-ig=underline]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.8, ease: 'power2.inOut' }, 0.95)
      .from(q('[data-ig=follow]'), { autoAlpha: 0, y: 20, duration: 0.8, clearProps: 'transform,opacity,visibility' }, 0.8)
      .from(q('[data-ig=stage]'), { autoAlpha: 0, y: 70, duration: 1.1, clearProps: 'transform,opacity,visibility' }, 0.5)
      .from(q('[data-ig=meta]'), { autoAlpha: 0, y: 24, duration: 0.8, clearProps: 'transform,opacity,visibility' }, 1.1)
  }, { scope: root })

  const isProfile = active.url === PROFILE_URL

  return (
    <section ref={root} id="instagram" aria-labelledby="ig-heading" className="relative isolate scroll-mt-[114px] overflow-hidden bg-moss py-[14vw] text-cream sm:py-[9vw] lg:py-[5.6vw]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <img src={panel} alt="" loading="lazy" decoding="async" className="absolute -left-[15%] -top-[15%] h-[130%] w-[130%] max-w-none object-fill opacity-[.22] mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-moss/60 via-transparent to-moss/80" />
        <img data-ig="decor" src={brushL} alt="" loading="lazy" decoding="async" className="absolute -left-[6%] top-[2%] w-[38%] opacity-[.16] sm:w-[24%] lg:w-[16%]" />
        <img data-ig="decor" src={buildingL} alt="" loading="lazy" decoding="async" className="absolute -left-[4%] bottom-0 hidden h-[46%] w-auto opacity-[.14] lg:block" />
        <img data-ig="decor" src={brushR} alt="" loading="lazy" decoding="async" className="absolute -right-[4%] top-[8%] h-[30%] w-auto opacity-[.16] sm:h-[38%]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
        <header className="flex flex-col items-center text-center">
          <p data-ig="eyebrow" className="inline-flex items-center gap-4 text-[clamp(11px,.9vw,17px)] font-bold uppercase tracking-[0.22em]">
            <span className="hidden h-px w-10 bg-cream/30 sm:block lg:w-[4vw]" />
            <span>Instagram <span className="mx-1 text-amber-300">/</span> <span className="text-amber-300">@{HANDLE}</span></span>
            <span className="hidden h-px w-10 bg-cream/30 sm:block lg:w-[4vw]" />
          </p>
          <h2 id="ig-heading" className="mt-[3vw] font-black italic uppercase leading-[0.9] tracking-tight text-[13vw] sm:mt-[1.6vw] sm:text-[9.6vw] lg:mt-[1vw] lg:text-[5.4vw]" style={{ fontVariationSettings: '"wdth" 84' }}>
            {['Straight from', 'the feed'].map((l) => (
              <span key={l} className="-mx-[0.12em] -my-[0.05em] block overflow-hidden px-[0.12em] py-[0.05em]"><span data-ig="line" className="block">{l}</span></span>
            ))}
          </h2>
          <div className="mt-[1vw] inline-block -rotate-2 lg:mt-[0.2vw]">
            <p data-ig="script" className="whitespace-nowrap font-script text-[9vw] leading-[1.1] text-sand sm:text-[6.4vw] lg:text-[3vw]">Follow the vibe</p>
            <div aria-hidden className="mt-[0.8vw] flex justify-center lg:mt-[0.3vw]"><img data-ig="underline" src={underline} alt="" loading="lazy" decoding="async" className="h-[2.4vw] w-[92%] object-fill [filter:brightness(1.6)_saturate(.9)] lg:h-[1.1vw]" /></div>
          </div>
          <a data-ig="follow" href={PROFILE_URL} target="_blank" rel="noopener noreferrer"
            className="group mt-8 inline-flex items-center gap-3 rounded-full bg-cream px-7 py-3.5 text-[13px] font-bold uppercase tracking-wide text-ink transition-colors hover:bg-white lg:mt-[1.6vw]">
            <InstagramGlyph />
            Follow @{HANDLE}
            <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </header>

        <div
          data-ig="stage"
          role="region"
          aria-roledescription="carousel"
          aria-label="Instagram reels"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { gesture.current.down = false }}
          className="relative mt-10 touch-pan-y select-none outline-offset-8 [--cw:clamp(176px,56vw,250px)] sm:mt-12 sm:[--cw:clamp(220px,32vw,290px)] lg:mt-[2.4vw] lg:[--cw:clamp(250px,19vw,350px)]"
        >
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-[46%] h-[130%] w-[min(1000px,130vw)] -translate-x-1/2 -translate-y-1/2">
            {reels.map((r, i) => (
              <span key={r.id} className="absolute inset-0 transition-opacity duration-1000" style={{ opacity: i === cur ? 1 : 0, background: `radial-gradient(closest-side, ${accentOf(r)}59, ${accentOf(r)}00 72%)` }} />
            ))}
          </div>
          <div className="relative mx-auto h-[calc(var(--cw)*2.04)] w-full max-w-[1500px] [perspective:1700px] [mask-image:linear-gradient(90deg,transparent,#000_9%,#000_91%,transparent)]">
            {reels.map((r, i) => (
              <Card
                key={r.id}
                r={r}
                i={i}
                n={n}
                active={i === cur}
                playing={playing}
                video={Boolean(r.video) && !broken[r.id]}
                onHit={hit(i)}
                onBroken={() => setBroken((b) => ({ ...b, [r.id]: true }))}
                setRef={(el) => { cards.current[i] = el }}
                setBar={(el) => { bars.current[i] = el }}
                setVideo={(el) => { videoEl.current = el }}
              />
            ))}
          </div>
        </div>

        <div data-ig="meta" className="mt-6 flex flex-col items-center gap-6 lg:mt-[1.6vw] lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          <div className="max-w-[460px] text-center lg:text-left" aria-live="off">
            <span className="inline-flex items-center gap-2 rounded-full border border-cream/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-cream/85">
              <i aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-white/50" style={{ background: accentOf(active) }} />{active.tag || 'Reel'}
            </span>
            <p className="mt-3 min-h-[3.2em] text-[clamp(15px,1.05vw,18px)] leading-relaxed text-cream/75">{active.caption}</p>
          </div>

          <div className="flex items-center gap-4">
            <button type="button" onClick={() => go((c) => c - 1)} disabled={n < 2} aria-label="Previous reel" className="grid h-11 w-11 place-items-center rounded-full border border-cream/60 transition-colors hover:bg-cream hover:text-ink disabled:pointer-events-none disabled:opacity-30"><ChevronLeft size={18} /></button>
            <div className="flex items-center gap-2" role="group" aria-label="Choose a reel">
              {reels.map((r, i) => (
                <button key={r.id} type="button" onClick={() => go(i)} aria-label={`Show reel ${i + 1}`} aria-current={i === cur} className="grid h-6 place-items-center">
                  <span className={`block h-2 rounded-full transition-all duration-300 ${i === cur ? 'w-7 bg-cream' : 'w-2 bg-cream/30'}`} />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => go((c) => c + 1)} disabled={n < 2} aria-label="Next reel" className="grid h-11 w-11 place-items-center rounded-full border border-cream/60 transition-colors hover:bg-cream hover:text-ink disabled:pointer-events-none disabled:opacity-30"><ChevronRight size={18} /></button>
            <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause autoplay' : 'Start autoplay'} className="ml-1 grid h-11 w-11 place-items-center rounded-full bg-olive text-white transition-colors hover:bg-cream hover:text-ink">
              {playing ? <Pause size={16} className="fill-current" /> : <Play size={16} className="ml-0.5 fill-current" />}
            </button>
          </div>

          <a href={active.url} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-cream underline decoration-cream/30 decoration-2 underline-offset-8 transition-colors hover:decoration-amber-300 lg:justify-self-end">
            {isProfile ? 'Visit our Instagram' : 'Watch on Instagram'}
            <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  )
}
