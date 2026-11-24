import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, Copy, Mail, PackageCheck, PackageSearch, Truck } from 'lucide-react'
import { inr } from '../lib/format'
import { OrderItems, Totals, Address } from '../components/orders/OrderParts'
import { card, eyebrow } from '../components/orders/orderStyles'
import underline from '../assets/featuredDrop/underline-stroke.webp'

// The order the shopper just placed (saved by checkout). Opened without it (e.g. a bookmark), they're sent to tracking instead.
function readOrder(number) {
  try {
    const o = JSON.parse(sessionStorage.getItem('isaa:last-order'))
    return o?.orderNumber === number ? o : null
  } catch {
    return null
  }
}

const rise = (n) => ({ animationDelay: `${0.15 + n * 0.12}s` })
const riseCls = 'animate-[rise_.7s_cubic-bezier(.2,.7,.2,1)_both] motion-reduce:animate-none'

export default function OrderConfirmed() {
  const { number } = useParams()
  const [order] = useState(() => readOrder(number))
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    document.title = 'Order placed — Isaa'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  if (!order) return <Navigate to={`/track?order=${encodeURIComponent(number)}`} replace />

  const first = order.customer.name.split(' ')[0]
  const cod = order.payment.method === 'cod'
  const copy = async () => {
    try { await navigator.clipboard.writeText(order.orderNumber); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* the number is on screen to copy by hand */ }
  }
  const steps = [
    { Icon: Mail, title: 'Confirmation on its way', text: `We’re emailing the details to ${order.customer.email}.` },
    { Icon: PackageCheck, title: 'We pack your order', text: 'Each piece is checked and packed by hand.' },
    { Icon: Truck, title: 'It ships, you get a link', text: cod ? `Keep ${inr(order.totals.total)} ready to pay when it arrives.` : 'We’ll send tracking as soon as it leaves.' },
  ]

  return (
    <div className="mx-auto max-w-[1300px] px-5 pb-[12vw] pt-10 sm:pb-[6vw] lg:px-[6vw] lg:pb-[4vw] lg:pt-[3.5vw]">
      <header className="text-center">
        <div className="relative mx-auto grid size-24 place-items-center sm:size-28">
          <span aria-hidden className="absolute inset-0 animate-[ping_1.4s_ease-out_2] rounded-full bg-olive/20 motion-reduce:hidden" />
          <svg viewBox="0 0 52 52" className="relative size-full" fill="none" stroke="#6b6a22" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="26" cy="26" r="24" strokeDasharray="151" strokeDashoffset="151" className="animate-[draw_.8s_ease-out_forwards] motion-reduce:[stroke-dashoffset:0] motion-reduce:animate-none" />
            <path d="M15 27l8 8 14-16" strokeDasharray="40" strokeDashoffset="40" className="animate-[draw_.5s_ease-out_.6s_forwards] motion-reduce:[stroke-dashoffset:0] motion-reduce:animate-none" />
          </svg>
        </div>
        <p className={`mt-6 ${eyebrow} text-olive ${riseCls}`} style={rise(0)}>Order placed</p>
        <h1 className={`mt-2 font-black italic uppercase leading-[0.9] tracking-tight text-[13vw] sm:text-[8vw] lg:text-[5.2vw] ${riseCls}`} style={{ fontVariationSettings: '"wdth" 84', ...rise(1) }}>Thank you, {first}.</h1>
        <div className={`mt-2 inline-block -rotate-2 ${riseCls}`} style={rise(2)}>
          <p className="whitespace-nowrap font-script text-[8vw] leading-[1.1] text-olive sm:text-[5vw] lg:text-[2.6vw]">We’re on it</p>
          <img src={underline} alt="" aria-hidden className="mt-1 h-[1.8vw] w-[92%] object-fill sm:h-[1.1vw] lg:h-[0.8vw]" />
        </div>
        <div className={`mt-7 inline-flex items-center gap-3 rounded-full border border-sand bg-white/70 py-2 pl-6 pr-2 ${riseCls}`} style={rise(3)}>
          <span><span className="mr-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/50">Order</span><b className="text-[17px] tracking-wider tabular-nums">{order.orderNumber}</b></span>
          <button onClick={copy} aria-label="Copy order number" className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[12px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">
            {copied ? <><Check size={15} strokeWidth={2.8} /> Copied</> : <><Copy size={15} /> Copy</>}
          </button>
        </div>
        <p className={`mx-auto mt-3 max-w-md text-[14px] text-ink/60 ${riseCls}`} style={rise(4)}>Save this number. With your email, it’s all you need to track the order.</p>
      </header>

      <div className="mt-10 grid gap-6 lg:mt-[3vw] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:gap-[2.5vw]">
        <div className="space-y-6">
          <section aria-labelledby="next" className={`${card} ${riseCls}`} style={rise(5)}>
            <h2 id="next" className={`mb-5 ${eyebrow}`}>What happens next</h2>
            <ol className="space-y-5">
              {steps.map(({ Icon, title, text }, n) => (
                <li key={title} className="flex gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-olive/10 text-olive"><Icon size={20} aria-hidden /></span>
                  <span><b className="block leading-snug">{n + 1}. {title}</b><span className="text-[14px] text-ink/65">{text}</span></span>
                </li>
              ))}
            </ol>
          </section>
          <div className={`grid gap-6 sm:grid-cols-2 ${riseCls}`} style={rise(6)}>
            <section className={card}><h2 className={`mb-3 ${eyebrow}`}>Delivering to</h2><Address customer={order.customer} address={order.address} /></section>
            <section className={card}>
              <h2 className={`mb-3 ${eyebrow}`}>Payment</h2>
              <p className="font-bold">{cod ? 'Cash on delivery' : 'Paid online'}</p>
              <p className="mt-1 text-[14px] text-ink/65">{cod ? `Pay ${inr(order.totals.total)} when it arrives.` : 'Thanks, your payment is complete.'}</p>
              {order.notes && <><h3 className={`mb-1 mt-4 ${eyebrow}`}>Your note</h3><p className="text-[14px] text-ink/70">{order.notes}</p></>}
            </section>
          </div>
        </div>

        <section aria-labelledby="items" className={`${card} self-start ${riseCls}`} style={rise(5)}>
          <h2 id="items" className={`mb-5 ${eyebrow}`}>Your order</h2>
          <OrderItems items={order.items} />
          <div className="mt-6 border-t border-sand pt-5"><Totals totals={order.totals} /></div>
        </section>
      </div>

      <div className={`mt-10 flex flex-wrap justify-center gap-3 ${riseCls}`} style={rise(7)}>
        <Link to={`/track?order=${encodeURIComponent(order.orderNumber)}`} state={{ email: order.customer.email }} className="group inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">
          <PackageSearch size={18} aria-hidden /> Track order
        </Link>
        <Link to="/shop" className="group inline-flex items-center gap-3 rounded-full border border-ink px-8 py-4 text-[13px] font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white">
          Keep shopping <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  )
}
