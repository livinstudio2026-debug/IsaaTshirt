import { Check, LoaderCircle, Minus, RotateCw } from 'lucide-react'
import { card, eyebrow } from '../../components/orders/orderStyles'

// Which emails the customer should have had by now, and whether each one actually went out.
// The confirmation is sent at checkout and can't be re-sent from here; the others can.
const ROWS = [
  { id: 'customer', label: 'Order confirmation', when: () => true, resend: false },
  { id: 'shipped', label: 'Shipped', when: (s) => ['shipped', 'delivered'].includes(s), resend: true },
  { id: 'delivered', label: 'Delivered', when: (s) => s === 'delivered', resend: true },
  { id: 'cancelled', label: 'Cancelled', when: (s) => s === 'cancelled', resend: true },
]

export default function EmailsCard({ order, pending, onResend }) {
  const rows = ROWS.filter((r) => r.when(order.status))
  const missing = rows.some((r) => !order.emails[r.id])
  return (
    <section aria-label="Customer emails" className={card}>
      <h2 className={`mb-3 ${eyebrow}`}>Customer emails</h2>
      <ul className="divide-y divide-sand">
        {rows.map((r) => {
          const sent = Boolean(order.emails[r.id])
          const busy = pending === `email-${r.id}`
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2.5">
                <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-full ${sent ? 'bg-olive text-white' : 'bg-sand text-ink/45'}`}>{sent ? <Check size={14} strokeWidth={3} /> : <Minus size={14} strokeWidth={3} />}</span>
                <span className="min-w-0"><b className="block text-[14px] leading-tight">{r.label}</b><span className="text-[12.5px] text-ink/55">{sent ? 'Sent' : 'Not sent'}</span></span>
              </span>
              {r.resend && (
                <button type="button" onClick={() => onResend(r.id)} disabled={Boolean(pending)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink/20 px-3.5 text-[12px] font-bold hover:border-ink hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-50">
                  {busy ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <RotateCw size={13} aria-hidden />}{sent ? 'Send again' : 'Send now'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {missing && <p className="mt-3 text-[12.5px] leading-relaxed text-ink/55">“Not sent” means email isn’t set up on the server, or the mail server refused it. The order itself is fine.</p>}
    </section>
  )
}
