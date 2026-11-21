import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, Ban, Check, CircleAlert, ExternalLink, LoaderCircle, MessageCircle } from 'lucide-react'
import { trackOrder } from '../lib/api'
import { ORDER_RE, normaliseOrderNumber as normaliseNumber } from '../lib/orderNumber'
import { inr } from '../lib/format'
import { Field } from '../components/form/Field'
import { OrderItems, Totals, Address } from '../components/orders/OrderParts'
import { card, eyebrow } from '../components/orders/orderStyles'
import underline from '../assets/featuredDrop/underline-stroke.webp'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const STEPS = [
  { id: 'placed', label: 'Order placed' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'packed', label: 'Packed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
]
const day = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const longDay = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

function Progress({ order }) {
  const at = STEPS.findIndex((s) => s.id === order.status)
  const when = (id) => order.statusHistory.find((h) => h.status === id)?.at
  return (
    <ol aria-label="Order progress" className="flex flex-col sm:flex-row">
      {STEPS.map((s, i) => {
        const done = i < at, current = i === at
        const last = i === STEPS.length - 1
        return (
          <li key={s.id} aria-current={current ? 'step' : undefined} className="relative flex gap-4 pb-7 last:pb-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-3 sm:pb-0 sm:text-center">
            {!last && <span aria-hidden className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 sm:left-1/2 sm:top-[15px] sm:h-0.5 sm:w-full ${done ? 'bg-olive' : 'bg-sand'}`} />}
            <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-[12px] font-bold ${done || current ? 'border-olive bg-olive text-white' : 'border-sand bg-cream text-ink/35'} ${current ? 'shadow-[0_0_0_5px_rgba(107,106,34,.18)]' : ''}`}>
              {done || (current && s.id === 'delivered') ? <Check size={16} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className="sm:px-1">
              <b className={`block text-[15px] leading-tight ${done || current ? '' : 'text-ink/40'}`}>{s.label}</b>
              <span className="block text-[13px] text-ink/55">{when(s.id) ? day(when(s.id)) : current ? 'In progress' : ''}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function Track() {
  const [params] = useSearchParams()
  const { state } = useLocation()
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '')
  const [email, setEmail] = useState(state?.email ?? '')
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('idle') // idle | loading
  const [error, setError] = useState('')
  const [order, setOrder] = useState(null)
  const result = useRef(null)
  const auto = useRef(false)

  useEffect(() => { document.title = 'Track your order — Isaa' }, [])

  async function lookup(num, mail) {
    const n = normaliseNumber(num), m = mail.trim()
    const errs = {}
    if (!ORDER_RE.test(n)) errs.orderNumber = 'Enter your order number, like ISA-241121-7K3M9Q'
    if (!EMAIL_RE.test(m)) errs.email = 'Enter the email you ordered with'
    setErrors(errs); setError('')
    if (Object.keys(errs).length) return document.getElementById(errs.orderNumber ? 'orderNumber' : 'email')?.focus()
    setStatus('loading')
    try {
      setOrder(await trackOrder({ orderNumber: n, email: m }))
      setTimeout(() => result.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    } catch (err) {
      setOrder(null)
      setError(err.message)
    } finally {
      setStatus('idle')
    }
  }

  // arriving from the confirmation page: the email is already known, so show the order straight away
  useEffect(() => {
    if (auto.current || !state?.email || !params.get('order')) return
    auto.current = true
    lookup(params.get('order'), state.email)
  })

  const submit = (e) => { e.preventDefault(); if (status !== 'loading') lookup(orderNumber, email) }
  const cod = order?.payment.method === 'cod'

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-[14vw] pt-10 sm:pb-[7vw] lg:px-[6vw] lg:pb-[5vw] lg:pt-[3.5vw]">
      <header className="text-center">
        <p className={eyebrow}>Order tracking</p>
        <h1 className="mt-2 font-black italic uppercase leading-[0.9] tracking-tight text-[14vw] sm:text-[9vw] lg:text-[5.4vw]" style={{ fontVariationSettings: '"wdth" 84' }}>Where’s my order?</h1>
        <div className="mt-2 inline-block -rotate-2">
          <p className="whitespace-nowrap font-script text-[8vw] leading-[1.1] text-olive sm:text-[5vw] lg:text-[2.6vw]">Let’s find it</p>
          <img src={underline} alt="" aria-hidden className="mt-1 h-[1.8vw] w-[92%] object-fill sm:h-[1.1vw] lg:h-[0.8vw]" />
        </div>
        <p className="mx-auto mt-4 max-w-md text-[15px] text-ink/65">Enter the order number from your confirmation and the email you ordered with. No account needed.</p>
      </header>

      <form onSubmit={submit} noValidate className={`${card} mx-auto mt-8 max-w-2xl lg:mt-[2.5vw]`}>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Field id="orderNumber" label="Order number" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={orderNumber} onChange={(e) => { setOrderNumber(e.target.value); setErrors((s) => ({ ...s, orderNumber: '' })) }} error={errors.orderNumber} />
          <Field id="email" label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((s) => ({ ...s, email: '' })) }} error={errors.email} />
        </div>
        {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-2xl border border-red-600/30 bg-red-50/70 p-4 text-[14px] font-medium text-red-800"><CircleAlert size={18} className="mt-px shrink-0" aria-hidden />{error}</p>}
        <button type="submit" disabled={status === 'loading'} className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-ink text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive active:scale-[.98] disabled:cursor-wait disabled:bg-ink/70">
          {status === 'loading' ? <><LoaderCircle size={18} className="animate-spin" aria-hidden /> Looking it up…</> : <>Track order <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" /></>}
        </button>
      </form>

      {order && (
        <div ref={result} className="mt-10 scroll-mt-28 animate-[rise_.7s_cubic-bezier(.2,.7,.2,1)_both] motion-reduce:animate-none lg:mt-[3vw]">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={eyebrow}>Order</p>
              <h2 className="text-[26px] font-black tracking-wider tabular-nums">{order.orderNumber}</h2>
              <p className="text-[14px] text-ink/60">Placed on {longDay(order.createdAt)}</p>
            </div>
            <p className={`rounded-full px-4 py-2 text-[12px] font-bold uppercase tracking-[0.14em] ${order.status === 'cancelled' ? 'bg-red-100 text-red-800' : order.status === 'delivered' ? 'bg-olive text-white' : 'bg-olive/12 text-olive'}`}>{order.status === 'cancelled' ? 'Cancelled' : STEPS.find((s) => s.id === order.status)?.label}</p>
          </div>

          <section aria-label="Order status" className={`${card} mt-5`}>
            {order.status === 'cancelled' ? (
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-800"><Ban size={20} aria-hidden /></span>
                <div><b className="block">This order was cancelled.</b><p className="mt-1 text-[14px] text-ink/65">If you didn’t ask for this, or you’d like to order again, we’re happy to help.</p></div>
              </div>
            ) : <Progress order={order} />}
            {order.tracking && order.status !== 'cancelled' && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-sand/40 p-4">
                <p className="text-[14px]"><b>{order.tracking.carrier || 'Carrier'}</b>{order.tracking.number && <span className="text-ink/65"> · {order.tracking.number}</span>}</p>
                {order.tracking.url && <a href={order.tracking.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[12px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Track shipment <ExternalLink size={15} aria-hidden /></a>}
              </div>
            )}
          </section>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
            <section aria-label="Items" className={card}><h3 className={`mb-5 ${eyebrow}`}>Items</h3><OrderItems items={order.items} /><div className="mt-6 border-t border-sand pt-5"><Totals totals={order.totals} /></div></section>
            <div className="space-y-5">
              <section className={card}><h3 className={`mb-3 ${eyebrow}`}>Delivering to</h3><Address customer={order.customer} address={order.address} /></section>
              <section className={card}>
                <h3 className={`mb-3 ${eyebrow}`}>Payment</h3>
                <p className="font-bold">{cod ? 'Cash on delivery' : 'Paid online'}</p>
                <p className="mt-1 text-[14px] text-ink/65">{cod ? (order.status === 'delivered' ? 'Paid on delivery.' : `Pay ${inr(order.totals.total)} when it arrives.`) : 'Payment received.'}</p>
              </section>
            </div>
          </div>

          <p className="mt-6 text-center text-[14px] text-ink/60">
            Something not right?{' '}
            <Link to="/contact?topic=order" className="inline-flex items-center gap-1.5 font-bold text-ink underline underline-offset-4 transition-colors hover:text-olive"><MessageCircle size={15} aria-hidden /> Contact us about this order</Link>
          </p>
        </div>
      )}
    </div>
  )
}
