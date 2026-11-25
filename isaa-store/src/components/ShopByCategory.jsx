import { Link } from 'react-router-dom'
import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Sparkle } from 'lucide-react'
import { categories, decor } from '../data/categories'

gsap.registerPlugin(ScrollTrigger, useGSAP)

function Card({ c }) {
  const { fit } = c
  return (
    <li className="cat-card @container relative">
      <Link
        to={`/shop/${c.id}`}
        aria-label={`Shop ${c.label}`}
        className="group relative block transition-transform duration-500 ease-out hover:-translate-y-2 focus-visible:-translate-y-2"
      >
        <img src={c.panel} alt="" aria-hidden="true" width="1145" height="1374" loading="lazy" decoding="async" className="block w-full h-auto select-none" draggable="false" />
        {c.sparkle && (
          <Sparkle aria-hidden="true" className="absolute left-[15%] top-[14%] w-[7cqw] h-[7cqw] fill-cream text-cream" strokeWidth={1} />
        )}
        <img
          src={c.product}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          draggable="false"
          style={{ width: `${fit.w}%`, left: `${fit.left}%`, top: `${fit.top}%`, aspectRatio: c.ratio }}
          className="absolute h-auto select-none pointer-events-none origin-bottom transition-transform duration-500 ease-out group-hover:scale-[1.04] group-focus-visible:scale-[1.04] [filter:drop-shadow(0_1.6cqw_1.4cqw_rgba(0,0,0,0.38))]"
        />
        <span
          style={{ rotate: `${c.tilt}deg`, backgroundImage: `url(${decor.label})` }}
          className="@container absolute left-[9%] bottom-[2.5%] grid w-[74%] place-items-center bg-contain bg-center bg-no-repeat aspect-[3.2/1] transition-transform duration-500 ease-out group-hover:scale-105"
        >
          <span className="flex items-center gap-[3.5cqw] whitespace-nowrap pb-[1cqw]">
            <span style={{ fontSize: `max(11px, ${c.size}cqw)` }} className="font-black italic uppercase tracking-tight leading-none text-ink [font-stretch:112%]">
              {c.label}
            </span>
            <span className="grid shrink-0 place-items-center rounded-full border-2 border-ink text-ink w-[max(22px,11cqw)] h-[max(22px,11cqw)] transition-colors duration-300 group-hover:bg-ink group-hover:text-cream">
              <ArrowRight className="w-[55%] h-[55%] transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2.4} aria-hidden="true" />
            </span>
          </span>
        </span>
      </Link>
    </li>
  )
}

export default function ShopByCategory() {
  const root = useRef(null)

  useGSAP(() => {
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (calm) return
    const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: 'top 72%', once: true } })
    tl.from('.cat-kicker', { autoAlpha: 0, y: 16, duration: 0.6, ease: 'power2.out' })
      .from('.cat-title', { autoAlpha: 0, y: 40, skewX: -6, duration: 0.8, ease: 'power3.out' }, '<0.1')
      .from('.cat-script', { autoAlpha: 0, x: -30, rotate: -3, duration: 0.7, ease: 'power3.out' }, '<0.35')
      .from('.cat-card', { autoAlpha: 0, y: 70, rotate: (i) => (i % 2 ? 4 : -4), duration: 0.9, ease: 'power3.out', stagger: 0.12, clearProps: 'transform,opacity,visibility' }, '<0.15')
  }, { scope: root })

  return (
    <section ref={root} id="categories" aria-labelledby="cat-heading" className="relative isolate overflow-hidden bg-cream pt-[12vw] pb-[16vw] sm:pt-[9vw] sm:pb-[9vw] lg:pt-[5.6vw] lg:pb-[7vw]">
      <div className="relative mx-auto w-full max-w-[1760px] px-[3vw]">
        <header className="relative flex flex-col items-center text-center">
          <p className="cat-kicker flex w-full max-w-[46vw] items-center justify-center gap-[2.2vw] text-[3.2vw] sm:text-[2.2vw] lg:text-[1.65vw] font-semibold uppercase tracking-[0.34em] text-ink">
            <span aria-hidden="true" className="h-px flex-1 bg-ink/70" />
            <span className="pl-[0.34em]">Shop by</span>
            <span aria-hidden="true" className="h-px flex-1 bg-ink/70" />
          </p>
          <h2 id="cat-heading" className="cat-title cat-grunge mt-[0.4vw] font-black italic uppercase leading-[0.9] tracking-[-0.025em] text-[13vw] sm:text-[11vw] lg:text-[8.4vw] [font-stretch:125%]" style={{ '--tex': `url(${decor.texture})` }}>
            Category
          </h2>
          <img src={decor.script} alt="Find your vibe" width="2032" height="774" className="cat-script relative -mt-[3vw] lg:-mt-[2.4vw] ml-[6vw] lg:ml-[5vw] w-[44vw] sm:w-[34vw] lg:w-[25.5vw] h-auto select-none" draggable="false" />
        </header>

        <ul className="mx-auto mt-[0.5vw] lg:mt-[-1.6vw] grid max-w-[1600px] list-none grid-cols-2 gap-x-[1vw] gap-y-[5vw] p-0 lg:grid-cols-4 lg:gap-x-0 lg:gap-y-0">
          {categories.map((c) => <Card key={c.id} c={c} />)}
        </ul>
      </div>
    </section>
  )
}
