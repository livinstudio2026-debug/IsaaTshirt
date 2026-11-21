import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { getOrder } from '../../lib/adminApi'
import { inr } from '../../lib/format'
import { lineTitle } from '../../components/orders/orderStyles'
import { useAdminPage } from '../useAdminPage'
import { fullDateTime } from '../orders/format'
import logo from '../../assets/logo/logo.webp'

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL || ''

// One printable page per order: what goes in the box and where it goes. Open it from the order page, then print or save as PDF.
export default function PackingSlip() {
  const { number } = useParams()
  const [params] = useSearchParams()
  useAdminPage(`Packing slip ${number}`)
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const ac = new AbortController()
    getOrder(number, ac.signal).then(setOrder, (err) => { if (err.name !== 'AbortError') setError(err.status === 404 ? 'We couldn’t find that order.' : err.message) })
    return () => ac.abort()
  }, [number])

  // arriving from "Print packing slip": open the print box once the page (and logo) are ready
  const wantsPrint = params.get('print') === '1'
  useEffect(() => {
    if (!order || !wantsPrint) return
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [order, wantsPrint])

  if (error) return <div className="grid min-h-svh place-items-center bg-cream p-6 text-center"><div><p className="text-[18px] font-black uppercase italic">{error}</p><Link to="/admin/orders" className="mt-4 inline-block rounded-full border border-ink px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide hover:bg-ink hover:text-white">All orders</Link></div></div>
  if (!order) return <div className="grid min-h-svh place-items-center bg-cream" role="status" aria-label="Loading"><img src={logo} alt="" className="h-10 w-auto animate-pulse" /></div>

  const pieces = order.items.reduce((n, i) => n + i.qty, 0)
  const cod = order.payment.method === 'cod'
  const owing = cod && order.payment.status !== 'paid'
  const a = order.address

  return (
    <div className="min-h-svh bg-[#e9e4da] px-4 py-6 print:bg-white print:p-0">
      <style>{'@page { size: A4; margin: 12mm } @media print { html, body { background: #fff !important } }'}</style>

      <div className="mx-auto mb-5 flex max-w-[210mm] items-center justify-between gap-3 print:hidden">
        <Link to={`/admin/orders/${order.orderNumber}`} className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-ink/70 hover:text-ink"><ArrowLeft size={15} aria-hidden />Back to order</Link>
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-olive"><Printer size={16} aria-hidden />Print or save as PDF</button>
      </div>

      <article aria-label={`Packing slip for ${order.orderNumber}`} className="mx-auto max-w-[210mm] bg-white p-[10mm] text-[13px] leading-snug text-black shadow-[0_20px_50px_-25px_rgba(0,0,0,.4)] sm:p-[14mm] print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-5">
          <img src={logo} alt="Isaa" width="2114" height="744" className="h-9 w-auto" />
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-black/60">Packing slip</p>
            <p className="mt-1 text-[22px] font-black tracking-wider tabular-nums">{order.orderNumber}</p>
            <p className="text-[12px] text-black/60">{fullDateTime(order.createdAt)}</p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/55">Ship to</h2>
            <address className="mt-2 text-[15px] not-italic leading-relaxed">
              <b className="text-[17px]">{order.customer.name}</b><br />
              {a.line1}<br />
              {a.line2 && <>{a.line2}<br /></>}
              {a.landmark && <>Near {a.landmark}<br /></>}
              {a.city}, {a.state}<br />
              <b className="text-[17px] tracking-wider tabular-nums">{a.pincode}</b><br />
              <span className="tabular-nums">Phone: {order.customer.phone}</span>
            </address>
          </div>
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/55">Payment</h2>
            {owing ? (
              <p className="mt-2 inline-block border-2 border-black px-3 py-2"><span className="block text-[11px] font-bold uppercase tracking-[0.18em]">Cash on delivery</span><b className="block text-[22px] tabular-nums">Collect {inr(order.totals.total)}</b></p>
            ) : (
              <p className="mt-2 text-[15px]"><b>{cod ? 'Cash on delivery: paid' : 'Paid online'}</b><br /><span className="text-black/60">Nothing to collect.</span></p>
            )}
            {order.tracking && <p className="mt-3 text-[13px]"><b>{order.tracking.carrier}</b> · <span className="tabular-nums">{order.tracking.number}</span></p>}
          </div>
        </section>

        <section className="mt-7">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/55">In the box · {pieces} {pieces === 1 ? 'piece' : 'pieces'}</h2>
          <table className="mt-2 w-full border-collapse text-left">
            <thead>
              <tr className="border-y-2 border-black text-[11px] font-bold uppercase tracking-[0.14em]">
                <th scope="col" className="w-9 py-2"><span className="sr-only">Packed</span></th>
                <th scope="col" className="py-2">Item</th><th scope="col" className="py-2">Colour</th><th scope="col" className="py-2 text-center">Size</th><th scope="col" className="py-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((i) => (
                <tr key={`${i.slug}|${i.size}|${i.color}`} className="border-b border-black/25 align-middle">
                  <td className="py-3"><span aria-hidden className="block size-5 border-2 border-black" /></td>
                  <td className="py-3 pr-3 text-[15px] font-bold">{lineTitle(i.name)}</td>
                  <td className="py-3 pr-3">{i.color || '—'}</td>
                  <td className="py-3 text-center text-[17px] font-black">{i.size}</td>
                  <td className="py-3 text-right text-[17px] font-black tabular-nums">× {i.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {order.notes && (
          <section className="mt-6 border border-black/40 p-3">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-black/55">Note from the customer</h2>
            <p className="mt-1 whitespace-pre-wrap text-[14px]">{order.notes}</p>
          </section>
        )}

        <footer className="mt-10 flex items-end justify-between gap-6 border-t-2 border-black pt-5">
          <div>
            <p className="text-[16px] font-black italic uppercase tracking-tight">Thank you for shopping with Isaa.</p>
            <p className="mt-1 text-[12px] text-black/65">Questions about your order? Quote {order.orderNumber}{CONTACT ? ` and write to ${CONTACT}` : ' and get in touch through our Contact page'}.</p>
          </div>
          <p className="shrink-0 text-[11px] text-black/55">Packed by ____________ &nbsp; Checked ☐</p>
        </footer>
      </article>
    </div>
  )
}
