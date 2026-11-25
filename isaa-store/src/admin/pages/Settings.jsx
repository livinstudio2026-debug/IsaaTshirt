import { useEffect, useMemo, useState } from 'react'
import { Banknote, Info, LoaderCircle, RotateCcw, Truck } from 'lucide-react'
import { getStoreSettings, resetStoreSettings, saveStoreSettings } from '../../lib/adminApi'
import { inr } from '../../lib/format'
import { Field } from '../../components/form/Field'
import { useAdminPage } from '../useAdminPage'
import ConfirmDialog from '../orders/ConfirmDialog'
import { ago } from '../orders/format'
import { ErrorBanner, PageTitle, Switch } from '../products/ui'
import { useToast } from '../products/useToast'

// Store settings: the shipping and cash-on-delivery rules checkout uses. Owner only (the nav hides it from staff and the API refuses them).
// Everything here is whole rupees. The server applies a change to the very next checkout: no restart, no code edit.
const LIMITS = { freeShippingMin: 100000, shippingFee: 5000, codFee: 5000, codFreeMin: 100000 }
const KEYS = Object.keys(LIMITS)
const digits = (v) => String(v).replace(/\D/g, '').slice(0, 6)
const toForm = (s) => ({ freeShippingMin: String(s.freeShippingMin), shippingFee: String(s.shippingFee), codFee: String(s.codFee), codFreeMin: String(s.codFreeMin || ''), waive: s.codFreeMin > 0 })
const num = (v) => (v === '' ? NaN : Number(v))

function Card({ icon: Icon, title, hint, children }) {
  return (
    <section className="rounded-[24px] border border-sand bg-white/70 p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-olive/12 text-olive"><Icon size={20} /></span>
        <div className="min-w-0">
          <h2 className="text-[17px] font-black uppercase italic tracking-tight">{title}</h2>
          {hint && <p className="mt-1 text-[13.5px] leading-relaxed text-ink/60">{hint}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

const rupeeField = (id, label, form, set, errors, hint, extra = {}) => (
  <Field id={id} label={`${label} (₹)`} inputMode="numeric" autoComplete="off" value={form[id]} onChange={(e) => set({ [id]: digits(e.target.value) })} error={errors[id]} hint={hint} {...extra} />
)

// What a shopper pays for a few sample bags, using the numbers as typed (before saving): the quickest way to sanity-check a rule.
function Preview({ values }) {
  const { freeShippingMin: fs, shippingFee: ship, codFee, codFreeMin } = values
  const rows = useMemo(() => {
    if ([fs, ship, codFee, codFreeMin].some((n) => !Number.isFinite(n))) return []
    const low = Math.max(499, Math.round((Math.min(fs || 1499, codFreeMin || fs || 1499) * 0.6) / 50) * 50)
    const marks = [...new Set([low, fs || low + 500, codFreeMin > 0 ? codFreeMin : (fs || low) + 1000])].sort((a, b) => a - b).slice(0, 3)
    return marks.map((bag) => {
      const shipping = bag >= fs ? 0 : ship
      const cod = codFreeMin > 0 && bag >= codFreeMin ? 0 : codFee
      return { bag, shipping, cod, total: bag + shipping + cod }
    })
  }, [fs, ship, codFee, codFreeMin])
  if (!rows.length) return null
  return (
    <section aria-label="Preview" className="rounded-[24px] border border-sand bg-cream/70 p-5 sm:p-6">
      <h2 className="text-[17px] font-black uppercase italic tracking-tight">What a shopper pays on cash on delivery</h2>
      <p className="mt-1 text-[13.5px] text-ink/60">Three sample bags, using the numbers above. Updates as you type.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <li key={r.bag} className="rounded-2xl border border-sand bg-white/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">Bag of</p>
            <p className="text-[22px] font-black tabular-nums">{inr(r.bag)}</p>
            <dl className="mt-2 space-y-1 text-[13.5px]">
              <div className="flex justify-between"><dt className="text-ink/60">Shipping</dt><dd className="tabular-nums">{r.shipping ? inr(r.shipping) : <b className="text-olive">Free</b>}</dd></div>
              <div className="flex justify-between"><dt className="text-ink/60">COD fee</dt><dd className="tabular-nums">{r.cod ? inr(r.cod) : <b className="text-olive">{codFee ? 'Waived' : 'Free'}</b>}</dd></div>
              <div className="flex justify-between border-t border-sand pt-1.5 text-[15px] font-black"><dt>They pay</dt><dd className="tabular-nums">{inr(r.total)}</dd></div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function Settings() {
  useAdminPage('Settings')
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [tick, setTick] = useState(0)
  const [toast, say] = useToast()

  useEffect(() => {
    const ac = new AbortController()
    getStoreSettings(ac.signal).then(
      (s) => { setSaved(s); setForm(toForm(s)); setLoadError('') },
      (err) => { if (err.name !== 'AbortError') setLoadError(err.message) },
    )
    return () => ac.abort()
  }, [tick])

  const initial = useMemo(() => (saved ? toForm(saved) : null), [saved])
  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial))
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErrors((e) => { const n = { ...e }; for (const k of Object.keys(patch)) delete n[k]; return n }); setSaveError('') }

  // The numbers as the server will get them: with the waiver switched off the COD-free minimum is 0 ("never waived").
  const values = form && { freeShippingMin: num(form.freeShippingMin), shippingFee: num(form.shippingFee), codFee: num(form.codFee), codFreeMin: form.waive ? num(form.codFreeMin) : 0 }

  const submit = async (e) => {
    e?.preventDefault()
    if (saving || !dirty) return
    const found = {}
    for (const k of KEYS) {
      if (k === 'codFreeMin' && !form.waive) continue
      const n = values[k]
      if (!Number.isFinite(n)) found[k] = 'Enter an amount in rupees.'
      else if (n > LIMITS[k]) found[k] = `Keep it at ${inr(LIMITS[k])} or less.`
    }
    if (form.waive && !found.codFreeMin && values.codFreeMin < 1) found.codFreeMin = 'Enter the order value that skips the fee, or switch this off.'
    setErrors(found); setSaveError('')
    if (Object.keys(found).length) return
    setSaving(true)
    try {
      const s = await saveStoreSettings(values)
      setSaved(s); setForm(toForm(s))
      say('Saved. Shoppers see it on their next checkout.')
    } catch (err) {
      setErrors(err.fields ?? {})
      setSaveError(Object.keys(err.fields ?? {}).length ? 'Please fix the highlighted amounts.' : err.message)
    } finally { setSaving(false) }
  }

  if (loadError) return <div className="space-y-5"><PageTitle eyebrow="Store">Settings</PageTitle><ErrorBanner onRetry={() => { setLoadError(''); setTick((n) => n + 1) }}>{loadError}</ErrorBanner></div>
  if (!form) return <div aria-hidden className="space-y-4"><div className="h-12 w-1/2 animate-pulse rounded-2xl bg-sand/45" /><div className="h-56 animate-pulse rounded-[24px] bg-sand/45" /><div className="h-72 animate-pulse rounded-[24px] bg-sand/45" /></div>

  const d = saved.defaults
  return (
    <form onSubmit={submit} noValidate className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageTitle eyebrow="Store">Settings</PageTitle>
        {saved.customised && <button type="button" onClick={() => setConfirmReset(true)} className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 px-4 text-[12px] font-bold uppercase tracking-wide transition-colors hover:border-ink hover:bg-ink hover:text-white"><RotateCcw size={14} aria-hidden />Use the defaults</button>}
      </div>
      <p className="mt-4 max-w-2xl text-[14.5px] text-ink/65">The shipping and cash-on-delivery rules shoppers see at checkout. Change a number and the very next order follows it.{saved.updatedAt && <span className="text-ink/50"> Last changed {ago(saved.updatedAt)}{saved.updatedBy ? ` by ${saved.updatedBy}` : ''}.</span>}</p>

      {saveError && <div className="mt-5"><ErrorBanner>{saveError}</ErrorBanner></div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <Card icon={Truck} title="Shipping" hint="Orders at or above the minimum ship free. Below it, the shipping fee is added.">
          <div className="grid gap-x-4 sm:grid-cols-2">
            {rupeeField('freeShippingMin', 'Free shipping from', form, set, errors, `Default ${inr(d.freeShippingMin)}`)}
            {rupeeField('shippingFee', 'Shipping fee below it', form, set, errors, d.shippingFee ? `Default ${inr(d.shippingFee)}` : '₹0 means shipping is always free')}
          </div>
        </Card>

        <Card icon={Banknote} title="Cash on delivery" hint="A handling fee for COD orders, and the order value from which it is waived. Online payments never pay it.">
          {rupeeField('codFee', 'COD fee', form, set, errors, d.codFee ? `Default ${inr(d.codFee)}` : '₹0 means there is no COD fee at all')}
          <div className="mt-2 flex items-center justify-between gap-4 rounded-2xl border border-sand bg-white/60 px-4 py-3.5">
            <div className="min-w-0">
              <p className="text-[15px] font-bold leading-snug">Waive the COD fee on bigger orders</p>
              <p className="mt-0.5 text-[13px] text-ink/55">{form.waive ? 'On: orders at or above the amount below skip the fee.' : 'Off: every COD order pays the fee.'}</p>
            </div>
            <Switch checked={form.waive} onChange={(on) => set({ waive: on, ...(on && !form.codFreeMin ? { codFreeMin: String(num(form.freeShippingMin) || '') } : {}) })} label="Waive the COD fee on bigger orders" />
          </div>
          {form.waive && <div className="mt-4">{rupeeField('codFreeMin', 'COD is free from', form, set, errors, 'Compared with the bag total before shipping and fees')}</div>}
          {num(form.codFee) === 0 && form.waive && <p className="mt-2 flex items-start gap-2 text-[13px] text-amber-900"><Info size={15} className="mt-0.5 shrink-0" aria-hidden />The COD fee is ₹0, so there is nothing to waive yet.</p>}
        </Card>
      </div>

      <div className="mt-5"><Preview values={values} /></div>

      {dirty && (
        <div className="sticky bottom-[5.25rem] z-20 mt-6 md:bottom-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-full bg-ink px-3 py-2.5 pl-5 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,.6)]">
            <span className="text-[13.5px] font-medium">You have unsaved changes</span>
            <span className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => { setForm(initial); setErrors({}); setSaveError('') }} className="h-10 rounded-full px-4 text-[12px] font-bold uppercase tracking-wide text-white/80 hover:text-white disabled:opacity-50">Discard</button>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[12px] font-bold uppercase tracking-wide text-ink hover:bg-sand disabled:cursor-wait disabled:opacity-70">
                {saving ? <><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />Saving…</> : 'Save changes'}
              </button>
            </span>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Use the defaults?" confirmLabel="Use the defaults" busyLabel="Resetting…"
        onConfirm={async () => { const s = await resetStoreSettings(); setSaved(s); setForm(toForm(s)); setErrors({}); setConfirmReset(false); say('Back to the defaults.') }}>
        <p>Free shipping from {inr(d.freeShippingMin)}, shipping fee {inr(d.shippingFee)}, COD fee {inr(d.codFee)}{d.codFreeMin ? `, COD free from ${inr(d.codFreeMin)}` : ', never waived'}. These come from the server’s settings file.</p>
      </ConfirmDialog>
      {toast}
    </form>
  )
}
