import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ArrowRight, ArrowUp, ArrowUpRight, BadgeCheck, Banknote, Check, LoaderCircle, RotateCcw, Sparkle, Truck } from 'lucide-react'
import { subscribeNewsletter } from '../lib/api'
import { HANDLE, PROFILE_URL } from '../data/instagram'
import { marquee } from '../data/marquee'

import logoLight from '../assets/logo/logoLight.webp'
import panel from '../assets/ShopByCategory/panel-tshirts.webp'
import tag from '../assets/featuredDrop/limited-tag.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'
import brushL from '../assets/hero/tshirts/brush-left.webp'
import brushR from '../assets/featuredDrop/brush-right.webp'
import buildingL from '../assets/featuredDrop/building-left.webp'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const YEAR = new Date().getFullYear()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const columns = [
  {
    title: 'Shop',
    links: [
      { label: 'Shop All', href: '/shop' },
      { label: 'T-Shirts', href: '/shop/t-shirts' },
      { label: 'Hoodies', href: '/shop/hoodies' },
      { label: 'Bottoms', href: '/shop/bottoms' },
      { label: 'Accessories', href: '/shop/accessories' },
      { label: 'Best Sellers', href: '/shop?collection=bestsellers' },
    ],
  },
  {
    title: 'Explore',
    links: [
      { label: 'Our Story', href: '/#about' },
      { label: 'Crew Reviews', href: '/#reviews' },
      { label: 'On Instagram', href: '/#instagram' },
    ],
  },
  {
    title: 'Help',
    wide: true,
    links: [
      { label: 'Shipping & Delivery', href: '#' },
      { label: 'Returns & Exchanges', href: '#' },
      { label: 'Size Guide', href: '#' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'FAQs', href: '#' },
    ],
  },
]

const promises = [
  { icon: Truck, title: 'Free shipping', text: 'On orders above ₹1,499' },
  { icon: Banknote, title: 'COD available', text: 'Pay when it arrives' },
  { icon: RotateCcw, title: 'Easy returns', text: 'Within 7 days' },
]

const perks = ['First look at every new drop', 'Early access to limited runs', 'No spam. Unsubscribe anytime.']

function InstagramGlyph({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
    </svg>
  )
}

function FooterLink({ href, children }) {
  const cls = 'group relative inline-block py-2.5 text-[15px] sm:py-1.5 text-cream/65 transition-colors duration-300 hover:text-white focus-visible:text-white'
  const line = <span aria-hidden className="absolute -bottom-0.5 left-0 h-[2px] w-0 rounded-full bg-amber-300 transition-all duration-300 group-hover:w-full group-focus-visible:w-full" />
  // pages inside the app use the router; placeholder links ('#') shouldn't jump the page to the top
  if (href.startsWith('/')) return <Link to={href} className={cls}>{children}{line}</Link>
  return <a href={href} onClick={href === '#' ? (e) => e.preventDefault() : undefined} className={cls}>{children}{line}</a>
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (status === 'loading') return
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setStatus('error')
      setMessage('Please enter a valid email address.')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      const msg = await subscribeNewsletter(value, new FormData(e.currentTarget).get('website') ?? '')
      setStatus('success')
      setMessage(msg || "You're in! Watch your inbox for the next drop.")
      setEmail('')
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }

  if (status === 'success') {
    return (
      <div role="status" className="flex items-start gap-4 rounded-[22px] bg-cream p-5 text-ink sm:items-center sm:p-6">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-olive text-white"><BadgeCheck size={26} /></span>
        <div className="min-w-0">
          <p className="text-[19px] font-black italic uppercase leading-tight tracking-tight [font-variation-settings:'wdth'_84]">Welcome to the crew</p>
          <p className="mt-1 text-[14px] leading-snug text-ink/70">{message}</p>
          <button type="button" onClick={() => { setStatus('idle'); setMessage('') }} className="mt-2 text-[12px] font-bold uppercase tracking-wide text-olive underline decoration-olive/40 decoration-2 underline-offset-4 transition-colors hover:decoration-olive">
            Use another email
          </button>
        </div>
      </div>
    )
  }

  const invalid = status === 'error'
  return (
    <form onSubmit={submit} noValidate aria-describedby="nl-msg">
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-0 sm:rounded-full sm:bg-cream sm:p-1.5 sm:shadow-[0_18px_30px_-18px_rgba(0,0,0,.6)]">
        <input
          id="nl-email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="Enter your email"
          value={email} onChange={(e) => { setEmail(e.target.value); if (invalid) setStatus('idle') }}
          aria-invalid={invalid} aria-describedby="nl-msg" disabled={status === 'loading'}
          className={`h-14 min-w-0 flex-1 rounded-full bg-cream px-6 text-[16px] font-medium text-ink outline-none placeholder:text-ink/45 disabled:opacity-70 sm:h-12 sm:bg-transparent ${invalid ? 'ring-2 ring-amber-300 sm:ring-0' : ''}`}
        />
        {/* honeypot: hidden from people and screen readers, bots fill it in */}
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>
        <button type="submit" disabled={status === 'loading'}
          className="group inline-flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-full bg-ink px-7 text-[13px] font-bold uppercase tracking-wide text-white transition-colors duration-300 hover:bg-moss disabled:cursor-wait disabled:opacity-80 sm:h-12">
          {status === 'loading' ? (<><LoaderCircle size={18} className="animate-spin" aria-hidden /> Joining…</>) : (<>Subscribe <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden /></>)}
        </button>
      </div>
      <p id="nl-msg" role={invalid ? 'alert' : undefined} className={`mt-3 min-h-[1.4em] px-2 text-[13px] font-semibold ${invalid ? 'text-amber-200' : 'text-transparent'}`}>{invalid ? message : ''}</p>
    </form>
  )
}

function MarqueeGroup({ hidden }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {marquee.map((m) => (
        <li key={m} className="flex items-center whitespace-nowrap">
          <span className="px-[clamp(24px,2.4vw,44px)] text-[clamp(26px,4.2vw,64px)] font-black italic uppercase leading-none tracking-tight text-cream/[0.14] [font-variation-settings:'wdth'_84]">{m}</span>
          <Sparkle aria-hidden className="h-[clamp(14px,1.6vw,26px)] w-[clamp(14px,1.6vw,26px)] fill-amber-300/60 text-amber-300/60" />
        </li>
      ))}
    </ul>
  )
}

export default function Footer({ above = 'moss' }) {
  const root = useRef(null)

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const q = gsap.utils.selector(root)
    const tl = gsap.timeline({ paused: true })
      .from(q('[data-ft=card]'), { autoAlpha: 0, y: 60, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity,visibility' })
      .from(q('[data-ft=tag]'), { autoAlpha: 0, y: -30, rotate: 14, duration: 0.8, ease: 'back.out(1.6)', clearProps: 'opacity,visibility' }, '<0.35')
      .from(q('[data-ft=promise]'), { autoAlpha: 0, y: 24, duration: 0.6, ease: 'power2.out', stagger: 0.1, clearProps: 'transform,opacity,visibility' }, '<0.3')
      .from(q('[data-ft=col]'), { autoAlpha: 0, y: 28, duration: 0.7, ease: 'power2.out', stagger: 0.1, clearProps: 'transform,opacity,visibility' }, '<0.1')
    // The footer sits under pages whose height keeps changing (skeletons, images, route changes), so a scroll
    // position measured once goes stale and the reveal never fires. IntersectionObserver asks the browser where
    // the footer really is, every time, so it can't be missed.
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      tl.play()
    }, { rootMargin: '0px 0px -15% 0px' })
    io.observe(root.current)
    // last resort: never leave the footer hidden
    const safe = gsap.delayedCall(8, () => { if (tl.progress() === 0 && root.current && root.current.getBoundingClientRect().top < window.innerHeight) tl.progress(1) })
    return () => { io.disconnect(); safe.kill() }
  }, { scope: root })

  const toTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })

  return (
    <footer ref={root} id="footer" aria-labelledby="ft-heading" className="relative isolate overflow-hidden bg-ink text-cream">
      {/* newsletter: the card straddles the moss (Instagram) and ink (footer) backgrounds */}
      <div className="relative">
        <div aria-hidden className={`absolute inset-x-0 top-0 h-1/2 ${above === 'cream' ? 'bg-cream' : 'bg-moss'}`} />
        <div className="relative mx-auto w-full max-w-[1680px] px-4 sm:px-8 lg:px-[6vw]">
          <section data-ft="card" aria-label="Newsletter" className="relative isolate overflow-hidden rounded-[26px] bg-olive px-6 pb-9 pt-16 shadow-[0_40px_70px_-34px_rgba(0,0,0,.8)] sm:rounded-[34px] sm:px-10 sm:py-12 lg:px-[4.6vw] lg:py-[3.6vw]">
            <img src={panel} alt="" aria-hidden loading="lazy" decoding="async" className="absolute left-1/2 top-1/2 -z-10 h-[130%] w-[130%] max-w-none -translate-x-1/2 -translate-y-1/2 object-cover" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-olive/60 mix-blend-multiply" />
            <img src={brushL} alt="" aria-hidden loading="lazy" decoding="async" className="pointer-events-none absolute -bottom-10 -left-8 -z-10 w-44 opacity-30 sm:w-60 lg:w-[22vw]" />
            <img src={buildingL} alt="" aria-hidden loading="lazy" decoding="async" className="pointer-events-none absolute bottom-0 right-[30%] -z-10 hidden h-[78%] w-auto opacity-[.16] [filter:grayscale(.4)] xl:block" />
            <img src={brushR} alt="" aria-hidden loading="lazy" decoding="async" className="pointer-events-none absolute -right-6 -top-4 -z-10 h-40 w-auto opacity-25 sm:h-56 lg:h-[19vw]" />

            <img data-ft="tag" src={tag} alt="" aria-hidden width="1539" height="501" loading="lazy" decoding="async" className="pointer-events-none absolute right-4 top-3 w-[150px] rotate-[7deg] select-none drop-shadow-[0_10px_14px_rgba(0,0,0,.35)] sm:right-10 sm:top-2 sm:w-[210px] lg:right-[3.4vw] lg:top-[1.2vw] lg:w-[15vw]" />

            <div className="relative grid items-center gap-9 lg:grid-cols-[1.12fr_1fr] lg:gap-[4vw]">
              <div>
                <p className="inline-flex items-center gap-3 text-[clamp(11px,.9vw,15px)] font-bold uppercase tracking-[0.22em] text-amber-300">
                  <Sparkle size={14} className="fill-amber-300" aria-hidden /> The inner circle
                </p>
                <h2 id="ft-heading" className="mt-3 font-black italic uppercase leading-[0.92] tracking-tight text-[clamp(38px,11.4vw,76px)] lg:text-[5vw]" style={{ fontVariationSettings: '"wdth" 84' }}>
                  Never miss<br />a drop
                </h2>
                <div className="mt-2 inline-block -rotate-2 lg:mt-[0.4vw]">
                  <p className="whitespace-nowrap font-script text-[clamp(24px,7.4vw,40px)] leading-[1.1] text-sand lg:text-[2.3vw]">Join the crew</p>
                  <img src={underline} alt="" aria-hidden loading="lazy" decoding="async" className="mt-1 h-3 w-[92%] object-fill [filter:brightness(1.7)_saturate(.9)] lg:h-[.9vw]" />
                </div>
                <p className="mt-5 max-w-[34rem] text-[clamp(15px,1.1vw,18px)] leading-relaxed text-cream/80">
                  Small runs sell out fast. Get the new drops, restocks and street-ready fits in your inbox before anyone else.
                </p>
              </div>

              <div className="relative">
                <Newsletter />
                <ul className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6">
                  {perks.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-[13px] font-medium text-cream/80">
                      <span aria-hidden className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-cream/90 text-olive"><Check size={11} strokeWidth={3.4} /></span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[1680px] px-5 lg:px-[6vw]">
        {/* soft texture so the black doesn't feel flat */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full overflow-hidden">
          <img src={panel} alt="" loading="lazy" decoding="async" className="absolute -right-[20%] top-0 h-full w-[90%] max-w-none object-fill opacity-[.07] mix-blend-screen" />
        </div>

        {/* promises */}
        <ul className="grid grid-cols-1 gap-4 border-b border-cream/15 py-8 sm:grid-cols-3 sm:gap-6 lg:py-[2.6vw]">
          {promises.map(({ icon: Icon, title, text }) => (
            <li key={title} data-ft="promise" className="flex items-center gap-4">
              <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-cream/25 text-amber-300"><Icon size={22} strokeWidth={1.8} /></span>
              <p className="leading-tight">
                <b className="block text-[15px] font-bold uppercase tracking-wide">{title}</b>
                <span className="text-[14px] text-cream/60">{text}</span>
              </p>
            </li>
          ))}
        </ul>

        {/* brand + link columns */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-10 sm:grid-cols-3 sm:gap-y-12 sm:py-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-[3vw] lg:py-[4vw]">
          <div data-ft="col" className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link to="/" aria-label="Isaa home" className="inline-block"><img src={logoLight} alt="Isaa" width="2113" height="744" loading="lazy" decoding="async" className="h-10 w-auto sm:h-11" /></Link>
            <p className="mt-5 max-w-[22rem] text-[15px] leading-relaxed text-cream/65">
              Oversized streetwear with bold prints. Cut from a different cloth, made in small runs and packed by hand.
            </p>
            <p className="mt-6 -rotate-2 font-script text-[28px] leading-none text-sand">Own the Streets</p>
            <a href={PROFILE_URL} target="_blank" rel="noopener noreferrer" aria-label={`Isaa on Instagram, @${HANDLE}`}
              className="group mt-6 inline-flex items-center gap-3 rounded-full border border-cream/30 py-2.5 pl-4 pr-5 text-[13px] font-bold uppercase tracking-wide transition-colors duration-300 hover:border-cream hover:bg-cream hover:text-ink">
              <InstagramGlyph /> @{HANDLE}
              <ArrowUpRight size={15} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </a>
          </div>

          {columns.map((c) => (
            <nav key={c.title} data-ft="col" aria-label={c.title} className={c.wide ? 'col-span-2 sm:col-span-1' : undefined}>
              <h3 className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.22em] text-amber-300">
                <Sparkle size={11} className="fill-amber-300" aria-hidden /> {c.title}
              </h3>
              <ul className={`mt-3 sm:mt-4 ${c.wide ? 'grid grid-cols-2 gap-x-6 sm:block' : ''}`}>
                {c.links.map((l) => <li key={l.label}><FooterLink href={l.href}>{l.label}</FooterLink></li>)}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {/* slow marquee: reuses the brand lines from the Featured Drop strip */}
      <div aria-hidden className="relative overflow-hidden border-y border-cream/10 py-[clamp(14px,1.6vw,26px)]">
        <div className="flex w-max animate-[marquee_60s_linear_infinite] motion-reduce:animate-none">
          {[0, 1, 2, 3].map((n) => <MarqueeGroup key={n} hidden={n > 0} />)}
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-[1680px] flex-col-reverse items-center gap-6 px-5 py-8 text-[13px] text-cream/55 sm:flex-row sm:justify-between lg:px-[6vw]">
        <p>© {YEAR} Isaa. All rights reserved.</p>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {['Privacy Policy', 'Terms of Service', 'Refund Policy'].map((l) => (
            <li key={l}><a href="#" onClick={(e) => e.preventDefault()} className="transition-colors hover:text-white">{l}</a></li>
          ))}
          <li>
            <button type="button" onClick={toTop} aria-label="Back to top" className="group inline-flex items-center gap-2 rounded-full border border-cream/30 py-2 pl-5 pr-2 text-[12px] font-bold uppercase tracking-wide text-cream transition-colors duration-300 hover:bg-cream hover:text-ink">
              Top <span className="grid h-7 w-7 place-items-center rounded-full bg-olive text-white transition-transform duration-300 group-hover:-translate-y-0.5"><ArrowUp size={14} aria-hidden /></span>
            </button>
          </li>
        </ul>
      </div>
    </footer>
  )
}