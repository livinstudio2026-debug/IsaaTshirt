import { useState, useEffect } from 'react'
import { Search, User, ShoppingBag, Menu, X, Sparkle, ArrowUpRight, ArrowRight } from 'lucide-react'
import logo from '../assets/logo/logo.webp'

const messages = [
  'Free Shipping on orders above ₹1,499',
  'COD Available',
  'Easy Returns within 7 Days',
]

// one message at a time; the current one slides up and out while the next slides in from below
function AnnouncementBar() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (paused) return
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 3500)
    return () => clearInterval(t)
  }, [paused])
  const prev = (i + messages.length - 1) % messages.length
  return (
    <div className="bg-ink text-white text-[13px] font-semibold h-10 flex items-center justify-center gap-4 sm:gap-8 px-4"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <Sparkle size={14} className="text-amber-300 fill-amber-300 shrink-0" />
      <div className="relative h-full w-[min(78vw,340px)] overflow-hidden">
        {messages.map((m, n) => (
          <p key={m} aria-hidden={n !== i}
            className={`absolute inset-0 flex items-center justify-center text-center whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(.7,0,.2,1)] motion-reduce:transition-none ${
              n === i ? 'translate-y-0 opacity-100' : n === prev ? '-translate-y-full opacity-0' : 'translate-y-full opacity-0'}`}>
            {m}
          </p>
        ))}
      </div>
      <Sparkle size={14} className="text-amber-300 fill-amber-300 shrink-0" />
    </div>
  )
}

const links = ['Home', 'T-Shirts', 'Hoodies', 'Bottoms', 'Accessories', 'About']

export default function Navbar({ cartCount = 0 }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('Home')

  // lock page scroll while the menu is open; close on Esc or when resized to desktop
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onResize = () => window.innerWidth >= 1024 && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  const pick = (e, l) => { e.preventDefault(); setActive(l); setOpen(false) }

  return (
    <header className="sticky top-0 z-50">
      <AnnouncementBar />

      <nav className="bg-cream/95 backdrop-blur border-b border-sand h-[74px] px-5 lg:px-[6vw] flex items-center justify-between relative">
        <a href="/" aria-label="Isaa home"><img src={logo} alt="Isaa" className="h-9 w-auto" /></a>
        <ul className="hidden lg:flex whitespace-nowrap absolute left-1/2 -translate-x-1/2 gap-[2.2vw] text-[13px] xl:text-[14px] font-medium tracking-wide uppercase">
          {links.map((l) => (
            <li key={l}>
              <a href="#" onClick={(e) => { e.preventDefault(); setActive(l) }}
                className={`relative py-2 transition-colors hover:text-olive after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:bg-ink after:transition-all ${active === l ? 'after:w-full' : 'after:w-0'}`}>{l}</a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 sm:gap-5">
          <button aria-label="Search"><Search size={22} /></button>
          <button aria-label="Account" className="hidden sm:block"><User size={22} /></button>
          <button aria-label="Cart" className="relative">
            <ShoppingBag size={22} />
            <span className="absolute -top-2 -right-2.5 bg-ink text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full grid place-items-center">{cartCount}</span>
          </button>
          <button aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} className="lg:hidden w-10 h-10 -mr-2 grid place-items-center rounded-full transition-colors hover:bg-sand/60" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* mobile menu */}
        <div className={`lg:hidden fixed inset-0 top-0 -z-10 bg-ink/45 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setOpen(false)} />
        <div className={`lg:hidden absolute left-0 right-0 top-full grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(.7,0,.2,1)] ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} aria-hidden={!open}>
          <div className="overflow-hidden">
            <div className="relative bg-cream border-b border-sand px-6 pt-3 pb-7 max-h-[calc(100svh-114px)] overflow-y-auto">
              <img src="/squiggle.svg" alt="" className="absolute right-4 bottom-4 w-24 opacity-25 pointer-events-none" />
              <ul className="relative">
                {links.map((l, i) => (
                  <li key={l} className="border-b border-sand">
                    <a href="#" onClick={(e) => pick(e, l)} tabIndex={open ? 0 : -1}
                      style={{ transitionDelay: open ? `${120 + i * 55}ms` : '0ms', fontVariationSettings: '"wdth" 75' }}
                      className={`group flex items-center justify-between py-3.5 font-black italic uppercase text-[34px] leading-none tracking-tight transition-all duration-500 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${active === l ? 'text-olive' : 'text-ink'}`}>
                      <span className="flex items-center gap-3">
                        <span className={`h-2.5 rounded-full bg-olive transition-all ${active === l ? 'w-2.5' : 'w-0 group-active:w-2.5'}`} />
                        {l}
                      </span>
                      <ArrowUpRight size={24} strokeWidth={2.2} className={active === l ? 'text-olive' : 'text-ink/35'} />
                    </a>
                  </li>
                ))}
              </ul>

              <div className={`relative mt-6 transition-all duration-500 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: open ? '480ms' : '0ms' }}>
                <a href="#" onClick={(e) => pick(e, 'Home')} tabIndex={open ? 0 : -1} className="flex items-center justify-center gap-3 bg-ink text-white font-bold text-sm uppercase tracking-wide py-4 rounded-full active:bg-olive transition-colors">
                  Shop the Drop <ArrowRight size={18} />
                </a>
                <p className="font-script text-olive text-[28px] leading-none mt-5 -rotate-2 origin-left">Own the Streets</p>
                <p className="text-[13px] text-ink/55 mt-2">Free shipping above ₹1,499. COD available.</p>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  )
}
