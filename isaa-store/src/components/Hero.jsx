import { useState, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Send, ShieldCheck, RefreshCw } from 'lucide-react'
import ShirtCarousel from './ShirtCarousel'
import { products, discount } from '../data/products'
gsap.registerPlugin(ScrollTrigger, useGSAP)

import facade from '../assets/hero/FadedNeoclassicalFacadeBorder.webp'

const pad = (n) => String(n).padStart(2, '0')
const inr = (n) => '₹' + n.toLocaleString('en-IN')

const trust = [
  { Icon: Send, t: 'Free Shipping', s: 'Above ₹1,499' },
  { Icon: ShieldCheck, t: 'Secure Payments', s: '100% Safe' },
  { Icon: RefreshCw, t: 'Easy Returns', s: 'Within 7 Days' },
]

export default function Hero() {
  const [active, setActive] = useState(0)
  const p = products[active]
  const root = useRef(null)
  const textCol = useRef(null)
  const stageCol = useRef(null)
  const facadeEl = useRef(null)
  const squiggleEl = useRef(null)

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const q = (s) => root.current.querySelectorAll(s)

    // load-in: copy builds line by line while the shirt stack assembles beside it
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from(facadeEl.current, { opacity: 0, duration: 1.8 }, 0)
      .fromTo(q('[data-hero=eyebrow]'), { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, clearProps: 'opacity,transform' }, 0)
      .from(q('[data-line]'), { yPercent: 115, duration: 1.05, ease: 'power4.out', stagger: 0.12 }, 0.1)
      .fromTo(q('[data-hero=script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -16 },
        { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 1, ease: 'power2.inOut' }, 0.6)
      .fromTo(q('[data-hero=para]'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, clearProps: 'opacity,transform' }, 0.9)
      .fromTo(q('[data-hero=buttons] a'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, clearProps: 'opacity,transform' }, 1.05)
      .fromTo(squiggleEl.current, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 1.1)
      .fromTo(q('[data-hero=trust] li'), { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, clearProps: 'opacity,transform' }, 1.3)
      .fromTo(q('[data-hero=bottom]'), { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.1, clearProps: 'opacity,transform' }, 1.45)

    // safety net: if the timeline is ever interrupted (fast refresh, tab switch), nothing stays hidden
    const safe = gsap.delayedCall(4, () => gsap.set(q('[data-hero=eyebrow], [data-hero=para], [data-hero=buttons] a, [data-hero=trust] li, [data-hero=bottom]'), { clearProps: 'opacity,transform' }))

    // scroll depth (desktop): copy, shirts and the building drift at different speeds as the hero leaves
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const st = { trigger: root.current, start: 'top top', end: 'bottom top', scrub: 0.6 }
      gsap.to(textCol.current, { y: -60, ease: 'none', scrollTrigger: st })
      gsap.to(stageCol.current, { y: 70, ease: 'none', scrollTrigger: st })
      gsap.to(facadeEl.current, { y: 130, ease: 'none', scrollTrigger: st })
    })
    return () => { safe.kill(); mm.revert() }
  }, { scope: root })

  const card = (className) => (
        <div key={p.id} data-hero="bottom" className={`${className} items-center gap-4 bg-cream border border-sand rounded-2xl px-4 py-3 shadow-sm w-full max-w-md xl:w-auto xl:min-w-[340px]`}>
          <img src={p.img} alt="" className="w-[60px] h-[60px] object-contain" />
          <div>
            <p className="font-bold">{p.name}</p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              <b className="text-lg">{inr(p.price)}</b>
              <s className="text-ink/45 text-sm">{inr(p.mrp)}</s>
              <span className="bg-olive text-white text-xs font-bold px-3 py-1 rounded-full">{discount(p)}% OFF</span>
            </p>
          </div>
        </div>
  )
  const controls = (className) => (
        <div data-hero="bottom" className={`${className} flex-wrap items-center gap-x-5 gap-y-4`}>
          <div className="flex gap-2">
            {products.map((t, i) => (
              <button key={t.id} onClick={() => setActive(i)} aria-label={t.name}
                className={`w-12 h-12 rounded-lg bg-sand/50 p-1 transition ${i === active ? 'ring-2 ring-ink' : 'opacity-80 hover:opacity-100'}`}>
                <img src={t.img} alt="" className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
          <p className="text-sm font-semibold tabular-nums flex items-center gap-3 sm:pl-5 sm:border-l border-ink/20">{pad(active + 1)}<span className="w-7 h-px bg-ink" />{pad(products.length)}</p>
        </div>
  )

  const buttons = (className) => (
    <div data-hero="buttons" className={`${className} flex-wrap gap-4`}>
            <a href="#" className="inline-flex items-center gap-3 bg-ink text-white font-bold text-[clamp(13px,.85vw,16px)] uppercase tracking-wide px-[clamp(28px,2.1vw,40px)] py-[clamp(15px,1.1vw,22px)] rounded-full transition-colors hover:bg-olive">Shop the Drop <ArrowRight size={18} /></a>
            <a href="#" className="inline-flex items-center border border-ink font-bold text-[clamp(13px,.85vw,16px)] uppercase tracking-wide px-[clamp(28px,2.1vw,40px)] py-[clamp(15px,1.1vw,22px)] rounded-full transition-colors hover:bg-ink hover:text-white">Explore More</a>
    </div>
  )

  return (
    <section ref={root} className="relative overflow-hidden bg-cream">
      <img ref={facadeEl} src={facade} alt="" className="absolute left-0 top-0 h-[380px] md:h-[70%] max-w-none opacity-45 md:opacity-60 pointer-events-none" />
      <img ref={squiggleEl} src="/squiggle.svg" alt="" className="absolute left-0 bottom-[16%] w-32 pointer-events-none hidden lg:block" />

      <div className="relative max-w-[1680px] mx-auto px-5 lg:px-[6vw] pt-8 lg:pt-[3vw] grid lg:grid-cols-[35vw_1fr] gap-6 lg:gap-[1vw] items-center">
        <div ref={textCol} className="relative z-10 order-1">
          <p data-hero="eyebrow" className="inline-flex items-center gap-3 text-[clamp(12px,.85vw,17px)] font-bold uppercase tracking-wide">
            <span className="w-7 h-7 rounded-full border border-sand grid place-items-center"><span className="w-2.5 h-2.5 rounded-full bg-olive" /></span>
            Drop 02 — The Street Edit
            <span className="hidden sm:block w-28 h-px bg-ink/30" />
          </p>
          <h1 className="mt-[1.6vw] font-black italic uppercase leading-[0.88] tracking-tight whitespace-nowrap text-[19vw] sm:text-[14vw] lg:text-[8.4vw]" style={{ fontVariationSettings: '"wdth" 75' }}>
            {['Wear', 'The Vibe'].map((t) => (
              <span key={t} className="block overflow-hidden py-[0.05em] -my-[0.05em] pr-[0.12em] -mr-[0.12em]"><span data-line className="block">{t}</span></span>
            ))}
          </h1>
          <p data-hero="script" className="font-script text-olive text-[12vw] sm:text-[9vw] lg:text-[5.2vw] whitespace-nowrap leading-none -mt-[0.6vw] -rotate-3 origin-left">Own the Streets</p>
          <p data-hero="para" className="mt-[1.8vw] max-w-[32em] text-[clamp(16px,1.12vw,22px)] leading-relaxed text-ink/65">
            Oversized fits. Bold prints. Unmatched comfort.<br />Built for the ones who move different.
          </p>
          {buttons('mt-[2.2vw] hidden lg:flex')}
        </div>

        <div ref={stageCol} className="order-2 w-full">
          <ShirtCarousel active={active} onChange={setActive} />
          <div className="lg:hidden mt-5 flex flex-col items-center gap-4">
            {card('flex')}
            {controls('flex justify-center')}
          </div>
        </div>

        {buttons('order-3 flex lg:hidden justify-center')}
      </div>

      <div className="relative max-w-[1680px] mx-auto px-5 lg:px-[6vw] py-8 grid 2xl:grid-cols-[1fr_auto_auto] gap-6 2xl:gap-8 items-center">
        <ul data-hero="trust" className="grid grid-cols-3 w-full 2xl:max-w-[680px] lg:pb-6 2xl:pb-0 lg:border-b lg:border-sand 2xl:border-0">
          {trust.map(({ Icon, t, s }) => (
            <li key={t} className="flex flex-col lg:flex-row items-center lg:justify-center text-center lg:text-left gap-2 lg:gap-3 px-1 lg:px-4 border-r last:border-r-0 border-ink/20">
              <Icon size={28} strokeWidth={1.3} />
              <div className="text-xs sm:text-sm leading-snug"><b className="font-semibold block">{t}</b><span className="text-ink/55">{s}</span></div>
            </li>
          ))}
        </ul>

        <div className="hidden lg:flex flex-wrap items-center justify-between gap-6 2xl:contents">
          {card('hidden lg:flex')}
          {controls('hidden lg:flex')}
        </div>
      </div>
    </section>
  )
}
