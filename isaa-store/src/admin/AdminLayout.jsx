import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, ExternalLink, Film, Inbox, LayoutDashboard, LoaderCircle, LogOut, MoreHorizontal, Package, Ruler, Shirt, SlidersHorizontal, UserRound, Users } from 'lucide-react'
import { useAdminAuth } from '../lib/adminAuthContext'
import { useInboxUnread } from './useInboxUnread'
import { Dialog } from './orders/shared'
import logo from '../assets/logo/logo.webp'

// The back office sections. `badge` sections show a count of things waiting (the unread messages on Inbox).
// `primary` ones sit in the phone's bottom bar; the rest live under "More" there. `owner` ones only the owner sees.
// `not` stops a section lighting up for a screen that has its own entry (Products is a prefix of Size charts' address).
const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, primary: true },
  { to: '/admin/orders', label: 'Orders', icon: Package, primary: true },
  { to: '/admin/products', label: 'Products', icon: Shirt, primary: true, not: '/admin/products/size-charts' },
  { to: '/admin/inbox', label: 'Inbox', icon: Inbox, badge: true, primary: true },
  { to: '/admin/products/size-charts', label: 'Size charts', icon: Ruler, hint: 'Fit tables shared by products' },
  { to: '/admin/reels', label: 'Reels', icon: Film, hint: 'Home-page Instagram wall' },
  { to: '/admin/settings', label: 'Settings', icon: SlidersHorizontal, owner: true, hint: 'Shipping and COD rules' },
  { to: '/admin/team', label: 'Team', icon: Users, owner: true, hint: 'Staff accounts and passwords' },
]

// "3 unread": the number is for eyes, the words for screen readers.
function Count({ n, floating = false }) {
  return (
    <span className={`grid min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-black leading-5 tabular-nums text-ink ${floating ? 'absolute -right-0.5 -top-1.5 ring-2 ring-cream' : 'ml-0.5'}`}>
      {n > 99 ? '99+' : n}<span className="sr-only"> unread</span>
    </span>
  )
}

const pill = 'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold uppercase tracking-wide transition-colors'
const pillOn = 'bg-ink text-white'
const pillOff = 'text-ink/70 hover:bg-sand/60 hover:text-ink'

// Desktop and tablet: the everyday sections sit in the bar; the rest (and "View store") live in one tidy menu, so the bar never overflows.
// When one of them is open, the button takes its name and icon so you still see where you are.
function MoreMenu({ items, pathname }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const button = useRef(null)
  const current = items.find((n) => pathname.startsWith(n.to))
  const Icon = current?.icon ?? MoreHorizontal

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={wrap} className="relative">
      <button ref={button} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title={current?.label ?? 'More'}
        className={`${pill} ${current ? pillOn : open ? 'bg-sand/60 text-ink' : pillOff} xl:px-4`}>
        <Icon size={16} aria-hidden />
        <span className={current ? '' : 'sr-only xl:not-sr-only'}>{current?.label ?? 'More'}</span>
        <ChevronDown size={14} aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" aria-label="More sections" className="absolute left-0 top-[calc(100%+0.6rem)] z-40 w-[20rem] max-w-[calc(100vw-2rem)] animate-[rise_.2s_ease-out_both] rounded-[22px] border border-sand bg-cream p-2 shadow-[0_24px_50px_-18px_rgba(0,0,0,.35)] motion-reduce:animate-none">
          {items.map(({ to, label, icon: ItemIcon, hint }) => {
            const on = pathname.startsWith(to)
            return (
              <Link key={label} to={to} role="menuitem" onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${on ? 'bg-ink text-white' : 'hover:bg-sand/60'}`}>
                <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full ${on ? 'bg-white/15' : 'bg-olive/12 text-olive'}`}><ItemIcon size={17} /></span>
                <span className="min-w-0"><span className="block text-[13.5px] font-bold uppercase tracking-wide">{label}</span>{hint && <span className={`block truncate text-[12.5px] ${on ? 'text-white/70' : 'text-ink/55'}`}>{hint}</span>}</span>
              </Link>
            )
          })}
          <div className="my-1.5 border-t border-sand" />
          <Link to="/" target="_blank" rel="noopener" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-sand/60">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-sand/70 text-ink/70"><ExternalLink size={16} /></span>
            <span className="text-[13.5px] font-bold uppercase tracking-wide">View store</span>
          </Link>
        </div>
      )}
    </div>
  )
}

const moreLink = 'flex items-center gap-3 rounded-2xl border border-sand bg-white/70 px-4 py-3.5 text-[15px] font-bold transition-colors hover:border-ink/40'

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth()
  const unread = useInboxUnread()
  const { pathname } = useLocation()
  const [leaving, setLeaving] = useState(false)
  const [more, setMore] = useState(false)
  const signOut = async () => { setLeaving(true); await logout() }
  const initial = (admin.name || admin.email).trim()[0]?.toUpperCase()
  const items = NAV.filter((n) => !n.owner || admin.role === 'owner')
  const primary = items.filter((n) => n.primary)
  const secondary = items.filter((n) => !n.primary)
  const inMore = secondary.some((n) => pathname.startsWith(n.to)) || pathname.startsWith('/admin/account')

  return (
    <div className="min-h-svh bg-[#f6ecdc]">
      <header className="sticky top-0 z-30 border-b border-sand bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:gap-4 lg:px-8">
          <Link to="/admin" aria-label="Back office home" className="flex shrink-0 items-center gap-3">
            <img src={logo} alt="Isaa" width="2114" height="744" className="h-7 w-auto sm:h-8" />
            <span className="hidden rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white sm:inline md:hidden xl:inline">Back office</span>
          </Link>

          <nav aria-label="Back office" className="hidden min-w-0 flex-1 items-center gap-0.5 md:flex md:pl-1 xl:gap-1 xl:pl-2">
            {primary.map(({ to, label, icon: Icon, end, badge, not }) => (
              <NavLink key={label} to={to} end={end} title={label} className={({ isActive }) => `${pill} xl:px-4 ${isActive && !(not && pathname.startsWith(not)) ? pillOn : pillOff}`}>
                {({ isActive }) => { const on = isActive && !(not && pathname.startsWith(not)); return (<>
                <Icon size={16} aria-hidden /><span className={on ? '' : 'sr-only xl:not-sr-only'}>{label}</span>
                {badge && unread > 0 && <Count n={unread} />}
                </>) }}
              </NavLink>
            ))}
            {secondary.length > 0 && <MoreMenu items={secondary} pathname={pathname} />}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NavLink to="/admin/account" aria-label="Your account" title="Your account" className={({ isActive }) => `flex items-center gap-2.5 rounded-full border bg-white/70 py-1 pl-1 pr-1 transition-colors hover:border-ink/40 sm:pr-3 md:pr-1 lg:pr-3 ${isActive ? 'border-ink' : 'border-sand'}`}>
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-olive text-[13px] font-black text-white">{initial}</span>
              <span className="hidden leading-tight sm:block md:hidden lg:block">
                <span className="block max-w-[10rem] truncate text-[13px] font-bold">{admin.name}</span>
                <span className="block text-[11px] capitalize text-ink/50">{admin.role}</span>
              </span>
            </NavLink>
            <button type="button" onClick={signOut} disabled={leaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-ink px-4 md:w-10 md:px-0 xl:w-auto xl:px-4 text-[12px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white disabled:opacity-60">
              {leaving ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <LogOut size={15} aria-hidden />}
              <span className="sr-only sm:not-sr-only md:sr-only xl:not-sr-only">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-8 pb-28 sm:px-6 sm:py-10 md:pb-10 lg:px-8"><Outlet /></main>

      {/* phones: the main sections live in a bar at the thumb; the rest are under More */}
      <nav aria-label="Back office sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-sand bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {primary.map(({ to, label, icon: Icon, end, badge, not }) => (
            <li key={label}>
              <NavLink to={to} end={end} className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-wide transition-colors ${isActive && !(not && pathname.startsWith(not)) ? 'text-ink' : 'text-ink/55'}`}>
                {({ isActive: active }) => { const isActive = active && !(not && pathname.startsWith(not)); return (<><span className={`relative grid h-7 w-12 place-items-center rounded-full transition-colors ${isActive ? 'bg-ink text-white' : ''}`}><Icon size={18} aria-hidden />{badge && unread > 0 && <Count n={unread} floating />}</span>{label}</>) }}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-wide transition-colors ${inMore ? 'text-ink' : 'text-ink/55'}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${inMore ? 'bg-ink text-white' : ''}`}><MoreHorizontal size={18} aria-hidden /></span>More
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={more} onClose={() => setMore(false)} title="More">
        <h2 className="text-[26px] font-black uppercase italic leading-none tracking-tight">More</h2>
        <ul className="mt-5 space-y-2.5">
          {secondary.map(({ to, label, icon: Icon }) => (
            <li key={label}><Link to={to} onClick={() => setMore(false)} className={moreLink}><Icon size={19} aria-hidden />{label}<ChevronRight size={17} className="ml-auto text-ink/40" aria-hidden /></Link></li>
          ))}
          <li><Link to="/admin/account" onClick={() => setMore(false)} className={moreLink}><UserRound size={19} aria-hidden />Account and password<ChevronRight size={17} className="ml-auto text-ink/40" aria-hidden /></Link></li>
          <li><Link to="/" target="_blank" rel="noopener" className={moreLink}><ExternalLink size={19} aria-hidden />View the store<ChevronRight size={17} className="ml-auto text-ink/40" aria-hidden /></Link></li>
        </ul>
        <button type="button" onClick={() => setMore(false)} className="mt-5 h-12 w-full rounded-full border border-ink/25 text-[13px] font-bold uppercase tracking-wide hover:border-ink">Close</button>
      </Dialog>
    </div>
  )
}
