import { useState } from 'react'
import { CircleAlert, LoaderCircle, Truck } from 'lucide-react'
import { Field } from '../../components/form/Field'
import { Dialog } from './shared'

const CARRIERS = ['India Post', 'DTDC', 'Delhivery', 'Blue Dart', 'Ecom Express', 'XpressBees', 'Shadowfax', 'Amazon Shipping', 'Professional Couriers']
const KEY = 'isaa_last_carrier'
const lastCarrier = () => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } }

// "Ship order": the courier, tracking number and link are required, and they go to the customer by email (when email is set up).
export default function ShipDialog({ open, onClose, order, onShip }) {
  const [carrier, setCarrier] = useState(lastCarrier)
  const [number, setNumber] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const clear = (k) => setErrors((s) => ({ ...s, [k]: '' }))

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    const next = {}
    const link = url.trim() && !/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim()
    if (!carrier.trim()) next.carrier = 'Enter the courier name.'
    if (!number.trim()) next.number = 'Enter the tracking number.'
    if (!link) next.url = 'Paste the tracking link.'
    else { try { new URL(link) } catch { next.url = 'That doesn’t look like a link.' } }
    setErrors(next); setError('')
    if (Object.keys(next).length) return document.getElementById(next.carrier ? 'ship-carrier' : next.number ? 'ship-number' : 'ship-url')?.focus()

    setBusy(true)
    try {
      await onShip({ tracking: { carrier: carrier.trim(), number: number.trim(), url: link }, ...(note.trim() ? { note: note.trim() } : {}) })
      try { localStorage.setItem(KEY, carrier.trim()) } catch { /* optional convenience */ }
    } catch (err) {
      setBusy(false)
      const f = err.fields ?? {}
      setErrors({ carrier: f['tracking.carrier'], number: f['tracking.number'], url: f['tracking.url'] })
      setError(Object.values(f).length ? '' : err.message)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Ship order" busy={busy} wide>
      <form onSubmit={submit} noValidate>
        <span className="grid size-12 place-items-center rounded-full bg-ink text-white"><Truck size={22} aria-hidden /></span>
        <h2 className="mt-4 text-[26px] font-black uppercase italic leading-none tracking-tight">Ship order</h2>
        <p className="mt-2 text-[14px] text-ink/65">{order.orderNumber} · {order.customer.name}. The customer sees these details on the tracking page{' '}and gets them by email.</p>

        {error && <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />{error}</p>}

        <div className="mt-5">
          <Field id="ship-carrier" label="Courier" list="ship-carriers" autoComplete="off" maxLength={40} value={carrier} onChange={(e) => { setCarrier(e.target.value); clear('carrier') }} error={errors.carrier} readOnly={busy} />
          <datalist id="ship-carriers">{CARRIERS.map((c) => <option key={c} value={c} />)}</datalist>
          <Field id="ship-number" label="Tracking number" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={60} value={number} onChange={(e) => { setNumber(e.target.value); clear('number') }} error={errors.number} readOnly={busy} />
          <Field id="ship-url" label="Tracking link" type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={500} value={url} onChange={(e) => { setUrl(e.target.value); clear('url') }} error={errors.url} hint="From the courier’s website or the booking receipt." readOnly={busy} />
          <Field id="ship-note" label="Internal note" optional maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} hint="Only your team sees this." readOnly={busy} />
        </div>

        <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="h-12 rounded-full border border-ink/25 px-6 text-[13px] font-bold uppercase tracking-wide hover:border-ink disabled:opacity-50">Not yet</button>
          <button type="submit" disabled={busy} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive disabled:cursor-wait disabled:opacity-80">
            {busy ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden />Shipping…</> : 'Mark as shipped'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
