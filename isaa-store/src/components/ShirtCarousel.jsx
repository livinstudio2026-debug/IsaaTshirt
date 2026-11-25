import { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

import circle from '../assets/hero/tshirts/circularBG.webp'
import ring from '../assets/hero/tshirts/hero-thin-ring-arrow-tips.svg'
import brushL from '../assets/hero/tshirts/brush-left.webp'
import brushR from '../assets/hero/tshirts/brush-right.webp'
import newDrop from '../assets/hero/tshirts/NewDrop.webp'

// offset (-2..2) → resting pose. xPercent/yPercent include the -50 centring.
// Centre shirt is largest; the pair beside it is smaller; the outer pair smaller still.
// Row 1: centre shirt. Row 2: the pair behind it. Row 3: the outer pair, lower and layered under row 2.
const POSE_D = {
  0: { xPercent: -50, yPercent: -50, scale: 1, rotate: 0, zIndex: 5, depth: 1 },
  1: { xPercent: 0, yPercent: -53, scale: 0.6, rotate: 3, zIndex: 4, depth: 0.6 },
  '-1': { xPercent: -100, yPercent: -53, scale: 0.6, rotate: -3, zIndex: 4, depth: 0.6 },
  2: { xPercent: 30, yPercent: -33, scale: 0.42, rotate: 6, zIndex: 3, depth: 0.35 },
  '-2': { xPercent: -130, yPercent: -33, scale: 0.42, rotate: -7, zIndex: 3, depth: 0.35 },
}
// Mobile: bigger shirts, tighter spread so the stack fills the screen width.
const POSE_M = {
  0: { xPercent: -50, yPercent: -56, scale: 1, rotate: 0, zIndex: 5, depth: 1 },
  1: { xPercent: -8, yPercent: -58, scale: 0.68, rotate: 3, zIndex: 4, depth: 0.6 },
  '-1': { xPercent: -92, yPercent: -58, scale: 0.68, rotate: -3, zIndex: 4, depth: 0.6 },
  2: { xPercent: 4, yPercent: -31, scale: 0.5, rotate: 6, zIndex: 3, depth: 0.35 },
  '-2': { xPercent: -104, yPercent: -31, scale: 0.5, rotate: -7, zIndex: 3, depth: 0.35 },
}
const mobileQ = () => window.matchMedia('(max-width: 1023px)').matches
const pose = (o) => (mobileQ() ? POSE_M : POSE_D)[Math.max(-2, Math.min(2, o))] // more than 5 tees: extras stack behind the outer pair
const offsetOf = (i, active, N) => {
  let d = (i - active + N) % N
  if (d > N / 2) d -= N
  return d
}
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ShirtCarousel({ products, active, onChange }) {
  const N = products.length
  const stage = useRef(null)
  const items = useRef([])   // pose layer (button)
  const floats = useRef([])  // idle up/down layer
  const imgs = useRef([])    // parallax layer
  const depth = useRef([])
  const bg = useRef([])      // decor parallax layers
  const spin = useRef(null)
  const ringEl = useRef(null)
  const prev = useRef(active)
  const lock = useRef(false)
  const drag = useRef(null)

  const go = (to) => {
    if (lock.current) return
    lock.current = true
    setTimeout(() => (lock.current = false), 650)
    onChange(((to % N) + N) % N)
  }

  useGSAP(() => {
    items.current.forEach((el, i) => {
      const { depth: d, ...rest } = pose(offsetOf(i, active, N))
      depth.current[i] = d
      gsap.set(el, rest)
    })
    if (calm()) return

    // ---- entrance: backdrop blooms, brushes sweep, shirts fan out from behind the hero tee ----
    const wipe = (from, to) => [{ clipPath: from }, { clipPath: to, clearProps: 'clipPath', duration: 1, ease: 'power2.inOut' }]
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    lock.current = true
    tl.eventCallback('onComplete', () => { lock.current = false })
    tl.from(bg.current[2], { scale: 0.55, opacity: 0, duration: 1.3 }, 0.1)
      .from(ringEl.current, { scale: 0.88, opacity: 0, rotate: -40, duration: 1.5 }, 0.2)
      .fromTo(bg.current[0].firstChild, ...wipe('inset(0 100% 0 0)', 'inset(0 -2% 0 0)'), 0.5)
      .fromTo(bg.current[1].firstChild, ...wipe('inset(0 0 0 100%)', 'inset(0 0 0 -2%)'), 0.6)
    items.current.forEach((el, i) => {
      const o = Math.abs(offsetOf(i, active, N))
      if (o === 0) tl.from(el, { yPercent: -28, scale: 0.88, opacity: 0, duration: 1.15 }, 0.5)
      else tl.from(el, { xPercent: -50, yPercent: -50, scale: 0.55, rotate: 0, opacity: 0, duration: 1, ease: 'power3.inOut' }, 0.75 + o * 0.3)
    })
    tl.fromTo(bg.current[3].firstChild, ...wipe('inset(0 100% 0 0)', 'inset(0 -2% 0 0)'), 1.5)
    // idle: every shirt drifts up and down, each on its own phase
    floats.current.forEach((el, i) =>
      gsap.to(el, { y: -14, duration: 2.6 + (i % 3) * 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -i * 0.8 }))
    // backdrop circle turns slowly and forever
    gsap.to(spin.current, { rotation: 360, duration: 70, ease: 'none', repeat: -1 })

    // pointer parallax: shirts move with the cursor by depth, decor moves against it
    if (!window.matchMedia('(hover: hover)').matches) return
    const sx = imgs.current.map((el) => gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3.out' }))
    const sy = imgs.current.map((el) => gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3.out' }))
    const bx = bg.current.map((el) => gsap.quickTo(el, 'x', { duration: 1.2, ease: 'power3.out' }))
    const by = bg.current.map((el) => gsap.quickTo(el, 'y', { duration: 1.2, ease: 'power3.out' }))
    const BG = [-26, 30, -14, 20] // brushL, brushR, circle, newDrop (px per full swing)
    const move = (e) => {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      imgs.current.forEach((_, i) => { sx[i](nx * 44 * depth.current[i]); sy[i](ny * 26 * depth.current[i]) })
      bg.current.forEach((_, i) => { bx[i](nx * BG[i]); by[i](ny * BG[i] * 0.6) })
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, { scope: stage })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const repose = () => items.current.forEach((el, i) => {
      const { depth: d, ...to } = pose(offsetOf(i, prev.current, N))
      depth.current[i] = d
      gsap.set(el, to)
    })
    mq.addEventListener('change', repose)
    return () => mq.removeEventListener('change', repose)
  }, [N])

  useEffect(() => {
    if (prev.current === active) return
    const from = prev.current
    prev.current = active
    items.current.forEach((el, i) => {
      const o0 = offsetOf(i, from, N), o1 = offsetOf(i, active, N)
      const { depth: d, ...to } = pose(o1)
      depth.current[i] = d
      if (Math.abs(o1 - o0) > 2) {
        // wraps to the far side: slips behind the stack, then settles
        gsap.timeline()
          .set(el, { zIndex: 1 })
          .to(el, { xPercent: -50, yPercent: -50, scale: 0.5, rotate: 0, duration: 0.3, ease: 'power2.in' })
          .to(el, { xPercent: to.xPercent, yPercent: to.yPercent, scale: to.scale, rotate: to.rotate, duration: 0.4, ease: 'power3.out' })
          .set(el, { zIndex: to.zIndex })
      } else {
        gsap.to(el, { ...to, duration: 0.7, ease: 'power3.inOut', overwrite: true })
      }
    })
  }, [active, N])

  useEffect(() => {
    const el = stage.current
    const onWheel = (e) => {
      const d = e.shiftKey ? e.deltaY : e.deltaX
      if (Math.abs(d) < 25 || (Math.abs(e.deltaX) < Math.abs(e.deltaY) && !e.shiftKey)) return
      e.preventDefault()
      go(active + (d > 0 ? 1 : -1))
    }
    const onKey = (e) => {
      const r = el.getBoundingClientRect()
      if (r.bottom < 0 || r.top > window.innerHeight) return // only while the hero is on screen
      if (e.key === 'ArrowRight') go(active + 1)
      if (e.key === 'ArrowLeft') go(active - 1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey) }
  })

  const decor = 'absolute pointer-events-none'

  return (
    <div
      ref={stage}
      className="relative w-full aspect-[1.1/1] lg:aspect-[1.4/1] select-none touch-pan-y"
      onPointerDown={(e) => (drag.current = e.clientX)}
      onPointerUp={(e) => {
        if (drag.current == null) return
        const dx = e.clientX - drag.current
        drag.current = null
        if (Math.abs(dx) > 50) go(active + (dx < 0 ? 1 : -1))
      }}
    >
      <div ref={(el) => (bg.current[0] = el)} className={`${decor} left-[-4%] top-[0%] w-[34%]`}><img src={brushL} alt="" className="w-full" /></div>
      <div ref={(el) => (bg.current[1] = el)} className={`${decor} right-[-3%] bottom-[2%] w-[32%]`}><img src={brushR} alt="" className="w-full" /></div>
      {/* centred by layout (not CSS translate) with a fixed aspect ratio, so GSAP never bakes in a size measured before the image loads */}
      <div className={`${decor} inset-0 grid place-items-center`}>
        <div ref={(el) => (bg.current[2] = el)} className="w-[89%] lg:w-[75%] aspect-square">
          <img ref={spin} src={circle} alt="" width="1024" height="1024" className="w-full h-full" />
        </div>
      </div>
      <div className={`${decor} inset-0 grid place-items-center`}>
        <img ref={ringEl} src={ring} alt="" width="1000" height="1000" className="w-[80%] lg:w-[83%] aspect-square" />
      </div>
      <div ref={(el) => (bg.current[3] = el)} className={`${decor} right-[-3%] top-[-4%] w-[24%] z-[6]`}>
        <img src={newDrop} alt="New Drop" className="w-full -rotate-2" />
      </div>

      {products.map((p, i) => (
        <button
          key={p.id}
          ref={(el) => (items.current[i] = el)}
          onClick={() => go(i)}
          aria-label={`Show ${p.name}`}
          className="absolute left-1/2 top-1/2 w-[63%] lg:w-[49%] bg-transparent border-0 p-0 cursor-pointer"
        >
          <div ref={(el) => (floats.current[i] = el)}>
            <img ref={(el) => (imgs.current[i] = el)} src={p.img} alt={p.name} draggable="false"
              className="w-full aspect-[12/13] object-contain drop-shadow-[0_26px_26px_rgba(40,25,10,.28)]" />
          </div>
        </button>
      ))}

    </div>
  )
}
