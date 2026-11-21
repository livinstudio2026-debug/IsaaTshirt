import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Inbox, LayoutDashboard, Package, Shirt, ShieldCheck } from 'lucide-react'
import { listOrders } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { useAdminPage } from '../useAdminPage'

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')

const STEPS = [
  { icon: ShieldCheck, title: 'Admin sign-in', text: 'Secure team login with a protected session.', done: true },
  { icon: Package, title: 'Orders', text: 'Filter, pack, ship with tracking, cancel and restock, mark COD paid, print packing slips.', done: true, to: '/admin/orders' },
  { icon: Shirt, title: 'Products', text: 'Add and edit products, upload pictures, change stock by size, set the home page order, hide or delete.', done: true, to: '/admin/products' },
  { icon: Inbox, title: 'Inbox', text: 'Contact messages and newsletter sign-ups with CSV export.' },
  { icon: LayoutDashboard, title: 'Dashboard', text: 'Today’s orders, revenue and low-stock alerts.' },
]

const QUEUE = [
  { id: 'new', label: 'New', hint: 'to pack' },
  { id: 'packed', label: 'Packed', hint: 'to ship' },
  { id: 'shipped', label: 'Shipped', hint: 'on the way' },
  { id: 'delivered', label: 'Delivered', hint: 'all time' },
]

export default function Overview() {
  useAdminPage('Overview')
  const { admin } = useAdminAuth()
  const [counts, setCounts] = useState(null)
  useEffect(() => {
    const ac = new AbortController()
    listOrders({ limit: 1 }, ac.signal).then((d) => setCounts(d.counts), () => {})
    return () => ac.abort()
  }, [])

  return (
    <div className="animate-[rise_.6s_ease-out_both] motion-reduce:animate-none">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-olive">Back office</p>
      <h1 className="mt-2 font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(32px,5vw,60px)]" style={{ fontVariationSettings: '"wdth" 86' }}>
        {greeting()}, {admin.name.split(' ')[0]}
      </h1>
      <p className="mt-3 max-w-xl text-[clamp(15px,1.1vw,17px)] text-ink/65">You’re signed in. Here’s the queue, and where the rest of the back office stands.</p>

      <section aria-label="Orders at a glance" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUEUE.map(({ id, label, hint }) => (
          <Link key={id} to={id === 'new' ? '/admin/orders' : `/admin/orders?status=${id}`} className={`group rounded-[24px] border p-5 transition-colors hover:border-ink ${id === 'new' && counts?.new > 0 ? 'border-amber-500/50 bg-amber-50' : 'border-sand bg-white/70'}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/50">{label} <span className="font-normal normal-case tracking-normal">· {hint}</span></p>
            <p className="mt-2 flex items-end justify-between text-[clamp(30px,4vw,44px)] font-black leading-none tabular-nums">{counts ? counts[id] : '–'}<ArrowRight size={18} aria-hidden className="mb-1 text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-ink" /></p>
          </Link>
        ))}
      </section>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text, done }) => (
          <article key={title} className={`rounded-[24px] border p-5 sm:p-6 ${done ? 'border-olive/30 bg-white' : 'border-sand bg-cream/70'}`}>
            <div className="flex items-center justify-between">
              <span className={`grid h-11 w-11 place-items-center rounded-full ${done ? 'bg-olive text-white' : 'bg-sand/70 text-ink/60'}`}><Icon size={20} /></span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider ${done ? 'bg-olive/12 text-olive' : 'bg-sand/60 text-ink/50'}`}>
                {done ? <><Check size={12} strokeWidth={3} />Live</> : 'Coming next'}
              </span>
            </div>
            <h2 className="mt-4 text-[17px] font-black uppercase italic tracking-tight">{title}</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink/60">{text}</p>
          </article>
        ))}

        <article className="rounded-[24px] border border-sand bg-white/60 p-5 sm:p-6 sm:col-span-2 lg:col-span-1">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink/50">This session</h2>
          <dl className="mt-3 space-y-2.5 text-[14px]">
            <div><dt className="text-ink/50">Signed in as</dt><dd className="break-all font-bold">{admin.email}</dd></div>
            <div><dt className="text-ink/50">Role</dt><dd className="font-bold capitalize">{admin.role}</dd></div>
            {admin.lastLoginAt && <div><dt className="text-ink/50">Signed in at</dt><dd className="font-bold">{when(admin.lastLoginAt)}</dd></div>}
          </dl>
        </article>
      </div>
    </div>
  )
}
