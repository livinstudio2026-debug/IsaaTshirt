import { inr } from '../../lib/format'
import { lineTitle } from './orderStyles'

// Thumbnail + name + variant + price, used on the confirmation and tracking pages.
export function OrderItems({ items }) {
  return (
    <ul className="divide-y divide-sand">
      {items.map((i) => (
        <li key={`${i.slug}|${i.size}|${i.color}`} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
          <span className="relative block h-[4.5rem] w-16 shrink-0 rounded-xl bg-sand/45">
            {i.image && <img src={i.image} alt="" loading="lazy" className="size-full object-contain p-1" />}
            <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold leading-5 text-white tabular-nums">{i.qty}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold leading-snug">{lineTitle(i.name)}</span>
            <span className="block text-[13px] text-ink/60">{[i.color, i.size && `Size ${i.size}`].filter(Boolean).join(' · ')}</span>
          </span>
          <b className="shrink-0 tabular-nums">{inr(i.price * i.qty)}</b>
        </li>
      ))}
    </ul>
  )
}

export function Totals({ totals }) {
  const row = 'flex items-baseline justify-between gap-4'
  return (
    <dl className="space-y-2 text-[15px]">
      <div className={row}><dt className="text-ink/70">Subtotal</dt><dd className="tabular-nums">{inr(totals.subtotal)}</dd></div>
      <div className={row}><dt className="text-ink/70">Shipping</dt><dd className="tabular-nums">{totals.shipping ? inr(totals.shipping) : <span className="font-semibold text-olive">Free</span>}</dd></div>
      {totals.codFee > 0 && <div className={row}><dt className="text-ink/70">COD fee</dt><dd className="tabular-nums">{inr(totals.codFee)}</dd></div>}
      <div className={`${row} border-t border-sand pt-3 text-[19px] font-black`}><dt>Total</dt><dd className="tabular-nums">{inr(totals.total)}</dd></div>
    </dl>
  )
}

export function Address({ customer, address }) {
  return (
    <address className="not-italic leading-relaxed">
      <b>{customer.name}</b><br />
      {address.line1}<br />
      {address.line2 && <>{address.line2}<br /></>}
      {address.landmark && <>Near {address.landmark}<br /></>}
      {address.city}, {address.state} {address.pincode}<br />
      <span className="text-ink/60">{customer.phone}</span>
    </address>
  )
}
