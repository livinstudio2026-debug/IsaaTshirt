import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Banknote, Check, Inbox, Minus, Package, PackageCheck, RefreshCw, TrendingDown, TrendingUp, Truck, Users } from 'lucide-react'
import { getDashboard } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { inr } from '../../lib/format'
import { useAdminPage } from '../useAdminPage'
import { ErrorBanner, StockBadge, btnGhost } from '../products/ui'
import { StatusBadge } from '../orders/shared'
import { ago } from '../orders/format'

const HOUR = 3_600_000
const NEW_OVERDUE_HOURS = 24 // a new order waiting longer than this is flagged
const PACKED_OVERDUE_HOURS = 48
const hoursSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / HOUR : 0)

const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`
// '2026-11-21' -> 'Sat 21 Nov' (the date is already an Indian calendar day, so no time zone maths)
const dayLabel = (key) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const shortDay = (key) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const Section = ({ title, children, className = '' }) => (
  <section aria-label={title} className={`mt-10 ${className}`}>
    <h2 className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.24em] text-ink/50">{title}</h2>
    {children}
  </section>
)

// ---------------------------------------------------------------------------------------- needs attention

function ActionCard({ icon: Icon, label, value, hint, to, warn = false, display }) {
  const clear = value === 0
  return (
    <Link to={to} className={`group flex flex-col rounded-[24px] border p-5 transition-colors hover:border-ink ${warn ? 'border-amber-500/55 bg-amber-50' : clear ? 'border-sand bg-white/45' : 'border-ink/20 bg-white'}`}>
      <span className="flex items-center justify-between gap-2">
        <span className={`grid size-9 place-items-center rounded-full ${warn ? 'bg-amber-200 text-amber-950' : clear ? 'bg-sand/70 text-ink/45' : 'bg-ink text-white'}`}>{clear ? <Check size={17} strokeWidth={3} aria-hidden /> : <Icon size={17} aria-hidden />}</span>
        <ArrowRight size={17} aria-hidden className="text-ink/30 transition-transform group-hover:translate-x-1 group-hover:text-ink" />
      </span>
      <span className={`mt-4 text-[clamp(30px,3.4vw,40px)] font-black leading-none tabular-nums ${clear ? 'text-ink/40' : ''}`}>{display ?? value}</span>
      <span className="mt-2 text-[12px] font-bold uppercase tracking-[0.12em]">{label}</span>
      <span className={`mt-1 text-[13px] leading-snug ${warn ? 'font-medium text-amber-900' : 'text-ink/55'}`}>{hint}</span>
    </Link>
  )
}

function NeedsAttention({ a, inbox }) {
  const newLate = a.new.count > 0 && hoursSince(a.new.oldest) > NEW_OVERDUE_HOURS
  const packedLate = a.packed.count > 0 && hoursSince(a.packed.oldest) > PACKED_OVERDUE_HOURS
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <ActionCard icon={Package} label="New orders" value={a.new.count} to="/admin/orders" warn={newLate}
        hint={a.new.count ? `${newLate ? 'Waiting since' : 'Oldest'} ${ago(a.new.oldest)}` : 'Nothing to pack'} />
      <ActionCard icon={PackageCheck} label="Ready to ship" value={a.packed.count} to="/admin/orders?status=packed" warn={packedLate}
        hint={a.packed.count ? `${packedLate ? 'Packed' : 'Oldest packed'} ${ago(a.packed.oldest)}` : 'Nothing waiting'} />
      <ActionCard icon={Truck} label={`In transit ${a.stuck.days}+ days`} value={a.stuck.count} to="/admin/orders?status=shipped" warn={a.stuck.count > 0}
        hint={a.stuck.count ? 'Check with the courier' : 'Parcels are moving'} />
      <ActionCard icon={Banknote} label="Cash to record" value={a.codToCollect.count} to="/admin/orders?status=delivered"
        hint={a.codToCollect.count ? `${inr(a.codToCollect.amount)} delivered, not marked paid` : 'All COD recorded'} />
      <div className="col-span-2 lg:col-span-1 [&>a]:h-full">
        <ActionCard icon={Inbox} label="Unread messages" value={inbox.unread} to="/admin/inbox"
          hint={inbox.unread ? 'Customers are waiting for a reply' : 'Inbox is clear'} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------------- sales

// ▲ 12% / ▼ 8% against the period just before. With nothing to compare against it says so rather than inventing a percentage.
function Trend({ now, prev, label }) {
  if (!prev && !now) return <p className="mt-3 text-[13px] text-ink/45">No sales in either period</p>
  if (!prev) return <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink/60"><span className="rounded-full bg-olive/12 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-olive">New</span>nothing in {label}</p>
  const pct = Math.round(((now - prev) / prev) * 100)
  const up = pct > 0
  const Icon = pct === 0 ? Minus : up ? TrendingUp : TrendingDown
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink/60">
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold tabular-nums ${pct === 0 ? 'bg-sand/70 text-ink/70' : up ? 'bg-olive/14 text-olive' : 'bg-red-100 text-red-800'}`}>
        <Icon size={13} aria-hidden />{up ? '+' : ''}{pct}%<span className="sr-only"> compared with {label}</span>
      </span>
      <span aria-hidden>vs {label}</span>
    </p>
  )
}

function Kpi({ title, w, compare }) {
  return (
    <article className="rounded-[24px] border border-sand bg-white/70 p-5 sm:p-6">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/50">{title}</h3>
      <p className="mt-2.5 text-[clamp(30px,3.6vw,42px)] font-black leading-none tabular-nums">{inr(w.revenue)}</p>
      <p className="mt-2.5 text-[14px] text-ink/60">{plural(w.orders, 'order')} · {plural(w.pieces, 'piece')}{w.orders > 0 && <span className="text-ink/40"> · avg {inr(w.avgOrder)}</span>}</p>
      {compare.today
        ? <p className="mt-3 text-[13px] text-ink/60">Yesterday: <b className="tabular-nums text-ink/75">{inr(w.prev.revenue)}</b> · {plural(w.prev.orders, 'order')}</p>
        : <Trend now={w.revenue} prev={w.prev.revenue} label={compare.label} />}
    </article>
  )
}

function SalesChart({ series }) {
  const [metric, setMetric] = useState('revenue')
  const [hover, setHover] = useState(null)
  const last = series.length - 1
  const max = Math.max(0, ...series.map((d) => d[metric]))
  const shown = series[hover ?? last]
  const fmt = (d) => (metric === 'revenue' ? inr(d.revenue) : plural(d.orders, 'order'))
  const point = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.min(last, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * series.length))))
  }

  return (
    <article className="rounded-[24px] border border-sand bg-white/70 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div aria-live="off">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink/50">Last 30 days</h3>
          <p className="mt-2 text-[22px] font-black leading-none tabular-nums sm:text-[26px]">{fmt(shown)}</p>
          <p className="mt-1.5 text-[13px] text-ink/55">{hover == null || hover === last ? 'Today' : dayLabel(shown.date)}{metric === 'revenue' ? ` · ${plural(shown.orders, 'order')}` : ` · ${inr(shown.revenue)}`}</p>
        </div>
        <div role="group" aria-label="Chart shows" className="inline-flex rounded-full border border-sand bg-cream/70 p-1">
          {[['revenue', 'Revenue'], ['orders', 'Orders']].map(([id, label]) => (
            <button key={id} type="button" aria-pressed={metric === id} onClick={() => setMetric(id)}
              className={`h-9 rounded-full px-4 text-[12px] font-bold uppercase tracking-wide transition-colors ${metric === id ? 'bg-ink text-white' : 'text-ink/60 hover:text-ink'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* the bars are for eyes; the table below says the same thing to a screen reader */}
      <div aria-hidden className="relative mt-6 h-44 touch-pan-y select-none sm:h-56" onPointerMove={point} onPointerDown={point} onPointerLeave={(e) => { if (e.pointerType !== 'touch') setHover(null) }}>
        <div className="absolute inset-x-0 bottom-0 h-px bg-ink/15" />
        <div className="absolute inset-0 flex items-end gap-[3px] sm:gap-1.5">
          {series.map((d, i) => (
            <div key={d.date} className="flex h-full flex-1 items-end">
              <div className={`w-full rounded-t-[5px] transition-[height,background-color] duration-300 motion-reduce:transition-none ${i === hover ? 'bg-ink' : i === last ? 'bg-olive' : 'bg-olive/35'}`}
                style={{ height: max ? `${d[metric] > 0 ? Math.max((d[metric] / max) * 100, 3) : 0}%` : '0%' }} />
            </div>
          ))}
        </div>
        {max === 0 && <p className="absolute inset-0 grid place-items-center text-[14px] text-ink/45">No orders in the last 30 days yet</p>}
      </div>
      <div aria-hidden className="mt-2 flex justify-between text-[11.5px] tabular-nums text-ink/45"><span>{shortDay(series[0].date)}</span><span>{shortDay(series[Math.floor(last / 2)].date)}</span><span>Today</span></div>

      <table className="sr-only">
        <caption>Orders and revenue for each of the last 30 days</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Orders</th><th scope="col">Revenue</th></tr></thead>
        <tbody>{series.map((d) => <tr key={d.date}><th scope="row">{dayLabel(d.date)}</th><td>{d.orders}</td><td>{inr(d.revenue)}</td></tr>)}</tbody>
      </table>
    </article>
  )
}

// ------------------------------------------------------------------------------------------ queue and stock

const Card = ({ title, aside, children, footer }) => (
  <article className="flex flex-col rounded-[24px] border border-sand bg-white/70">
    <header className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-5 sm:px-6 sm:pt-6">
      <h3 className="text-[17px] font-black uppercase italic tracking-tight">{title}</h3>
      {aside && <p className="text-[12.5px] text-ink/50">{aside}</p>}
    </header>
    <div className="flex-1">{children}</div>
    {footer && <footer className="border-t border-sand/80 px-5 py-3.5 sm:px-6">{footer}</footer>}
  </article>
)

const AllClear = ({ children }) => (
  <p className="flex items-center gap-3 px-5 py-8 text-[14.5px] text-ink/60 sm:px-6">
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-olive/12 text-olive"><Check size={17} strokeWidth={3} aria-hidden /></span>{children}
  </p>
)

const footLink = 'inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide underline-offset-4 hover:underline'

function Queue({ rows, a }) {
  const shown = rows.length
  const more = a.new.count + a.packed.count - shown
  return (
    <Card title="Needs action" aside={a.new.count + a.packed.count ? 'Oldest first' : null}
      footer={<Link to="/admin/orders" className={footLink}>{more > 0 ? `+${more} more · ` : ''}All orders <ArrowRight size={14} aria-hidden /></Link>}>
      {shown === 0 ? <AllClear>Nothing waiting to be packed or shipped.</AllClear> : (
        <ul className="divide-y divide-sand/70 pt-2">
          {rows.map((o) => {
            const late = hoursSince(o.createdAt) > (o.next === 'pack' ? NEW_OVERDUE_HOURS : PACKED_OVERDUE_HOURS)
            return (
              <li key={o.orderNumber}>
                <Link to={`/admin/orders/${o.orderNumber}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-cream/80 sm:px-6">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-black tabular-nums tracking-wide">{o.orderNumber}</b>
                    <span className="block truncate text-[13px] text-ink/55">{o.customer.name} · {o.place}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <b className="block text-[14px] tabular-nums">{inr(o.total)}</b>
                    <span className={`block text-[12.5px] ${late ? 'font-bold text-amber-800' : 'text-ink/50'}`}>{ago(o.createdAt)}</span>
                  </span>
                  <span className={`hidden w-[4.6rem] shrink-0 justify-center rounded-full px-2.5 py-1 text-center text-[11px] font-bold uppercase tracking-wide sm:inline-flex ${o.next === 'pack' ? 'bg-amber-100 text-amber-900' : 'bg-sky-100 text-sky-900'}`}>{o.next === 'pack' ? 'Pack it' : 'Ship it'}</span>
                  <span className="sm:hidden"><StatusBadge status={o.status} /></span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function Stock({ stock }) {
  const { items, out, low, lowAt } = stock
  const total = out + low
  return (
    <Card title="Low stock" aside={total ? `${out} sold out · ${low} running low` : null}
      footer={<Link to="/admin/products?status=low" className={footLink}>{total > items.length ? `+${total - items.length} more · ` : ''}All products <ArrowRight size={14} aria-hidden /></Link>}>
      {items.length === 0 ? <AllClear>Every size has more than {lowAt} in stock.</AllClear> : (
        <ul className="divide-y divide-sand/70 pt-2">
          {items.map((p) => (
            <li key={p.slug}>
              <Link to={`/admin/products/${p.slug}`} className="flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-cream/80 sm:px-6">
                <span className="block h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-sand/60">{p.thumb && <img src={p.thumb} alt="" loading="lazy" className="size-full object-contain" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><b className="truncate">{p.name}</b><StockBadge state={p.state} /></span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.sizes.map((s) => (
                      <span key={s.size} className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold tabular-nums ${s.stock === 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{s.size}<span className="font-medium"> · {s.stock === 0 ? 'gone' : `${s.stock} left`}</span></span>
                    ))}
                  </span>
                </span>
                <ArrowRight size={16} aria-hidden className="shrink-0 text-ink/30" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// -------------------------------------------------------------------------------------------------- page

function Skeleton() {
  const bar = (h) => <div className={`${h} animate-pulse rounded-[24px] bg-sand/45 motion-reduce:animate-none`} />
  return (
    <div aria-hidden className="mt-10 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div key={i}>{bar('h-40')}</div>)}</div>
      <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i}>{bar('h-36')}</div>)}</div>
      {bar('h-72')}
    </div>
  )
}

const clock = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export default function Overview() {
  useAdminPage('Overview')
  const { admin } = useAdminAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    getDashboard(ac.signal).then(
      (d) => { setData(d); setError(''); setLoading(false) },
      (err) => { if (err.name === 'AbortError') return; setError(err.message); setLoading(false) },
    )
    return () => ac.abort()
  }, [tick])

  // fresh numbers every few minutes while the tab is open, and the moment you come back to it
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setTick((n) => n + 1) }
    const timer = setInterval(refresh, 3 * 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])

  const reload = () => { setLoading(true); setTick((n) => n + 1) }
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="animate-[rise_.6s_ease-out_both] motion-reduce:animate-none">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-olive">Back office · {today}</p>
          <h1 className="mt-2 font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(32px,5vw,60px)]" style={{ fontVariationSettings: '"wdth" 86' }}>
            {greeting()}, {admin.name.split(' ')[0]}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {data && <p className="hidden text-[12.5px] text-ink/50 sm:block">Updated {clock(new Date(data.generatedAt))}</p>}
          <button type="button" onClick={reload} disabled={loading} className={btnGhost}><RefreshCw size={15} className={loading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden />Refresh</button>
        </div>
      </div>

      {error && <div className="mt-8"><ErrorBanner onRetry={reload}>{error}</ErrorBanner></div>}
      {!data && !error && <Skeleton />}

      {data && (
        <div aria-busy={loading} className={`transition-opacity ${loading ? 'opacity-70' : ''}`}>
          <Section title="Needs attention"><NeedsAttention a={data.actions} inbox={data.inbox} /></Section>

          <Section title="Sales">
            <div className="grid gap-3 md:grid-cols-3">
              <Kpi title="Today" w={data.sales.today} compare={{ today: true }} />
              <Kpi title="Last 7 days" w={data.sales.week} compare={{ label: 'the 7 days before' }} />
              <Kpi title="Last 30 days" w={data.sales.month} compare={{ label: 'the 30 days before' }} />
            </div>
            <div className="mt-3"><SalesChart series={data.sales.series} /></div>
            <p className="mt-3 px-1 text-[12.5px] text-ink/45">Counts every order that wasn’t cancelled, on the day it was placed (Indian time). Cash on delivery is counted when ordered, not when the cash arrives.</p>
          </Section>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <Queue rows={data.queue} a={data.actions} />
            <Stock stock={data.stock} />
          </div>

          <p className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-sand pt-5 text-[13px] text-ink/55">
            <span className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden /><b className="tabular-nums text-ink/75">{data.inbox.subscribers.toLocaleString('en-IN')}</b> subscribers{data.inbox.newSubscribers7d > 0 && ` (+${data.inbox.newSubscribers7d} this week)`}<Link to="/admin/inbox?tab=subscribers" className="ml-1 font-bold underline underline-offset-4 hover:text-ink">View</Link></span>
            <span className="sm:ml-auto">Signed in as <b className="text-ink/75">{admin.email}</b> · <span className="capitalize">{admin.role}</span></span>
          </p>
        </div>
      )}
    </div>
  )
}
