import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Check, CircleAlert, Copy, ExternalLink, LoaderCircle, Mail, MessageCircle, Phone, Printer, RefreshCw, Truck } from 'lucide-react'
import { addOrderNote, cancelOrder, getOrder, markOrderPaid, resendOrderEmail, setOrderStatus } from '../../lib/adminApi'
import { inr } from '../../lib/format'
import { OrderItems, Totals } from '../../components/orders/OrderParts'
import { card, eyebrow } from '../../components/orders/orderStyles'
import { useAdminPage } from '../useAdminPage'
import { PaymentBadge, StatusBadge } from '../orders/shared'
import { dateTime, fullDateTime, whatsappLink } from '../orders/format'
import ShipDialog from '../orders/ShipDialog'
import ConfirmDialog from '../orders/ConfirmDialog'
import EmailsCard from '../orders/EmailsCard'

const STEPS = [
  { id: 'placed', label: 'Placed' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'packed', label: 'Packed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
]
// the buttons offered for each status (the server enforces the same rules)
const FORWARD = {
  placed: [{ to: 'confirmed', label: 'Confirm order', quiet: true }, { to: 'packed', label: 'Mark packed' }],
  confirmed: [{ to: 'packed', label: 'Mark packed' }],
  packed: [{ to: 'shipped', label: 'Ship order', icon: Truck }],
  shipped: [{ to: 'delivered', label: 'Mark delivered' }],
}
const CANCELLABLE = ['placed', 'confirmed', 'packed']
const historyLabel = (h) => (h.action === 'status' ? `Marked ${h.to}` : { ship: 'Shipped', cancel: 'Cancelled', paid: 'Marked paid', note: 'Note', email: 'Email sent again' }[h.action] ?? h.action)

function Stepper({ order }) {
  const at = STEPS.findIndex((s) => s.id === order.status)
  const when = (id) => order.statusHistory.find((h) => h.status === id)?.at
  return (
    <ol aria-label="Order progress" className="flex flex-col sm:flex-row">
      {STEPS.map((s, i) => {
        const done = i < at || (s.id === 'delivered' && at === i)
        const current = i === at && !done
        const skipped = s.id === 'confirmed' && i < at && !when('confirmed')
        const last = i === STEPS.length - 1
        return (
          <li key={s.id} aria-current={current ? 'step' : undefined} className="relative flex gap-4 pb-6 last:pb-0 sm:flex-1 sm:flex-col sm:items-center sm:gap-3 sm:pb-0 sm:text-center">
            {!last && <span aria-hidden className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 sm:left-1/2 sm:top-[15px] sm:h-0.5 sm:w-full ${i < at ? 'bg-olive' : 'bg-sand'}`} />}
            <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 text-[12px] font-bold ${done || current ? 'border-olive bg-olive text-white' : 'border-sand bg-cream text-ink/35'} ${current ? 'shadow-[0_0_0_5px_rgba(107,106,34,.18)]' : ''}`}>
              {done ? <Check size={16} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className="sm:px-1">
              <b className={`block text-[14px] leading-tight ${done || current ? '' : 'text-ink/40'}`}>{s.label}</b>
              <span className="block text-[12.5px] text-ink/55">{skipped ? 'Skipped' : when(s.id) ? dateTime(when(s.id)) : current ? 'Now' : ''}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* the text is on screen to select */ }
  }
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-[12px] font-bold hover:border-ink hover:bg-ink hover:text-white">
      {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{done ? 'Copied' : label}
    </button>
  )
}

export default function OrderDetail() {
  const { number } = useParams()
  useAdminPage(number)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null) // { message, status }
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState('') // a quick action in flight
  const [dialog, setDialog] = useState(null) // 'ship' | 'cancel' | 'paid' | 'delivered'
  const [note, setNote] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)

  const load = useCallback(async (signal) => {
    try { setOrder(await getOrder(number, signal)); setError(null) } catch (err) { if (err.name !== 'AbortError') setError({ message: err.status === 404 ? 'We couldn’t find that order.' : err.message, status: err.status }) }
  }, [number])
  useEffect(() => {
    const ac = new AbortController()
    getOrder(number, ac.signal).then(
      (o) => { setOrder(o); setError(null) },
      (err) => { if (err.name !== 'AbortError') setError({ message: err.status === 404 ? 'We couldn’t find that order.' : err.message, status: err.status }) },
    )
    return () => ac.abort()
  }, [number])

  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(t) }, [notice])

  // run an action; on success show the updated order, on a clash (409) show why and refresh to the latest
  const run = async (fn, done, key = '') => {
    setPending(key); setNotice(''); setError(null)
    try { setOrder(await fn()); setNotice(done); setDialog(null) } catch (err) {
      if (err.status === 409) load()
      setPending('')
      throw err
    }
    setPending('')
  }
  const quick = async (to) => {
    try { await run(() => setOrderStatus(number, to), `Marked ${to}.`, to) } catch (err) { setError({ message: err.message }) }
  }
  const resend = async (kind) => {
    try { await run(() => resendOrderEmail(number, kind), 'Email sent again.', `email-${kind}`) } catch (err) { setError({ message: err.message }) }
  }
  const onForward = (to) => (to === 'shipped' ? setDialog('ship') : to === 'delivered' ? setDialog('delivered') : quick(to))

  const saveNote = async (e) => {
    e.preventDefault()
    if (!note.trim() || noteBusy) return
    setNoteBusy(true)
    try { setOrder(await addOrderNote(number, note.trim())); setNote('') } catch (err) { setError({ message: err.message }) }
    setNoteBusy(false)
  }

  if (!order && !error) return <div aria-busy className="space-y-4"><div className="h-12 w-72 animate-pulse rounded-xl bg-sand/50" /><div className="h-40 animate-pulse rounded-[28px] bg-sand/40" /><div className="h-72 animate-pulse rounded-[28px] bg-sand/40" /></div>
  if (!order) {
    return (
      <div className={`${card} mx-auto max-w-lg text-center`}>
        <p className="text-[18px] font-black uppercase italic">{error.message}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link to="/admin/orders" className="rounded-full border border-ink px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide hover:bg-ink hover:text-white">All orders</Link>
          {error.status !== 404 && <button type="button" onClick={() => { setError(null); load() }} className="rounded-full bg-ink px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-olive">Try again</button>}
        </div>
      </div>
    )
  }

  const { status } = order
  const cod = order.payment.method === 'cod'
  const toCollect = cod && order.payment.status !== 'paid' && ['shipped', 'delivered'].includes(status)
  const forward = FORWARD[status] ?? []
  const pieces = order.items.reduce((n, i) => n + i.qty, 0)
  const addressText = [order.customer.name, order.address.line1, order.address.line2, order.address.landmark && `Near ${order.address.landmark}`, `${order.address.city}, ${order.address.state} ${order.address.pincode}`, order.customer.phone].filter(Boolean).join('\n')

  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <Link to="/admin/orders" className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-ink/60 transition-colors hover:text-ink"><ArrowLeft size={15} aria-hidden /> All orders</Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="break-all text-[clamp(24px,3.6vw,40px)] font-black leading-none tracking-wider tabular-nums">{order.orderNumber}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-2 text-[14px] text-ink/60">Placed {fullDateTime(order.createdAt)} · {pieces} {pieces === 1 ? 'piece' : 'pieces'} · <b className="text-ink">{inr(order.totals.total)}</b></p>
        </div>
        <a href={`/admin/orders/${order.orderNumber}/slip?print=1`} target="_blank" rel="noopener" className="inline-flex h-11 items-center gap-2 rounded-full border border-ink px-5 text-[12px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white">
          <Printer size={16} aria-hidden /> Print packing slip
        </a>
      </header>

      <div className="mt-4 space-y-3 empty:hidden" aria-live="polite">
        {notice && <p role="status" className="flex items-center gap-2.5 rounded-2xl border border-olive/25 bg-olive/10 px-4 py-3 text-[14px] font-medium text-moss"><Check size={17} className="shrink-0" aria-hidden />{notice}</p>}
        {error && <p role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />{error.message}</p>}
        {status === 'cancelled' && !order.stockReleased && <p role="alert" className="flex items-start gap-2.5 rounded-2xl border border-amber-600/30 bg-amber-50 px-4 py-3 text-[14px] text-amber-900"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />This order is cancelled, but its stock couldn’t be put back automatically. Please check the stock for these pieces.</p>}
      </div>

      {/* progress + what to do next */}
      <section aria-label="Progress" className={`${card} mt-5`}>
        {status === 'cancelled' ? (
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-100 text-red-800"><Ban size={20} aria-hidden /></span>
            <div><b className="block">Cancelled {order.cancelledAt ? dateTime(order.cancelledAt) : ''}</b><p className="mt-1 text-[14px] text-ink/65">{order.cancelReason || 'No reason given.'}{order.stockReleased && ' The pieces are back in stock.'}</p></div>
          </div>
        ) : <Stepper order={order} />}

        {(forward.length > 0 || CANCELLABLE.includes(status)) && (
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-sand pt-5">
            {forward.map(({ to, label, quiet, icon: Icon }, i) => (
              <button key={to} type="button" disabled={Boolean(pending)} onClick={() => onForward(to)}
                className={`inline-flex h-12 items-center gap-2 rounded-full px-6 text-[13px] font-bold uppercase tracking-wide transition-colors disabled:cursor-wait disabled:opacity-70 ${i === forward.length - 1 ? 'bg-ink text-white hover:bg-olive' : 'border border-ink/30 hover:border-ink'}`}>
                {pending === to ? <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden /> : Icon ? <Icon size={17} aria-hidden /> : null}{label}
                {quiet && <span className="sr-only"> (optional step)</span>}
              </button>
            ))}
            {CANCELLABLE.includes(status) && <button type="button" disabled={Boolean(pending)} onClick={() => setDialog('cancel')} className="ml-auto inline-flex h-12 items-center gap-2 rounded-full border border-red-700/40 px-6 text-[13px] font-bold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-700 hover:text-white disabled:opacity-60"><Ban size={16} aria-hidden />Cancel order</button>}
          </div>
        )}
      </section>

      {toCollect && (
        <section aria-label="Cash on delivery" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-amber-600/35 bg-amber-50 p-5 sm:p-6">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-900/70">Cash on delivery</p><p className="mt-1 text-[22px] font-black tabular-nums text-amber-950">{inr(order.totals.total)} to collect</p><p className="text-[13.5px] text-amber-900/80">Mark it paid once the courier has handed the cash over.</p></div>
          <button type="button" onClick={() => setDialog('paid')} className="inline-flex h-12 items-center gap-2 rounded-full bg-amber-950 px-6 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-ink">Mark as paid</button>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
        <div className="space-y-5">
          <section aria-label="Items" className={card}>
            <h2 className={`mb-5 ${eyebrow}`}>Items</h2>
            <OrderItems items={order.items} />
            <div className="mt-6 border-t border-sand pt-5"><Totals totals={order.totals} /></div>
          </section>

          {order.notes && <section className={card}><h2 className={`mb-2 ${eyebrow}`}>Note from the customer</h2><p className="whitespace-pre-wrap leading-relaxed">{order.notes}</p></section>}

          <section aria-label="History" className={card}>
            <h2 className={`mb-4 ${eyebrow}`}>History</h2>
            <form onSubmit={saveNote} className="mb-5 flex gap-2">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Add an internal note" aria-label="Add an internal note" disabled={noteBusy}
                className="h-11 min-w-0 flex-1 rounded-full border border-sand bg-white/80 px-4 text-[15px] outline-none focus:border-olive focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)]" />
              <button type="submit" disabled={!note.trim() || noteBusy} className="h-11 shrink-0 rounded-full bg-ink px-5 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-olive disabled:opacity-40">Add</button>
            </form>
            {order.history.length === 0 ? <p className="text-[14px] text-ink/55">Nothing yet. Changes made by your team show up here.</p> : (
              <ol className="space-y-4 border-l-2 border-sand pl-5">
                {order.history.map((h, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden className="absolute -left-[27px] top-1.5 size-2.5 rounded-full bg-olive" />
                    <p className="text-[14.5px]"><b>{historyLabel(h)}</b>
                      <span className="text-ink/55"> · {h.by || 'Team'} · {dateTime(h.at)}</span></p>
                    {h.note && <p className="mt-0.5 text-[14px] text-ink/70">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className={card}>
            <h2 className={`mb-3 ${eyebrow}`}>Customer</h2>
            <p className="text-[17px] font-black">{order.customer.name}</p>
            <p className="mt-1 break-all text-[14.5px] text-ink/70">{order.customer.email}</p>
            <p className="text-[14.5px] text-ink/70 tabular-nums">{order.customer.phone}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={`tel:+91${order.customer.phone}`} className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-[12px] font-bold hover:border-ink hover:bg-ink hover:text-white"><Phone size={14} aria-hidden />Call</a>
              <a href={whatsappLink(order.customer.phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-[12px] font-bold hover:border-ink hover:bg-ink hover:text-white"><MessageCircle size={14} aria-hidden />WhatsApp</a>
              <a href={`mailto:${order.customer.email}?subject=${encodeURIComponent(`Your Isaa order ${order.orderNumber}`)}`} className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 px-3 py-1.5 text-[12px] font-bold hover:border-ink hover:bg-ink hover:text-white"><Mail size={14} aria-hidden />Email</a>
            </div>
          </section>

          <section className={card}>
            <h2 className={`mb-3 ${eyebrow}`}>Ship to</h2>
            <address className="not-italic leading-relaxed">
              {order.address.line1}<br />
              {order.address.line2 && <>{order.address.line2}<br /></>}
              {order.address.landmark && <>Near {order.address.landmark}<br /></>}
              {order.address.city}, {order.address.state} {order.address.pincode}
            </address>
            <div className="mt-4"><CopyButton text={addressText} label="Copy address" /></div>
          </section>

          <section className={card}>
            <h2 className={`mb-3 ${eyebrow}`}>Payment</h2>
            <div className="flex items-center justify-between gap-3"><b>{cod ? 'Cash on delivery' : 'Paid online'}</b><PaymentBadge payment={order.payment} /></div>
            <p className="mt-2 text-[14px] text-ink/65">{order.payment.status === 'paid' ? (order.payment.paidAt ? `Paid ${fullDateTime(order.payment.paidAt)}.` : 'Payment received.') : cod ? `${inr(order.totals.total)} is collected by the courier on delivery.` : 'Waiting for payment.'}</p>
          </section>

          {(order.tracking || status === 'shipped' || status === 'delivered') && (
            <section className={card}>
              <h2 className={`mb-3 ${eyebrow}`}>Shipment</h2>
              {order.tracking ? (
                <>
                  <p className="font-bold">{order.tracking.carrier}</p>
                  <p className="break-all text-[14.5px] text-ink/70 tabular-nums">{order.tracking.number}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.tracking.url && <a href={order.tracking.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-olive">Track shipment <ExternalLink size={14} aria-hidden /></a>}
                    <CopyButton text={order.tracking.number} label="Copy number" />
                  </div>
                </>
              ) : <p className="text-[14px] text-ink/60">No tracking details.</p>}
            </section>
          )}
          <EmailsCard order={order} pending={pending} onResend={resend} />
          <button type="button" onClick={() => { setOrder(null); load() }} className="mx-auto flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink/50 hover:text-ink"><RefreshCw size={13} aria-hidden />Refresh this order</button>
        </div>
      </div>

      {dialog === 'ship' && <ShipDialog open onClose={() => setDialog(null)} order={order} onShip={(extra) => run(() => setOrderStatus(number, 'shipped', extra), 'Shipped. The tracking page now shows the courier details.', 'shipped')} />}
      {dialog === 'delivered' && (
        <ConfirmDialog open onClose={() => setDialog(null)} title="Mark delivered?" confirmLabel="Yes, delivered" busyLabel="Saving…" onConfirm={() => run(() => setOrderStatus(number, 'delivered'), 'Marked delivered.', 'delivered')}>
          <p>This closes the order and can’t be undone. The customer gets a “delivered” email.</p>{cod && order.payment.status !== 'paid' && <p>It’s cash on delivery: you can mark it paid right after.</p>}
        </ConfirmDialog>
      )}
      {dialog === 'cancel' && (
        <ConfirmDialog open danger onClose={() => setDialog(null)} title="Cancel this order?" confirmLabel="Cancel order" busyLabel="Cancelling…" reasonLabel="Reason" onConfirm={(reason) => run(() => cancelOrder(number, reason), 'Order cancelled and stock put back.', 'cancel')}>
          <p>{pieces} {pieces === 1 ? 'piece goes' : 'pieces go'} back into stock. This can’t be undone. The customer gets an email to say it’s cancelled{cod ? '' : order.payment.status === 'paid' ? ', and that a refund is on its way' : ''}.</p>
        </ConfirmDialog>
      )}
      {dialog === 'paid' && (
        <ConfirmDialog open onClose={() => setDialog(null)} title="Mark as paid?" confirmLabel="Yes, cash received" busyLabel="Saving…" onConfirm={() => run(() => markOrderPaid(number), 'Marked as paid.', 'paid')}>
          <p>Confirm that <b className="text-ink">{inr(order.totals.total)}</b> has been collected for this order.</p>
        </ConfirmDialog>
      )}
    </div>
  )
}
