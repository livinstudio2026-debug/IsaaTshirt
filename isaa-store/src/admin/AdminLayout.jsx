import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ChevronRight, ExternalLink, Film, Inbox, LayoutDashboard, LoaderCircle, LogOut, MoreHorizontal, Package, Shirt, UserRound, Users } from 'lucide-react'
import { useAdminAuth } from '../lib/adminAuthContext'
import { useInboxUnread } from './useInboxUnread'
import { Dialog } from './orders/shared'
import logo from '../assets/logo/logo.webp'

// The back office sections. `badge` sections show a count of things waiting (the unread messages on Inbox).
// `primary` ones sit in the phone's bottom bar; the rest live under "More" there. `owner` ones only the owner sees.
const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true, primary: true },
  { to: '/admin/orders', label: 'Orders', icon: Package, primary: true },
  { to: '/admin/products', label: 'Products', icon: Shirt, primary: true },
  { to: '/admin/inbox', label: 'Inbox', icon: Inbox, badge: true, primary: true },
  { to: '/admin/reels', label: 'Reels', icon: Film },
  { to: '/admin/team', label: 'Team', icon: Users, owner: true },
]

// "3 unread": the number is for eyes, the words for screen readers.
function Count({ n, floating = false }) {
  return (
    <span className={`grid min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-black leading-5 tabular-nums text-ink ${floating ? 'absolute -right-0.5 -top-1.5 ring-2 ring-cream' : 'ml-0.5'}`}>
      {n > 99 ? '99+' : n}<span className="sr-only"> unread</span>
    </span>
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
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/admin" aria-label="Back office home" className="flex shrink-0 items-center gap-3">
            <img src={logo} alt="Isaa" width="2114" height="744" className="h-7 w-auto sm:h-8" />
            <span className="hidden rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white sm:inline">Back office</span>
          </Link>

          <nav aria-label="Back office" className="hidden flex-1 items-center gap-1 md:flex md:pl-2">
            {items.map(({ to, label, icon: Icon, end, badge }) => (
              <NavLink key={label} to={to} end={end} title={label} className={({ isActive }) => `inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold uppercase tracking-wide transition-colors lg:px-4 ${isActive ? 'bg-ink text-white' : 'text-ink/70 hover:bg-sand/60 hover:text-ink'}`}>
                <Icon size={16} aria-hidden /><span className="sr-only lg:not-sr-only">{label}</span>
                {badge && unread > 0 && <Count n={unread} />}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link to="/" target="_blank" rel="noopener" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-ink/60 transition-colors hover:text-ink lg:inline-flex">View store <ExternalLink size={14} /></Link>
            <NavLink to="/admin/account" aria-label="Your account" title="Your account" className={({ isActive }) => `flex items-center gap-2.5 rounded-full border bg-white/70 py-1 pl-1 pr-3 transition-colors hover:border-ink/40 ${isActive ? 'border-ink' : 'border-sand'}`}>
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-olive text-[13px] font-black text-white">{initial}</span>
              <span className="hidden leading-tight sm:block">
                <span className="block max-w-[10rem] truncate text-[13px] font-bold">{admin.name}</span>
                <span className="block text-[11px] capitalize text-ink/50">{admin.role}</span>
              </span>
            </NavLink>
            <button type="button" onClick={signOut} disabled={leaving} className="inline-flex h-10 items-center gap-2 rounded-full border border-ink px-4 text-[12px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white disabled:opacity-60">
              {leaving ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <LogOut size={15} aria-hidden />}
              <span className="hidden sm:inline">Sign out</span><span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-8 pb-28 sm:px-6 sm:py-10 md:pb-10 lg:px-8"><Outlet /></main>

      {/* phones: the main sections live in a bar at the thumb; the rest are under More */}
      <nav aria-label="Back office sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-sand bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {primary.map(({ to, label, icon: Icon, end, badge }) => (
            <li key={label}>
              <NavLink to={to} end={end} className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-wide transition-colors ${isActive ? 'text-ink' : 'text-ink/55'}`}>
                {({ isActive }) => (<><span className={`relative grid h-7 w-12 place-items-center rounded-full transition-colors ${isActive ? 'bg-ink text-white' : ''}`}><Icon size={18} aria-hidden />{badge && unread > 0 && <Count n={unread} floating />}</span>{label}</>)}
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
