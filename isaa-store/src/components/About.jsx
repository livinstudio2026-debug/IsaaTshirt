import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, Banknote, Droplets, Hourglass, RotateCcw, Shirt, Sparkle, Stamp, Truck } from 'lucide-react'
import { about, reasons, promises } from '../data/about'

import portrait from '../assets/about/about-portrait.webp'
import fabric from '../assets/about/about-fabric.webp'
import panel from '../assets/ShopByCategory/panel-tshirts.webp'
import paper from '../assets/ShopByCategory/label-paper.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'
import brushL from '../assets/hero/tshirts/brush-left.webp'
import brushR from '../assets/featuredDrop/brush-right.webp'
import buildingR from '../assets/featuredDrop/building-right.webp'
import buildingL from '../assets/featuredDrop/building-left.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const ICONS = { shirt: Shirt, droplets: Droplets, stamp: Stamp, hourglass: Hourglass, truck: Truck, banknote: Banknote, rotate: RotateCcw }
const calm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const pad = (n) => String(n).padStart(2, '0')

// round "Est. 2025" stamp: text runs round a circle, a sparkle sits in the middle
function Seal() {
  return (
    <div className="relative aspect-square w-full">
      <div className="absolute inset-0 animate-[spin_36s_linear_infinite] motion-reduce:animate-none">
        <svg viewBox="0 0 120 120" className="h-full w-full text-ink" role="img" aria-label="Isaa, established 2025">
          <defs><path id="about-seal-ring" d="M60,60 m-43,0 a43,43 0 1,1 86,0 a43,43 0 1,1 -86,0" /></defs>
          <circle cx="60" cy="60" r="58" className="fill-cream" />
          <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 3" opacity=".45" />
          <text fontSize="9.4" fontWeight="800" letterSpacing="1.5" fill="currentColor" style={{ fontFamily: 'Archivo, sans-serif' }}>
            <textPath href="#about-seal-ring" textLength="266" lengthAdjust="spacing">ISAA ✦ EST. 2025 ✦ WEAR THE VIBE ✦</textPath>
          </text>
        </svg>
      </div>
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid h-[44%] w-[44%] place-items-center rounded-full bg-olive text-white"><Sparkle className="h-[46%] w-[46%] fill-white" /></span>
      </div>
    </div>
  )
}

export default function About() {
  const root = useRef(null)

  useGSAP(() => {
    if (calm()) return
    const q = (s) => root.current.querySelector(s)
    const qa = (s) => root.current.querySelectorAll(s)

    // ---- About: once, when it scrolls into view ----
    gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: q('[data-ab=story]'), start: 'top 72%', once: true } })
      .from(qa('[data-ab=decor]'), { autoAlpha: 0, duration: 1.6, stagger: 0.12 }, 0)
      .from(q('[data-ab=panel]'), { autoAlpha: 0, xPercent: -6, rotate: -8, duration: 1.1 }, 0.05)
      .fromTo(q('[data-ab=photo]'), { clipPath: 'inset(100% 0 0 0 round 28px)' }, { clipPath: 'inset(0% 0 0 0 round 28px)', duration: 1.2, ease: 'power3.inOut', clearProps: 'clipPath' }, 0.15)
      .from(q('[data-ab=photo] img'), { scale: 1.18, duration: 1.6 }, 0.15)
      .from(q('[data-ab=fabric]'), { autoAlpha: 0, y: 50, rotate: 12, duration: 1, clearProps: 'transform,opacity,visibility' }, 0.9)
      .from(q('[data-ab=strip]'), { autoAlpha: 0, x: -30, duration: 0.9, clearProps: 'transform,opacity,visibility' }, 1.1)
      .from(q('[data-ab=seal]'), { autoAlpha: 0, scale: 0.4, rotate: -90, duration: 1, ease: 'back.out(1.6)', clearProps: 'transform,opacity,visibility' }, 1.2)
      .from(q('[data-ab=eyebrow]'), { autoAlpha: 0, y: 14, duration: 0.7 }, 0.2)
      .from(qa('[data-ab=line]'), { yPercent: 115, duration: 0.95, ease: 'power4.out', stagger: 0.12 }, 0.3)
      .fromTo(q('[data-ab=script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -14 }, { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 0.75)
      .fromTo(q('[data-ab=underline]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 -2% 0 0)', clearProps: 'clipPath', duration: 0.8, ease: 'power2.inOut' }, 1)
      .from(qa('[data-ab=copy]'), { autoAlpha: 0, y: 24, duration: 0.8, stagger: 0.12, clearProps: 'transform,opacity,visibility' }, 0.9)
      .from(qa('[data-ab=chip]'), { autoAlpha: 0, y: 14, scale: 0.92, duration: 0.6, stagger: 0.08, clearProps: 'transform,opacity,visibility' }, 1.25)

    // ---- Why Isaa ----
    gsap.timeline({ defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: q('[data-ab=why]'), start: 'top 78%', once: true } })
      .from(q('[data-ab=why-eyebrow]'), { autoAlpha: 0, y: 14, duration: 0.7 }, 0)
      .from(qa('[data-ab=why-line]'), { yPercent: 115, duration: 0.95, ease: 'power4.out' }, 0.1)
      .fromTo(q('[data-ab=why-script]'), { clipPath: 'inset(-30% 100% -30% 0%)', x: -14 }, { clipPath: 'inset(-30% -5% -30% 0%)', x: 0, clearProps: 'clipPath', duration: 0.9, ease: 'power2.inOut' }, 0.5)
      .from(qa('[data-ab=card]'), { autoAlpha: 0, y: 60, rotate: (i) => (i % 2 ? 2 : -2), duration: 0.85, stagger: 0.1, clearProps: 'transform,opacity,visibility' }, 0.45)
      .from(qa('[data-ab=promise]'), { autoAlpha: 0, y: 18, duration: 0.7, stagger: 0.1, clearProps: 'transform,opacity,visibility' }, 1)

    // ---- desktop: the small fabric shot and the backdrop drift at different speeds ----
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const st = { trigger: q('[data-ab=story]'), start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      gsap.fromTo(q('[data-ab=fabric-drift]'), { y: 34 }, { y: -34, ease: 'none', scrollTrigger: st })
      gsap.fromTo(q('[data-ab=drift-a]'), { y: 50 }, { y: -50, ease: 'none', scrollTrigger: st })
    })
    return () => mm.revert()
  }, { scope: root })

  return (
    <div ref={root}>
      {/* ================= ABOUT ================= */}
      <section id="about" aria-labelledby="about-heading" className="relative isolate scroll-mt-[114px] overflow-hidden bg-sand/40 py-[16vw] sm:py-[10vw] lg:py-[6.4vw]">
        {/* backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <img data-ab="decor" src={buildingR} alt="" loading="lazy" decoding="async" className="absolute -right-[2%] top-0 hidden h-[70%] w-auto opacity-60 lg:block" />
          <img data-ab="decor" src={buildingL} alt="" loading="lazy" decoding="async" className="absolute -left-[3%] bottom-0 h-[34%] w-auto opacity-40 sm:h-[44%] lg:h-[52%]" />
          <div data-ab="drift-a" className="absolute -right-[4%] bottom-[2%] h-[26%] sm:h-[34%]"><img data-ab="decor" src={brushR} alt="" loading="lazy" decoding="async" className="h-full w-auto opacity-60" /></div>
        </div>

        <div data-ab="story" className="relative mx-auto grid w-full max-w-[1680px] items-center gap-[18vw] px-5 sm:gap-[12vw] lg:grid-cols-12 lg:gap-[3vw] lg:px-[6vw]">
          {/* ---- collage ---- */}
          <div className="relative mx-auto w-[84%] max-w-[560px] sm:w-[64%] lg:col-span-5 lg:w-full lg:max-w-none">
            <img data-ab="panel" src={panel} alt="" aria-hidden loading="lazy" decoding="async" className="absolute inset-0 -z-10 h-full w-full translate-x-[7%] translate-y-[4%] rotate-[4deg] object-fill opacity-95" />

            <div data-ab="photo" className="relative aspect-[4/5] -rotate-[1.5deg] overflow-hidden rounded-[28px] border-[6px] border-cream shadow-[0_34px_50px_-26px_rgba(70,45,15,.6)]">
              <img src={portrait} alt="A young man in a brown garment-washed oversized Isaa tee with the Isaa Est. 2025 print, standing in front of a cream stone building" width="1122" height="1402" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
            </div>

            {/* fabric detail */}
            <div data-ab="fabric-drift" className="absolute -bottom-[9%] -right-[9%] w-[44%] max-w-[250px]">
              <div data-ab="fabric" className="rotate-[5deg] overflow-hidden rounded-[18px] border-[5px] border-cream shadow-[0_22px_34px_-18px_rgba(70,45,15,.6)]">
                <img src={fabric} alt="Close-up of the cracked, vintage screen print and washed cotton texture" width="1254" height="1254" loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
              </div>
            </div>

            {/* paper strip: the text is sized from the strip's own width, so it stays readable at every breakpoint */}
            <div data-ab="strip" className="@container absolute -left-[6%] bottom-[7%] w-[56%] max-w-[300px] -rotate-[4deg] drop-shadow-[0_8px_8px_rgba(70,45,15,.25)]">
              <img src={paper} alt="" aria-hidden loading="lazy" decoding="async" className="block w-full" />
              <span className="absolute inset-0 flex items-center justify-center gap-[3cqw] pb-[1cqw] text-[7.4cqw] font-black italic uppercase leading-none tracking-tight text-ink">
                <Sparkle className="h-[7cqw] w-[7cqw] shrink-0 fill-olive text-olive" aria-hidden />{about.stripLabel}
              </span>
            </div>

            {/* est. stamp */}
            <div data-ab="seal" className="absolute -right-[5%] -top-[7%] w-[25%] max-w-[130px] drop-shadow-[0_10px_10px_rgba(70,45,15,.25)]"><Seal /></div>
          </div>

          {/* ---- story ---- */}
          <div className="lg:col-span-7 lg:pl-[3vw]">
            <p data-ab="eyebrow" className="flex items-center gap-4 text-[clamp(11px,.9vw,17px)] font-bold uppercase tracking-[0.22em]">
              <span className="h-px w-10 bg-ink/30 lg:w-[4vw]" />
              <span>{about.eyebrow} <span className="mx-1 text-olive">/</span> <span className="text-olive">Est. 2025</span></span>
            </p>

            <h2 id="about-heading" className="mt-[3vw] font-black italic uppercase leading-[0.9] tracking-tight text-[13vw] sm:mt-[1.6vw] sm:text-[9vw] lg:mt-[1vw] lg:text-[6vw]" style={{ fontVariationSettings: '"wdth" 84' }}>
              {about.titleLines.map((l) => (
                <span key={l} className="-mx-[0.12em] -my-[0.05em] block overflow-hidden px-[0.12em] py-[0.05em]"><span data-ab="line" className="block">{l}</span></span>
              ))}
            </h2>

            <div className="mt-[1vw] inline-block -rotate-2 lg:mt-[0.2vw]">
              <p data-ab="script" className="whitespace-nowrap font-script text-[9.5vw] leading-[1.1] text-olive sm:text-[6.4vw] lg:text-[3.4vw]">{about.script}</p>
              <div aria-hidden className="mt-[0.8vw] flex lg:mt-[0.3vw]"><img data-ab="underline" src={underline} alt="" loading="lazy" decoding="async" className="h-[2.4vw] w-[92%] object-fill lg:h-[1.1vw]" /></div>
            </div>

            <div className="mt-7 max-w-[58ch] space-y-4 text-[clamp(15px,1.15vw,20px)] leading-relaxed text-ink/70 lg:mt-[2vw]">
              {about.paragraphs.map((t) => <p key={t} data-ab="copy">{t}</p>)}
            </div>

            <ul className="mt-7 flex flex-wrap gap-2.5 lg:mt-[2vw]">
              {about.chips.map((c) => (
                <li key={c} data-ab="chip" className="inline-flex items-center gap-2 rounded-full border border-ink/80 bg-cream px-4 py-2 text-[11px] font-bold uppercase tracking-wide sm:text-xs">
                  <Sparkle size={12} className="shrink-0 fill-olive text-olive" />{c}
                </li>
              ))}
            </ul>

            <a data-ab="copy" href="#best-sellers" className="group mt-8 inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive lg:mt-[2.4vw]">
              Shop the drop <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
            </a>
          </div>
        </div>
      </section>

      {/* ================= WHY ISAA ================= */}
      <section data-ab="why" aria-labelledby="why-heading" className="relative isolate overflow-hidden bg-ink text-white py-[14vw] sm:py-[9vw] lg:py-[5.6vw]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-[10%] -top-[30%] h-[80%] w-[50%] rounded-full bg-olive/25 blur-[110px]" />
          <div className="absolute -bottom-[30%] -right-[10%] h-[70%] w-[45%] rounded-full bg-sand/10 blur-[120px]" />
          <img src={brushL} alt="" loading="lazy" decoding="async" className="absolute -left-[3%] bottom-[4%] hidden w-[14%] opacity-[0.07] invert lg:block" />
        </div>

        <div className="relative mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
          <header className="flex flex-col items-center text-center">
            <p data-ab="why-eyebrow" className="inline-flex items-center gap-3 text-[clamp(11px,.9vw,17px)] font-bold uppercase tracking-[0.22em] text-white/70">
              <Sparkle size={13} className="fill-amber-300 text-amber-300" /> The Isaa difference <Sparkle size={13} className="fill-amber-300 text-amber-300" />
            </p>
            <h2 id="why-heading" className="mt-[3vw] font-black italic uppercase leading-[0.9] tracking-tight text-[14vw] sm:mt-[1.6vw] sm:text-[10vw] lg:mt-[1vw] lg:text-[6.4vw]" style={{ fontVariationSettings: '"wdth" 84' }}>
              <span className="-mx-[0.12em] -my-[0.05em] block overflow-hidden px-[0.12em] py-[0.05em]"><span data-ab="why-line" className="block">Why Isaa</span></span>
            </h2>
            <p data-ab="why-script" className="mt-[1vw] -rotate-2 whitespace-nowrap font-script text-[9vw] leading-[1.1] text-sand sm:text-[6vw] lg:mt-0 lg:text-[3.2vw]">Made to stand out</p>
          </header>

          <ul className="mt-10 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 sm:gap-4 lg:mt-[3.4vw] lg:grid-cols-4 lg:gap-5">
            {reasons.map((r, i) => {
              const Icon = ICONS[r.icon]
              return (
                <li key={r.title} data-ab="card" className="flex">
                  <article className="group relative flex w-full flex-col overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] p-6 transition-[transform,background-color,border-color] duration-500 ease-out hover:-translate-y-1.5 hover:border-white/25 hover:bg-white/[0.08] sm:rounded-[28px] lg:p-7">
                    <span aria-hidden className="pointer-events-none absolute -right-2 -top-4 select-none text-[110px] font-black italic leading-none tracking-tighter text-white/[0.05] [font-stretch:125%]">{pad(i + 1)}</span>
                    <span className="relative grid h-14 w-14 place-items-center rounded-full bg-cream text-ink transition-colors duration-300 group-hover:bg-olive group-hover:text-white">
                      <Icon size={24} strokeWidth={1.9} />
                    </span>
                    <h3 className="relative mt-6 text-[clamp(20px,1.7vw,28px)] font-black italic uppercase leading-[0.98] tracking-tight [font-stretch:112%] text-balance">{r.title}</h3>
                    <p className="relative mt-3 text-[15px] leading-relaxed text-white/65">{r.text}</p>
                  </article>
                </li>
              )
            })}
          </ul>

          <ul className="mt-8 grid list-none grid-cols-1 gap-5 border-t border-white/10 p-0 pt-8 sm:grid-cols-3 lg:mt-[2.8vw] lg:pt-[2.2vw]">
            {promises.map((p) => {
              const Icon = ICONS[p.icon]
              return (
                <li key={p.label} data-ab="promise" className="flex items-center justify-start gap-4 lg:justify-center">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 text-amber-300"><Icon size={20} strokeWidth={1.9} /></span>
                  <p className="leading-tight"><b className="block text-[13px] font-bold uppercase tracking-wide">{p.label}</b><span className="text-[13px] text-white/60">{p.note}</span></p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
