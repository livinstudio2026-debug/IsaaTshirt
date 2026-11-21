import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { ExternalLink, Inbox, LayoutDashboard, LoaderCircle, LogOut, Package, Shirt } from 'lucide-react'
import { useAdminAuth } from '../lib/adminAuthContext'
import logo from '../assets/logo/logo.webp'

// The nav lists the whole back office; sections light up as they are built.
const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, ready: true, end: true },
  { to: '/admin/orders', label: 'Orders', icon: Package, ready: true },
  { to: '/admin/products', label: 'Products', icon: Shirt, ready: true },
  { label: 'Inbox', icon: Inbox },
]

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth()
  const [leaving, setLeaving] = useState(false)
  const signOut = async () => { setLeaving(true); await logout() }
  const initial = (admin.name || admin.email).trim()[0]?.toUpperCase()

  return (
    <div className="min-h-svh bg-[#f6ecdc]">
      <header className="sticky top-0 z-30 border-b border-sand bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/admin" aria-label="Back office home" className="flex shrink-0 items-center gap-3">
            <img src={logo} alt="Isaa" width="2114" height="744" className="h-7 w-auto sm:h-8" />
            <span className="hidden rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white sm:inline">Back office</span>
          </Link>

          <nav aria-label="Back office" className="hidden flex-1 items-center gap-1 md:flex md:pl-4">
            {NAV.map(({ to, label, icon: Icon, ready, end }) => ready ? (
              <NavLink key={label} to={to} end={end} className={({ isActive }) => `inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wide transition-colors ${isActive ? 'bg-ink text-white' : 'text-ink/70 hover:bg-sand/60 hover:text-ink'}`}>
                <Icon size={16} />{label}
              </NavLink>
            ) : (
              <span key={label} aria-disabled="true" title="Coming soon" className="inline-flex cursor-not-allowed items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-ink/35">
                <Icon size={16} />{label}
              </span>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link to="/" target="_blank" rel="noopener" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-ink/60 transition-colors hover:text-ink lg:inline-flex">View store <ExternalLink size={14} /></Link>
            <div className="flex items-center gap-2.5 rounded-full border border-sand bg-white/70 py-1 pl-1 pr-3">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-olive text-[13px] font-black text-white">{initial}</span>
              <span className="hidden leading-tight sm:block">
                <span className="block max-w-[10rem] truncate text-[13px] font-bold">{admin.name}</span>
                <span className="block text-[11px] capitalize text-ink/50">{admin.role}</span>
              </span>
            </div>
            <button type="button" onClick={signOut} disabled={leaving} className="inline-flex h-10 items-center gap-2 rounded-full border border-ink px-4 text-[12px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white disabled:opacity-60">
              {leaving ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <LogOut size={15} aria-hidden />}
              <span className="hidden sm:inline">Sign out</span><span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-8 pb-28 sm:px-6 sm:py-10 md:pb-10 lg:px-8"><Outlet /></main>

      {/* phones: the sections live in a bar at the thumb */}
      <nav aria-label="Back office sections" className="fixed inset-x-0 bottom-0 z-30 border-t border-sand bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ to, label, icon: Icon, ready, end }) => (
            <li key={label}>
              {ready ? (
                <NavLink to={to} end={end} className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${isActive ? 'text-ink' : 'text-ink/55'}`}>
                  {({ isActive }) => (<><span className={`grid h-7 w-12 place-items-center rounded-full transition-colors ${isActive ? 'bg-ink text-white' : ''}`}><Icon size={18} aria-hidden /></span>{label}</>)}
                </NavLink>
              ) : (
                <span aria-disabled="true" className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink/30"><Icon size={18} aria-hidden />{label}<span className="sr-only"> (coming soon)</span></span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
