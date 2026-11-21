import { useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { BadgeCheck, ChevronLeft, ChevronRight, Quote, Sparkle, Star } from 'lucide-react'
import { reviews, SAMPLE_REVIEWS } from '../data/reviews'

import panel from '../assets/ShopByCategory/panel-tshirts.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'
import brushL from '../assets/hero/tshirts/brush-left.webp'
import brushR from '../assets/featuredDrop/brush-right.webp'
import buildingL from '../assets/featuredDrop/building-left.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const AVATARS = ['bg-olive text-white', 'bg-ink text-white', 'bg-sand text-ink', 'bg-olive/15 text-olive']
const initials = (name) => name.trim().slice(0, 2).toUpperCase()

function Stars({ value, size = 16, tone = 'olive' }) {
  const on = tone === 'light' ? 'fill-amber-300 text-amber-300' : 'fill-olive text-olive'
  const off = tone === 'light' ? 'text-white/25' : 'text-ink/20'
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} aria-hidden className={n <= value ? on : off} />)}
    </span>
  )
}

const TeeChip = ({ r, light }) => (
  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${light ? 'border-white/25 text-white/85' : 'border-ink/15 text-ink/70'}`}>
    <i aria-hidden className={`h-2.5 w-2.5 rounded-full ring-1 ${light ? 'ring-white/60' : 'ring-black/20'}`} style={{ background: r.hex }} />{r.tee}
  </span>
)

function Who({ r, i, light }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black tracking-wide ${light ? 'bg-cream text-ink' : AVATARS[i % AVATARS.length]}`}>{initials(r.name)}</span>
      <p className="min-w-0 leading-tight">
        <b className="flex items-center gap-1.5 text-[15px] font-bold">{r.name}
          {r.verified && <BadgeCheck size={16} aria-label="Verified buyer" className={light ? 'text-amber-300' : 'text-olive'} />}
        </b>
        <span className={`text-[13px] ${light ? 'text-white/65' : 'text-ink/55'}`}>{r.city}</span>
      </p>
    </div>
  )
}

function Card({ r, i }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-sand bg-white/70 p-6 shadow-[0_1px_0_rgba(13,13,13,.04)] transition-[transform,box-shadow] duration-500 ease-out hover:-translate-y-1.5 hover:shadow-[0_24px_40px_-22px_rgba(70,45,15,.4)] sm:rounded-[28px] lg:p-7">
      <Quote aria-hidden size={64} className="absolute -right-1 -top-1 rotate-6 fill-ink/[0.05] text-transparent transition-transform duration-500 group-hover:rotate-0" />
      <Stars value={r.rating} />
      <blockquote className="relative mt-4 flex-1 text-[clamp(15px,1.05vw,17px)] leading-relaxed text-ink/80">“{r.text}”</blockquote>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-t border-sand pt-5">
        <Who r={r} i={i} />
        <TeeChip r={r} />
      </div>
    </article>
  )
}

// the big olive card: paper texture, big quote, light text
function Featured({ r }) {
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[22px] bg-olive p-7 text-white shadow-[0_30px_50px_-28px_rgba(40,40,10,.7)] sm:rounded-[28px] lg:min-h-[560px] lg:p-10">
      <img src={panel} alt="" aria-hidden loading="lazy" decoding="async" className="absolute left-1/2 top-1/2 h-[122%] w-[122%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover" />
      <div aria-hidden className="absolute inset-0 bg-olive/55 mix-blend-multiply" />
      <Quote aria-hidden className="absolute -right-3 top-3 h-36 w-36 rotate-6 fill-white/[0.09] text-transparent lg:h-52 lg:w-52" />
      <div className="relative flex flex-1 flex-col">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white sm:text-[11px]">
          <Sparkle size={11} className="fill-amber-300 text-amber-300" /> Crew favourite
        </span>
        <div className="mt-5"><Stars value={r.rating} size={20} tone="light" /></div>
        <div className="flex flex-1 items-center py-8 lg:py-10">
          <blockquote className="text-[clamp(21px,2.05vw,36px)] font-semibold leading-snug text-balance">“{r.text}”</blockquote>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 border-t border-white/25 pt-6">
          <Who r={r} i={0} light />
          <TeeChip r={r} light />
        </div>
      </div>
    </article>
  )
}

export default function Reviews() {
  const root = useRef(null)
  const scroller = useRef(null)
  const [slide, setSlide] = useState(0)

  const [lead, ...rest] = reviews
  const count = reviews.length
  const slides = rest.length
  const average = reviews.reduce((s, r) => s + r.rating, 0) / count
  const spread = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }))

  // mobile / tablet carousel: which slide is nearest the left edge
  const onScroll = () => {
    const el = scroller.current
    const kids = [...el.children]
    const x = el.scrollLeft + 1
    let best = 0
    kids.forEach((k, i) => { if (Math.abs(k.offsetLeft - el.offsetLeft - x) < Math.abs(kids[best].offsetLeft - el.offsetLeft - x)) best = i })
    // at the very end the last card can never reach the left edge, so call it by scroll position instead
    if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 2) best = kids.length - 1
    setSlide(best)
  }
  const goTo = (i) => {
    const kids = [...scroller.current.children]
    const k = kids[Math.max(0, Math.min(kids.length - 1, i))]
    scroller.current.scrollTo({ left: k.offsetLeft - scroller.current.offsetLeft - 20, behavior: calm() ? 'auto' : 'smooth' })
  }

  useGSAP(() => {
    if (calm()) return
    const q = (s) => root.current.querySelector(s)
    const qa = (s) => root.current.querySelectorAll(s)

    gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: root.current, start: 'top 72%', once: true } })
      .from(qa('[data-rv=decor]'), { autoAlpha: 0, duration: 1.6, stagger: 0.12 }, 0)
      .from(q('[data-rv=eyebrow]'), { autoAlpha: 0, y: 14, duration: 0.7 }, 0.1)
      .from(qa('[data-rv=line]'), { yPercent: 115, duration: 0.95, ease: 'power4.out', stagger: 0.12 }, 0.2)
      .fromTo(q('[data-rv=script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -14 }, { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 0.65)
      .fromTo(q('[data-rv=underline]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.8, ease: 'power2.inOut' }, 0.95)
      .from(q('[data-rv=summary]'), { autoAlpha: 0, y: 30, duration: 0.9, clearProps: 'transform,opacity,visibility' }, 0.5)
      .from(qa('[data-rv=bar]'), { scaleX: 0, transformOrigin: 'left center', duration: 0.9, stagger: 0.08, ease: 'power3.inOut' }, 0.9)

    gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: q('[data-rv=grid]'), start: 'top 88%', once: true } })
      .from(qa('[data-rv=card]'), { autoAlpha: 0, y: 60, rotate: (i) => (i % 2 ? 2 : -2), duration: 0.85, stagger: 0.09, clearProps: 'transform,opacity,visibility' }, 0)
  }, { scope: root })

  return (
    <section ref={root} id="reviews" aria-labelledby="rv-heading" className="relative isolate scroll-mt-[114px] overflow-hidden bg-cream py-[14vw] sm:py-[9vw] lg:py-[5.6vw]">
      {/* backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <img data-rv="decor" src={brushL} alt="" loading="lazy" decoding="async" className="absolute -left-[4%] top-[1%] w-[34%] opacity-60 sm:w-[22%] lg:w-[15%]" />
        <img data-rv="decor" src={buildingL} alt="" loading="lazy" decoding="async" className="absolute -left-[3%] bottom-0 hidden h-[40%] w-auto opacity-40 lg:block" />
        <img data-rv="decor" src={brushR} alt="" loading="lazy" decoding="async" className="absolute -right-[3%] bottom-[2%] h-[26%] w-auto opacity-60 sm:h-[34%]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
        {/* heading + rating summary */}
        <header className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="text-center lg:text-left">
            <p data-rv="eyebrow" className="inline-flex items-center gap-4 text-[clamp(11px,.9vw,17px)] font-bold uppercase tracking-[0.22em]">
              <span className="hidden h-px w-10 bg-ink/30 sm:block lg:w-[4vw]" />
              <span>Reviews <span className="mx-1 text-olive">/</span> <span className="text-olive">Real talk</span></span>
              <span className="hidden h-px w-10 bg-ink/30 sm:block lg:hidden" />
            </p>
            <h2 id="rv-heading" className="mt-[3vw] font-black italic uppercase leading-[0.9] tracking-tight text-[13vw] sm:mt-[1.6vw] sm:text-[9.6vw] lg:mt-[1vw] lg:text-[6.4vw]" style={{ fontVariationSettings: '"wdth" 84' }}>
              {['Loved by', 'the crew'].map((l) => (
                <span key={l} className="-mx-[0.12em] -my-[0.05em] block overflow-hidden px-[0.12em] py-[0.05em]"><span data-rv="line" className="block">{l}</span></span>
              ))}
            </h2>
            <div className="mt-[1vw] inline-block -rotate-2 lg:mt-[0.2vw]">
              <p data-rv="script" className="whitespace-nowrap font-script text-[9vw] leading-[1.1] text-olive sm:text-[6.4vw] lg:text-[3.4vw]">What the crew says</p>
              <div aria-hidden className="mt-[0.8vw] flex justify-center lg:mt-[0.3vw] lg:justify-start"><img data-rv="underline" src={underline} alt="" loading="lazy" decoding="async" className="h-[2.4vw] w-[92%] object-fill lg:h-[1.1vw]" /></div>
            </div>
          </div>

          <div data-rv="summary" className="mx-auto w-full max-w-[460px] rounded-[22px] border border-sand bg-white/70 p-6 sm:rounded-[28px] lg:mx-0 lg:p-7">
            <div className="flex items-center gap-5">
              <p className="text-[64px] font-black italic leading-none tracking-tight [font-stretch:112%] lg:text-[72px]" aria-label={`Average rating ${average.toFixed(1)} out of 5`}>{average.toFixed(1)}</p>
              <div>
                <Stars value={Math.round(average)} size={20} />
                <p className="mt-1.5 text-[13px] text-ink/60">Based on {count} reviews</p>
              </div>
            </div>
            <ul className="mt-5 space-y-2" aria-label="Rating breakdown">
              {spread.map(({ n, c }) => (
                <li key={n} className="flex items-center gap-3 text-[12px] font-semibold tabular-nums text-ink/65">
                  <span className="flex w-6 items-center gap-0.5">{n}<Star size={11} aria-hidden className="fill-olive text-olive" /></span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-sand/70"><span data-rv="bar" className="block h-full rounded-full bg-olive" style={{ width: `${(c / count) * 100}%` }} /></span>
                  <span className="w-4 text-right">{c}</span>
                </li>
              ))}
            </ul>
            {SAMPLE_REVIEWS && <p className="mt-5 rounded-full border border-dashed border-ink/30 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink/55">Sample reviews: replace before launch</p>}
          </div>
        </header>

        {/* reviews: swipeable on phones and tablets, a featured card + two columns on desktop */}
        <div data-rv="grid" className="mt-10 lg:mt-[3.4vw] lg:grid lg:grid-cols-12 lg:gap-5">
          <div data-rv="card" className="mb-4 sm:mb-5 lg:col-span-5 lg:mb-0"><Featured r={lead} /></div>

          <div className="lg:col-span-7">
            <div ref={scroller} onScroll={onScroll} role="list" aria-label="Customer reviews"
              className="-mx-5 flex scroll-px-5 snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-4 [scrollbar-width:none] sm:gap-4 lg:mx-0 lg:block lg:columns-2 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
              {rest.map((r, i) => (
                <div key={r.id} role="listitem" data-rv="card" className="w-[86%] shrink-0 snap-start sm:w-[58%] lg:mb-5 lg:w-auto lg:break-inside-avoid"><Card r={r} i={i} /></div>
              ))}
            </div>

            {/* carousel controls (hidden on desktop) */}
            <div className="mt-4 flex items-center justify-center gap-4 lg:hidden">
              <button type="button" onClick={() => goTo(slide - 1)} disabled={slide === 0} aria-label="Previous review" className="grid h-10 w-10 place-items-center rounded-full border border-ink/80 transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30"><ChevronLeft size={18} /></button>
              <div className="flex items-center gap-2" aria-hidden>
                {rest.map((r, i) => <button key={r.id} type="button" tabIndex={-1} onClick={() => goTo(i)} className={`h-2 rounded-full transition-all duration-300 ${i === slide ? 'w-6 bg-ink' : 'w-2 bg-ink/25'}`} />)}
              </div>
              <button type="button" onClick={() => goTo(slide + 1)} disabled={slide === slides - 1} aria-label="Next review" className="grid h-10 w-10 place-items-center rounded-full border border-ink/80 transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
