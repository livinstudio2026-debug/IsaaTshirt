import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useCart } from '../lib/cartContext'
import { useWishlist } from '../lib/wishlistContext'
import SearchOverlay from './SearchOverlay'
import { Search, PackageSearch, ShoppingBag, Heart, Menu, X, Sparkle, ArrowUpRight, ArrowRight } from 'lucide-react'
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
    <div className="relative z-10 bg-ink text-white text-[13px] font-semibold h-10 flex items-center justify-center gap-4 sm:gap-8 px-4"
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

const links = [
  { label: 'Home', to: '/' },
  { label: 'T-Shirts', to: '/shop/t-shirts' },
  { label: 'Hoodies', to: '/shop/hoodies' },
  { label: 'Bottoms', to: '/shop/bottoms' },
  { label: 'Accessories', to: '/shop/accessories' },
  { label: 'Contact', to: '/contact' },
]

export default function Navbar() {
  const { count: cartCount, openCart } = useCart()
  const { count: wishCount } = useWishlist()
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const searchBtn = useRef(null)
  const openSearch = () => { setOpen(false); setSearching(true) }
  const closeSearch = () => { setSearching(false); requestAnimationFrame(() => searchBtn.current?.focus({ preventScroll: true })) }
  const { pathname } = useLocation()
  // the highlighted link follows the URL
  const isActive = (l) => pathname === l.to

  // lock page scroll while the menu is open; close on Esc or when resized to desktop.
  // NOTE: lock <html>, not <body>. index.css sets overflow-x: clip on html, so html no longer
  // propagates its overflow to the viewport -> body overflow:hidden would turn <body> into the
  // sticky header's scroll container and the header (with the menu) would scroll out of view.
  // "/" opens the search from anywhere (unless you're typing in a field)
  useEffect(() => {
    const onSlash = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault(); setOpen(false); setSearching(true)
    }
    window.addEventListener('keydown', onSlash)
    return () => window.removeEventListener('keydown', onSlash)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.style.overflow = open ? 'hidden' : ''
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onResize = () => window.innerWidth >= 1024 && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      root.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <header className="sticky top-0 z-50">
      <AnnouncementBar />

      <nav className="bg-cream/95 backdrop-blur border-b border-sand h-[74px] px-5 lg:px-[6vw] flex items-center justify-between relative z-10">
        <Link to="/" aria-label="Isaa home" onClick={() => setOpen(false)}><img src={logo} alt="Isaa" className="h-9 w-auto" /></Link>
        <ul className="hidden lg:flex whitespace-nowrap absolute left-1/2 -translate-x-1/2 gap-[2.2vw] text-[13px] xl:text-[14px] font-medium tracking-wide uppercase">
          {links.map((l) => (
            <li key={l.label}>
              <Link to={l.to} aria-current={isActive(l) ? 'page' : undefined}
                className={`relative py-2 transition-colors hover:text-olive after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:bg-ink after:transition-all ${isActive(l) ? 'after:w-full' : 'after:w-0'}`}>{l.label}</Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3.5 sm:gap-5">
          <button ref={searchBtn} type="button" aria-label="Search" aria-haspopup="dialog" title="Search ( / )" onClick={openSearch}><Search size={22} /></button>
          <Link to="/track" aria-label="Track your order" title="Track your order" className="hidden sm:block"><PackageSearch size={22} /></Link>
          <Link to="/wishlist" aria-label={`Wishlist, ${wishCount} ${wishCount === 1 ? 'piece' : 'pieces'} saved`} title="Your wishlist" className="relative">
            <Heart size={22} className={wishCount > 0 ? 'fill-olive text-olive' : ''} />
            {wishCount > 0 && <span key={wishCount} aria-hidden className="absolute -top-2 -right-2.5 grid h-[18px] min-w-[18px] animate-[pop_.45s_ease-out] place-items-center rounded-full bg-olive px-1 text-[10px] font-bold text-white motion-reduce:animate-none">{wishCount}</span>}
          </Link>
          <button aria-label={`Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`} data-cart-btn onClick={openCart} className="relative">
            <ShoppingBag size={22} />
            <span key={cartCount} aria-hidden className="absolute -top-2 -right-2.5 bg-ink text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full grid place-items-center animate-[pop_.45s_ease-out] motion-reduce:animate-none">{cartCount}</span>
          </button>
          <button aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} className="lg:hidden w-10 h-10 -mr-2 grid place-items-center rounded-full transition-colors hover:bg-sand/60" onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

      </nav>

      {/* mobile menu: full-screen panel. Lives outside <nav> because backdrop-filter on <nav> would
          make it the containing block for fixed children and shrink the panel to the nav's height. */}
      <div aria-hidden={!open} onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        className={`lg:hidden fixed inset-x-0 top-0 z-0 h-screen h-dvh bg-cream transition-[clip-path,visibility] duration-500 ease-[cubic-bezier(.7,0,.2,1)] ${open ? 'visible [clip-path:inset(0_0_0_0)]' : 'invisible [clip-path:inset(0_0_100%_0)]'}`}>
        {/* pt clears the announcement bar (40px) + nav (74px) that stay on top */}
        <div className="h-full overflow-y-auto overscroll-contain pt-[114px]">
          <div className="relative min-h-full flex flex-col px-6 pt-3 pb-8">
            <img src="/squiggle.svg" alt="" className="absolute right-4 bottom-4 w-24 opacity-25 pointer-events-none" />
            <ul className="relative">
              {links.map((l, i) => (
                <li key={l.label} className="border-b border-sand">
                  <Link to={l.to} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} aria-current={isActive(l) ? 'page' : undefined}
                    style={{ transitionDelay: open ? `${120 + i * 55}ms` : '0ms', fontVariationSettings: '"wdth" 75' }}
                    className={`group flex items-center justify-between py-3.5 font-black italic uppercase text-[34px] leading-none tracking-tight transition-all duration-500 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${isActive(l) ? 'text-olive' : 'text-ink'}`}>
                    <span className="flex items-center gap-3">
                      <span className={`h-2.5 rounded-full bg-olive transition-all ${isActive(l) ? 'w-2.5' : 'w-0 group-active:w-2.5'}`} />
                      {l.label}
                    </span>
                    <ArrowUpRight size={24} strokeWidth={2.2} className={isActive(l) ? 'text-olive' : 'text-ink/35'} />
                  </Link>
                </li>
              ))}
            </ul>

            {/* mt-auto pins the CTA block to the bottom of the screen */}
            <div className={`relative mt-auto pt-8 transition-all duration-500 ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} style={{ transitionDelay: open ? '480ms' : '0ms' }}>
              <Link to="/shop" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="flex items-center justify-center gap-3 bg-ink text-white font-bold text-sm uppercase tracking-wide py-4 rounded-full active:bg-olive transition-colors">
                Shop the Drop <ArrowRight size={18} />
              </Link>
              <p className="font-script text-olive text-[28px] leading-none mt-5 -rotate-2 origin-left">Own the Streets</p>
              <p className="text-[13px] text-ink/55 mt-2">Free shipping above ₹1,499. COD available.</p>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
                <Link to="/wishlist" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide underline-offset-4 hover:underline"><Heart size={16} /> Wishlist{wishCount > 0 && ` (${wishCount})`}</Link>
                <Link to="/track" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide underline-offset-4 hover:underline"><PackageSearch size={16} /> Track your order</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      {searching && <SearchOverlay onClose={closeSearch} />}
    </header>
  )
}
