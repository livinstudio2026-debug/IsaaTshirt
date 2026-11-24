import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Banknote, ChevronDown, CircleAlert, CreditCard, LoaderCircle, Lock, RotateCcw, RotateCw, ShoppingBag } from 'lucide-react'
import { useCart } from '../lib/cartContext'
import { useStoreConfig } from '../hooks/useStoreConfig'
import { fetchProduct, placeOrder } from '../lib/api'
import { inr } from '../lib/format'
import { Field, SelectField } from '../components/form/Field'
import { ShippingProgress } from '../components/CartDrawer'
import { lineTitle, card } from '../components/orders/orderStyles'
import hanger from '../assets/featuredDrop/hanger.webp'
import underline from '../assets/featuredDrop/underline-stroke.webp'

// ---------------------------------------------------------------- validation (mirrors the server's rules)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const cleanPhone = (v) => v.replace(/[\s()-]/g, '').replace(/^(?:\+91|91|0)(?=\d{10}$)/, '')
const RULES = {
  name: (v) => (v.trim().length < 2 ? 'Please enter your full name' : ''),
  phone: (v) => (/^[6-9]\d{9}$/.test(cleanPhone(v.trim())) ? '' : 'Enter a valid 10-digit mobile number'),
  email: (v) => (EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email'),
  line1: (v) => (v.trim().length < 5 ? 'Please enter your house / street address' : ''),
  city: (v) => (v.trim().length < 2 ? 'Please enter your city' : ''),
  state: (v, states) => (states.includes(v) ? '' : 'Please choose your state'),
  pincode: (v) => (/^[1-9]\d{5}$/.test(v.trim()) ? '' : 'Enter a valid 6-digit pincode'),
}
const ORDER = ['name', 'phone', 'email', 'line1', 'line2', 'landmark', 'city', 'state', 'pincode']
const EMPTY = { name: '', phone: '', email: '', line1: '', line2: '', landmark: '', city: '', state: '', pincode: '', notes: '', payment: 'cod', website: '' }
const FORM_KEY = 'isaa:checkout:v1'

const loadForm = () => { try { return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(FORM_KEY)), website: '' } } catch { return { ...EMPTY } } }
const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, '')

const issueOf = (live, l) => {
  const p = live[l.slug]
  if (p === null) return { kind: 'gone', text: 'No longer available' }
  if (!p) return null // not checked yet, or the check failed: the server has the final say
  const s = p.sizes.find((x) => x.size === l.size)
  if (!s || s.stock <= 0) return { kind: 'soldout', text: `Sold out in ${l.size}` }
  if (l.qty > s.stock) return { kind: 'low', stock: s.stock, text: `Only ${s.stock} left in ${l.size}` }
  return null
}

function Step({ n, title, children }) {
  return (
    <section aria-labelledby={`step-${n}`} className={card}>
      <h2 id={`step-${n}`} className="mb-5 flex items-center gap-3 text-[13px] font-bold uppercase tracking-[0.16em]">
        <span className="grid size-8 place-items-center rounded-full bg-olive text-[13px] text-white tabular-nums">{n}</span>{title}
      </h2>
      {children}
    </section>
  )
}

function Notice({ children, action }) {
  return (
    <div role="alert" className="grid min-h-[40vh] place-items-center px-6 py-[10vw] text-center">
      <div className="max-w-sm">{children}{action}</div>
    </div>
  )
}

export default function Checkout() {
  const { lines, subtotal, setQty, remove, clear, sync } = useCart()
  const { config, status, retry } = useStoreConfig()
  const nav = useNavigate()

  const [values, setValues] = useState(loadForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [conflicts, setConflicts] = useState(null)
  const [showSummary, setShowSummary] = useState(false)
  const [live, setLive] = useState({}) // slug -> product | null (gone) | undefined (unknown)
  const [recheck, setRecheck] = useState(0)
  const key = useRef({ sig: '', id: '' })
  const alertRef = useRef(null)

  useEffect(() => { document.title = 'Checkout — Isaa' }, [])
  useEffect(() => { try { sessionStorage.setItem(FORM_KEY, JSON.stringify({ ...values, website: '' })) } catch { /* ignore */ } }, [values])

  // what's in the bag right now: current price and stock for every piece, before the shopper commits
  const slugs = useMemo(() => [...new Set(lines.map((l) => l.slug))].sort().join(','), [lines])
  useEffect(() => {
    if (!slugs) return
    const ctl = new AbortController()
    Promise.all(slugs.split(',').map(async (slug) => {
      try { return [slug, await fetchProduct(slug, ctl.signal)] } catch (e) { return e.name === 'AbortError' ? null : [slug, e.status === 404 ? null : undefined] }
    })).then((entries) => {
      if (ctl.signal.aborted) return
      const map = Object.fromEntries(entries.filter(Boolean))
      setLive(map)
      sync(Object.fromEntries(Object.entries(map).filter(([, p]) => p).map(([s, p]) => [s, { price: p.price, mrp: p.mrp, img: p.img, heroes: Object.fromEntries(p.colors.map((c) => [c.name, c.img])) }])))
    })
    return () => ctl.abort()
  }, [slugs, recheck, sync])

  const issues = lines.map((l) => [l, issueOf(live, l)]).filter(([, i]) => i)
  const fixBag = () => {
    for (const [l, i] of issues) i.kind === 'low' ? setQty(l.id, i.stock) : remove(l.id)
    setConflicts(null)
  }

  const states = config?.states ?? []
  const cod = config?.payments.cod
  const shipping = config ? (subtotal >= config.freeShippingMin ? 0 : config.shippingFee) : 0
  const codFee = config && values.payment === 'cod' ? config.codFee : 0
  const total = subtotal + shipping + codFee

  const set = (k) => (e) => {
    const v = k === 'pincode' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value
    setValues((s) => ({ ...s, [k]: v }))
    if (errors[k]) setErrors((s) => ({ ...s, [k]: '' }))
  }
  const check = (k) => () => { const msg = RULES[k]?.(values[k], states); if (msg) setErrors((s) => ({ ...s, [k]: msg })) }
  const field = (k) => ({ value: values[k], onChange: set(k), onBlur: check(k), error: errors[k] })
  const focusFirst = (errs) => { const first = ORDER.find((k) => errs[k]); if (first) document.getElementById(first)?.focus() }

  async function submit(e) {
    e.preventDefault()
    if (submitting) return
    const errs = Object.fromEntries(Object.keys(RULES).map((k) => [k, RULES[k](values[k], states)]).filter(([, m]) => m))
    setErrors(errs); setServerError('')
    if (Object.keys(errs).length) return focusFirst(errs)
    if (issues.length) { alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }

    // one key per distinct bag: a double-click or retry returns the same order instead of a second one
    const sig = lines.map((l) => `${l.id}x${l.qty}`).join('|')
    if (key.current.sig !== sig) key.current = { sig, id: newKey() }

    setSubmitting(true)
    try {
      const order = await placeOrder({
        items: lines.map(({ slug, size, color, qty }) => ({ slug, size, color: color ?? '', qty })),
        customer: { name: values.name.trim(), phone: values.phone.trim(), email: values.email.trim() },
        address: { line1: values.line1.trim(), line2: values.line2.trim(), landmark: values.landmark.trim(), city: values.city.trim(), state: values.state, pincode: values.pincode.trim() },
        notes: values.notes.trim(),
        paymentMethod: values.payment,
        idempotencyKey: key.current.id,
        website: values.website,
      })
      try { sessionStorage.setItem('isaa:last-order', JSON.stringify(order)); sessionStorage.removeItem(FORM_KEY) } catch { /* the page can still look it up by email */ }
      nav(`/order/${order.orderNumber}`, { replace: true })
      clear()
    } catch (err) {
      setSubmitting(false)
      if (err.status === 409 && err.details) { setConflicts(err.details); setRecheck((n) => n + 1); alertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
      const fe = Object.fromEntries(Object.entries(err.fields ?? {}).map(([p, m]) => [p.split('.').pop(), m]))
      if (Object.keys(fe).length) { setErrors(fe); focusFirst(fe) }
      else setServerError(err.message)
    }
  }

  // ---- states other than the form ----
  if (lines.length === 0) {
    return (
      <Notice action={<Link to="/shop" className="group mt-7 inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Shop the drop <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" /></Link>}>
        <img src={hanger} alt="" aria-hidden width="1150" height="697" className="mx-auto w-28 origin-top animate-[swing_4s_ease-in-out_infinite] motion-reduce:animate-none" />
        <h1 className="mt-4 text-2xl font-black italic uppercase tracking-tight" style={{ fontVariationSettings: '"wdth" 84' }}>Your bag is empty</h1>
        <p className="mt-1 text-ink/60">Add something to your bag and come back to check out.</p>
      </Notice>
    )
  }
  if (status !== 'ready') {
    return status === 'loading' ? (
      <div aria-busy className="grid min-h-[50vh] place-items-center"><p className="animate-pulse text-sm font-semibold uppercase tracking-[0.2em] text-ink/40">Getting checkout ready…</p></div>
    ) : (
      <Notice action={<button onClick={retry} className="mt-5 inline-flex items-center gap-2 rounded-full border border-ink px-6 py-3 text-sm font-bold uppercase tracking-wide transition-colors hover:bg-ink hover:text-white"><RotateCw size={16} /> Try again</button>}>
        <p className="font-bold">We couldn’t load checkout.</p>
        <p className="mt-1 text-sm text-ink/60">Check your connection and try again. Your bag is safe.</p>
      </Notice>
    )
  }

  const submitLabel = submitting ? <><LoaderCircle size={18} className="animate-spin" aria-hidden /> Placing your order…</> : <>Place order <span aria-hidden className="h-4 w-px bg-white/35" /> <span className="tabular-nums">{inr(total)}</span></>
  const placeBtn = (cls) => (
    <button type="submit" form="checkout-form" disabled={submitting} className={`group inline-flex items-center justify-center gap-3 rounded-full bg-ink text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive active:scale-[.98] disabled:cursor-wait disabled:bg-ink/70 ${cls}`}>{submitLabel}</button>
  )
  const conflictFor = (l) => conflicts?.find((c) => c.slug === l.slug && c.size === l.size)

  return (
    <div className="mx-auto max-w-[1500px] px-5 pb-32 pt-8 sm:pt-10 lg:px-[6vw] lg:pb-[5vw] lg:pt-[3vw]">
      <header className="mb-8 lg:mb-[2.4vw]">
        <nav aria-label="Breadcrumb" className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink/50"><Link to="/shop" className="transition-colors hover:text-ink">Shop</Link> <span aria-hidden>/</span> <span className="text-ink">Checkout</span></nav>
        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-1">
          <h1 className="font-black italic uppercase leading-[0.9] tracking-tight text-[13vw] sm:text-[9vw] lg:text-[5.4vw]" style={{ fontVariationSettings: '"wdth" 84' }}>Checkout</h1>
          <div className="mb-[0.4vw] inline-block -rotate-2">
            <p className="whitespace-nowrap font-script text-[7vw] leading-[1.1] text-olive sm:text-[4.5vw] lg:text-[2.4vw]">Almost yours</p>
            <img src={underline} alt="" aria-hidden className="mt-1 h-[1.6vw] w-[92%] object-fill sm:h-[1vw] lg:h-[0.7vw]" />
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] lg:gap-[3.5vw]">
        {/* ------------------------------------------------ order summary (collapsible on phones, sticky on desktop) */}
        <aside aria-label="Order summary" className="lg:order-2 lg:sticky lg:top-28 lg:self-start">
          <div className={`${card} !p-0 overflow-hidden`}>
            <button type="button" onClick={() => setShowSummary((v) => !v)} aria-expanded={showSummary} className="flex w-full items-center justify-between gap-4 px-5 py-4 lg:hidden">
              <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em]"><ShoppingBag size={18} aria-hidden /> {showSummary ? 'Hide' : 'Show'} order summary <ChevronDown size={16} aria-hidden className={`transition-transform duration-300 ${showSummary ? 'rotate-180' : ''}`} /></span>
              <b className="tabular-nums">{inr(total)}</b>
            </button>
            <div className={`${showSummary ? 'block' : 'hidden'} border-t border-sand p-5 sm:p-7 lg:block lg:border-0`}>
              <h2 className="mb-5 hidden text-[13px] font-bold uppercase tracking-[0.16em] lg:block">Order summary</h2>
              <ul className="divide-y divide-sand">
                {lines.map((l) => {
                  const issue = issueOf(live, l)
                  return (
                    <li key={l.id} className="flex gap-4 py-4 first:pt-0">
                      <span className="relative block h-[5rem] w-[4.5rem] shrink-0 rounded-xl bg-sand/45">
                        <img src={l.img} alt="" className="size-full object-contain p-1" />
                        <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-ink px-1 text-[11px] font-bold leading-5 text-white tabular-nums">{l.qty}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold leading-snug">{lineTitle(l.name)}</span>
                        <span className="block text-[13px] text-ink/60">{[l.color, l.size && `Size ${l.size}`].filter(Boolean).join(' · ')}</span>
                        {(issue || conflictFor(l)) && <span className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-red-700"><CircleAlert size={14} aria-hidden />{issue?.text ?? (conflictFor(l).available ? `Only ${conflictFor(l).available} left` : 'Sold out')}</span>}
                        <span className="mt-1.5 inline-flex h-8 items-center rounded-full border border-ink/20 text-[13px]">
                          <button type="button" aria-label="Decrease quantity" disabled={l.qty <= 1} onClick={() => setQty(l.id, l.qty - 1)} className="grid h-full w-8 place-items-center rounded-full transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30">−</button>
                          <output className="w-6 text-center font-bold tabular-nums">{l.qty}</output>
                          <button type="button" aria-label="Increase quantity" disabled={l.qty >= (config?.maxQty ?? 10)} onClick={() => setQty(l.id, l.qty + 1)} className="grid h-full w-8 place-items-center rounded-full transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30">+</button>
                        </span>
                      </span>
                      <span className="shrink-0 text-right leading-tight"><b className="block tabular-nums">{inr(l.price * l.qty)}</b>{l.mrp > l.price && <s className="text-[12px] tabular-nums text-ink/40">{inr(l.mrp * l.qty)}</s>}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-5 rounded-2xl bg-sand/40 p-4"><ShippingProgress subtotal={subtotal} min={config.freeShippingMin} /></div>
              <dl className="mt-5 space-y-2 text-[15px]">
                <div className="flex justify-between"><dt className="text-ink/70">Subtotal</dt><dd className="tabular-nums">{inr(subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink/70">Shipping</dt><dd className="tabular-nums">{shipping ? inr(shipping) : <span className="font-semibold text-olive">Free</span>}</dd></div>
                {codFee > 0 && <div className="flex justify-between"><dt className="text-ink/70">COD fee</dt><dd className="tabular-nums">{inr(codFee)}</dd></div>}
                <div className="flex items-baseline justify-between border-t border-sand pt-3 text-[20px] font-black"><dt>Total</dt><dd className="tabular-nums">{inr(total)}</dd></div>
              </dl>
              {placeBtn('mt-6 hidden h-14 w-full lg:flex lg:h-[clamp(56px,3.6vw,68px)]')}
              <p className="mt-4 flex items-center justify-center gap-2 text-center text-[13px] text-ink/55"><Lock size={14} aria-hidden /> Your details are only used to deliver your order.</p>
              <p className="mt-1.5 flex items-center justify-center gap-2 text-center text-[13px] text-ink/55"><RotateCcw size={14} aria-hidden /> Easy returns within 7 days.</p>
            </div>
          </div>
        </aside>

        {/* ------------------------------------------------ the form */}
        <form id="checkout-form" onSubmit={submit} noValidate className="space-y-6 lg:order-1">
          <div ref={alertRef}>
            {(issues.length > 0 || conflicts) && (
              <div role="alert" className="rounded-[22px] border border-red-600/30 bg-red-50/70 p-5">
                <p className="flex items-center gap-2 font-bold text-red-800"><CircleAlert size={18} aria-hidden /> Some pieces in your bag changed</p>
                <p className="mt-1 text-[14px] text-red-900/80">{issues.length ? 'Check the items marked in your order summary.' : 'Someone bought them while you were checking out.'} Update your bag and we’ll keep the rest.</p>
                <button type="button" onClick={fixBag} className="mt-3 rounded-full bg-red-800 px-5 py-2.5 text-[12px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-900">Update my bag</button>
              </div>
            )}
          </div>

          <Step n="1" title="Contact">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field id="name" label="Full name" autoComplete="name" className="sm:col-span-2" {...field('name')} />
              <Field id="phone" label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" hint="For delivery updates only." {...field('phone')} />
              <Field id="email" label="Email" type="email" inputMode="email" autoComplete="email" hint="Your confirmation and tracking link go here." {...field('email')} />
            </div>
          </Step>

          <Step n="2" title="Delivery address">
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Field id="line1" label="House no., building, street" autoComplete="address-line1" className="sm:col-span-2" {...field('line1')} />
              <Field id="line2" label="Area, locality" optional autoComplete="address-line2" className="sm:col-span-2" {...field('line2')} />
              <Field id="landmark" label="Landmark" optional autoComplete="off" className="sm:col-span-2" {...field('landmark')} />
              <Field id="pincode" label="Pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} {...field('pincode')} />
              <Field id="city" label="City" autoComplete="address-level2" {...field('city')} />
              <SelectField id="state" label="State" options={states} autoComplete="address-level1" className="sm:col-span-2" {...field('state')} />
              <Field id="notes" label="Delivery note" optional multiline maxLength={300} className="sm:col-span-2" value={values.notes} onChange={set('notes')} />
            </div>
          </Step>

          <Step n="3" title="Payment">
            <fieldset>
              <legend className="sr-only">Payment method</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { id: 'cod', Icon: Banknote, title: 'Cash on delivery', note: config.codFee ? `Pay in cash when it arrives (+${inr(config.codFee)} COD fee)` : 'Pay in cash when it arrives', on: cod.enabled },
                  { id: 'online', Icon: CreditCard, title: 'UPI, cards & net banking', note: 'Pay securely online', on: config.payments.online.enabled },
                ].map(({ id, Icon, title, note, on }) => (
                  <label key={id} className={`relative flex items-start gap-3 rounded-2xl border p-4 transition-[border-color,box-shadow,background-color] duration-200 ${on ? 'cursor-pointer hover:border-ink/40' : 'cursor-not-allowed opacity-60'} ${values.payment === id && on ? 'border-olive bg-white shadow-[0_0_0_4px_rgba(107,106,34,.14)]' : 'border-sand bg-white/60'}`}>
                    <input type="radio" name="payment" value={id} disabled={!on} checked={values.payment === id} onChange={set('payment')} className="peer sr-only" />
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full ${values.payment === id && on ? 'bg-olive text-white' : 'bg-sand/60 text-ink/70'}`}><Icon size={20} aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-bold leading-snug">{title}{!on && <span className="rounded-full bg-ink/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">Coming soon</span>}</span>
                      <span className="mt-0.5 block text-[13px] text-ink/60">{note}</span>
                    </span>
                    <span aria-hidden className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-olive ${values.payment === id && on ? 'border-olive' : 'border-ink/25'}`}>{values.payment === id && on && <span className="size-2.5 rounded-full bg-olive" />}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {/* honeypot: people never see this */}
            <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" name="website" value={values.website} onChange={set('website')} /></label></div>
          </Step>

          {serverError && <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-600/30 bg-red-50/70 p-4 text-[14px] font-medium text-red-800"><CircleAlert size={18} className="mt-px shrink-0" aria-hidden />{serverError}</p>}
        </form>
      </div>

      {/* phones: total and the button stay in reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-cream/95 px-5 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <p className="leading-tight"><span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">Total</span><b className="text-xl tabular-nums">{inr(total)}</b></p>
          {placeBtn('h-14 flex-1')}
        </div>
      </div>
    </div>
  )
}
