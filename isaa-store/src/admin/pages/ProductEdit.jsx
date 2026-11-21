import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CircleAlert, ExternalLink, Lock, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { createProduct, deleteProduct, getProduct, setProductVisibility, updateProduct } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { inr } from '../../lib/format'
import { Field } from '../../components/form/Field'
import { useAdminPage } from '../useAdminPage'
import ConfirmDialog from '../orders/ConfirmDialog'
import { bySize, CATEGORIES, COLOR_PRESETS, PLACEMENTS, SIZE_GROUPS, SUGGESTED_SIZES } from '../products/catalog'
import { ErrorBanner, StockBadge, Switch } from '../products/ui'
import { useToast } from '../products/useToast'
import ImageUploader from '../products/ImageUploader'
import SizeStock from '../products/SizeStock'

const NO_PLACEMENTS = { hero: false, featured: false, bestsellers: false, newarrivals: false }
const EMPTY = { name: '', description: '', category: 't-shirts', price: '', mrp: '', colors: [{ name: '', hex: '#1b1b1b' }], sizes: [], images: [], isLimited: false, isActive: true, placements: NO_PLACEMENTS }
const fromProduct = (p) => ({
  name: p.name, description: p.description, category: p.category, price: String(p.price), mrp: String(p.mrp),
  colors: p.colors.map((c) => ({ ...c })), sizes: p.sizes.map((s) => ({ size: s.size, stock: String(s.stock) })), images: p.images.map((i) => ({ ...i })),
  isLimited: p.isLimited, isActive: p.isActive, placements: Object.fromEntries(PLACEMENTS.map((x) => [x.id, p.placements[x.id] != null])),
})
const wholeStock = (v) => /^\d{1,4}$/.test(String(v).trim())

function validate(f) {
  const e = {}
  if (f.name.trim().length < 2) e.name = 'Enter the product name.'
  const price = Number(f.price), mrp = Number(f.mrp)
  if (!f.price.trim() || !(price > 0)) e.price = 'Enter the selling price in rupees.'
  if (!f.mrp.trim() || !(mrp > 0)) e.mrp = 'Enter the MRP in rupees.'
  else if (!e.price && mrp < price) e.mrp = 'MRP can’t be lower than the price.'
  if (f.colors.some((c) => !c.name.trim())) e.colors = 'Give every colour a name.'
  if (!f.sizes.length) e.sizes = 'Pick at least one size.'
  else if (f.sizes.some((s) => !wholeStock(s.stock))) e.sizes = 'Stock must be a whole number (0 to 9999).'
  if (!f.images.length) e.images = 'Add at least the front picture.'
  return e
}

// server errors come as { 'colors.0.hex': 'msg', mrp: 'msg' }: show each under its section
const toSectionErrors = (fields = {}) => { const out = {}; for (const [path, msg] of Object.entries(fields)) out[path.split('.')[0]] ??= msg; return out }

function Card({ id, title, hint, children, className = '' }) {
  return (
    <section id={id} className={`rounded-[24px] border border-sand bg-white/70 p-5 sm:p-6 ${className}`}>
      <h2 className="text-[17px] font-black uppercase italic tracking-tight">{title}</h2>
      {hint && <p className="mt-1 text-[13.5px] text-ink/60">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
const SectionError = ({ children }) => (children ? <p role="alert" className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-red-700"><CircleAlert size={14} className="shrink-0" aria-hidden />{children}</p> : null)

function Editor({ slug }) {
  const isNew = !slug
  const { admin } = useAdminAuth()
  const isOwner = admin.role === 'owner'
  const ro = !isOwner
  const nav = useNavigate()
  const loc = useLocation()
  const [toast, say] = useToast()
  const [product, setProduct] = useState(null)
  const [form, setForm] = useState(isNew ? EMPTY : null)
  const [initial, setInitial] = useState(isNew ? EMPTY : null)
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [togglingLive, setTogglingLive] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tick, setTick] = useState(0)
  useAdminPage(isNew ? 'New product' : form?.name || 'Product')

  useEffect(() => {
    if (isNew) return
    const ac = new AbortController()
    getProduct(slug, ac.signal).then(
      (p) => { setProduct(p); const f = fromProduct(p); setForm(f); setInitial(f); setLoadError('') },
      (err) => { if (err.name !== 'AbortError') setLoadError(err.status === 404 ? 'We couldn’t find that product. It may have been deleted.' : err.message) },
    )
    return () => ac.abort()
  }, [slug, isNew, tick])

  // arriving here right after "Add product"
  useEffect(() => { if (loc.state?.added) say('Product added. It’s on the store within a minute.') }, [loc.state, say])

  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial))
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErrors((e) => { const n = { ...e }; for (const k of Object.keys(patch)) delete n[k]; return n }) }
  const setImages = useCallback((fn) => { setForm((f) => ({ ...f, images: fn(f.images) })); setErrors((e) => ({ ...e, images: '' })) }, [])
  const setColor = (i, patch) => set({ colors: form.colors.map((c, n) => (n === i ? { ...c, ...patch } : c)) })
  const existingSizes = new Set(product?.sizes.map((s) => s.size) ?? [])

  const toggleSize = (size) => {
    const has = form.sizes.some((s) => s.size === size)
    set({ sizes: (has ? form.sizes.filter((s) => s.size !== size) : [...form.sizes, { size, stock: '0' }]).sort(bySize) })
  }
  const useSuggested = () => set({ sizes: SUGGESTED_SIZES[form.category].map((size) => form.sizes.find((s) => s.size === size) ?? { size, stock: '0' }) })

  const submit = async (e) => {
    e?.preventDefault()
    if (saving || uploading || ro) return
    const found = validate(form)
    setErrors(found); setSaveError('')
    const first = Object.keys(found)[0]
    if (first) { document.getElementById(`sec-${first === 'mrp' ? 'price' : first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }

    const body = {
      name: form.name.trim(), description: form.description.trim(), category: form.category, price: Number(form.price), mrp: Number(form.mrp),
      colors: form.colors.map((c) => ({ name: c.name.trim(), hex: c.hex })),
      sizes: [...form.sizes].sort(bySize).map((s) => ({ size: s.size, stock: Number(s.stock) })),
      images: form.images.map((i) => ({ url: i.url, publicId: i.publicId || undefined, alt: i.alt || undefined })),
      isLimited: form.isLimited, placements: form.placements,
      ...(isNew ? { isActive: form.isActive } : {}), // visibility of an existing product has its own switch, which saves at once
    }
    setSaving(true)
    try {
      if (isNew) {
        const created = await createProduct(body)
        nav(`/admin/products/${created.slug}`, { replace: true, state: { added: true } })
      } else {
        const saved = await updateProduct(slug, body)
        setProduct(saved); const f = fromProduct(saved); setForm(f); setInitial(f)
        say('Saved. Changes reach the store within a minute.')
      }
    } catch (err) {
      setErrors(toSectionErrors(err.fields))
      setSaveError(Object.keys(err.fields ?? {}).length ? 'Please fix the highlighted parts.' : err.message)
      if (err.status === 409) setTick((n) => n + 1) // stock moved under us: bring in the latest
    } finally { setSaving(false) }
  }

  const toggleLive = async (isActive) => {
    if (isNew) return set({ isActive })
    setTogglingLive(true)
    try {
      const p = await setProductVisibility(slug, isActive)
      setProduct(p); setForm((f) => ({ ...f, isActive: p.isActive })); setInitial((f) => ({ ...f, isActive: p.isActive }))
      say(isActive ? 'Live on the store.' : 'Hidden from the store. Nothing was deleted.')
    } catch (err) { say(err.message, 'error') } finally { setTogglingLive(false) }
  }

  if (loadError) return (
    <div><Link to="/admin/products" className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink/60 hover:text-ink"><ArrowLeft size={15} aria-hidden />Products</Link><div className="mt-5"><ErrorBanner onRetry={() => setTick((n) => n + 1)}>{loadError}</ErrorBanner></div></div>
  )
  if (!form) return <div aria-hidden className="space-y-4"><div className="h-12 w-1/2 animate-pulse rounded-2xl bg-sand/45" /><div className="h-72 animate-pulse rounded-[24px] bg-sand/45" /><div className="h-72 animate-pulse rounded-[24px] bg-sand/45" /></div>

  const price = Number(form.price), mrp = Number(form.mrp)
  const off = price > 0 && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0
  const showBar = isOwner && (dirty || isNew)

  return (
    <form onSubmit={submit} noValidate className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <Link to="/admin/products" className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink/60 hover:text-ink"><ArrowLeft size={15} aria-hidden />Products</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-olive">{isNew ? 'New product' : 'Product'}</p>
          <h1 className="mt-2 break-words font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(26px,4vw,44px)]" style={{ fontVariationSettings: '"wdth" 86' }}>{form.name.trim() || (isNew ? 'Untitled' : '…')}</h1>
        </div>
        {!isNew && product && (
          <div className="flex flex-wrap items-center gap-2"><StockBadge state={product.stockState} />
            {product.isActive && <Link to={`/shop/${product.slug}`} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 px-4 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white">View on store <ExternalLink size={14} aria-hidden /></Link>}
          </div>
        )}
      </div>

      {ro && <p className="mt-5 flex items-start gap-2.5 rounded-2xl border border-sand bg-cream px-4 py-3 text-[14px] text-ink/70"><Lock size={16} className="mt-0.5 shrink-0" aria-hidden />You can change stock and hide or show this product. Only the owner can edit the details, pictures and prices.</p>}
      {saveError && <div className="mt-5"><ErrorBanner>{saveError}</ErrorBanner></div>}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-5">
          <Card id="sec-images" title="Pictures" hint="Front first, then back. The front picture is the one shoppers see in lists.">
            <ImageUploader images={form.images} setImages={setImages} slug={slug ?? (slugGuess(form.name))} disabled={ro} error={errors.images} onNotice={(m) => say(m, 'error')} onBusy={setUploading} />
            <SectionError>{errors.images}</SectionError>
          </Card>

          <Card id="sec-name" title="Details">
            <Field id="p-name" label="Product name" maxLength={120} autoComplete="off" value={form.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} disabled={ro} hint={isNew ? 'The web address is made from the name and can’t be changed later.' : undefined} />
            <Field id="p-desc" label="Description" optional multiline maxLength={2000} value={form.description} onChange={(e) => set({ description: e.target.value })} error={errors.description} disabled={ro} hint={`${form.description.length}/2000`} />
            <fieldset className="mt-1" disabled={ro}>
              <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">Category</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.id} type="button" aria-pressed={form.category === c.id} onClick={() => set({ category: c.id })} disabled={ro}
                    className={`h-10 rounded-full border px-4 text-[13px] font-bold transition-colors disabled:cursor-not-allowed ${form.category === c.id ? 'border-ink bg-ink text-white' : 'border-sand bg-white/70 text-ink/70 hover:border-ink/40'}`}>{c.label}</button>
                ))}
              </div>
            </fieldset>
            <div id="sec-price" className="mt-5 grid gap-x-4 sm:grid-cols-2">
              <Field id="p-price" label="Selling price (₹)" inputMode="decimal" autoComplete="off" value={form.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d.]/g, '') })} error={errors.price} disabled={ro} />
              <Field id="p-mrp" label="MRP (₹)" inputMode="decimal" autoComplete="off" value={form.mrp} onChange={(e) => set({ mrp: e.target.value.replace(/[^\d.]/g, '') })} error={errors.mrp} disabled={ro} hint={off ? `Shoppers see ${inr(price)} with ${off}% off.` : 'The crossed-out price. Same as the price for no discount.'} />
            </div>
            <label className="mt-2 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-sand bg-white/60 px-4 py-3">
              <span><b className="block text-[14px]">Limited run</b><span className="text-[13px] text-ink/60">Adds the “Limited run” tag on the store.</span></span>
              <Switch checked={form.isLimited} onChange={(v) => set({ isLimited: v })} label="Limited run" disabled={ro} />
            </label>
          </Card>

          <Card id="sec-colors" title="Colours" hint="Most pieces have one. Shoppers pick from these.">
            <ul className="space-y-2.5">
              {form.colors.map((c, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <input type="color" value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} aria-label={`Colour ${i + 1} swatch`} disabled={ro} className="size-12 shrink-0 cursor-pointer rounded-full border border-sand bg-transparent p-1 disabled:cursor-not-allowed" />
                  <input value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} maxLength={30} placeholder="Colour name, e.g. Olive" aria-label={`Colour ${i + 1} name`} disabled={ro} autoComplete="off"
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-sand bg-white/80 px-4 text-base outline-none hover:border-ink/40 focus:border-olive focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)]" />
                  {!ro && form.colors.length > 1 && <button type="button" onClick={() => set({ colors: form.colors.filter((_, n) => n !== i) })} aria-label={`Remove colour ${i + 1}`} className="grid size-10 shrink-0 place-items-center rounded-full border border-sand text-ink/60 hover:border-ink hover:text-ink"><X size={16} aria-hidden /></button>}
                </li>
              ))}
            </ul>
            <SectionError>{errors.colors}</SectionError>
            {!ro && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {form.colors.length < 8 && <button type="button" onClick={() => set({ colors: [...form.colors, { name: '', hex: '#1b1b1b' }] })} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/25 px-3.5 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white"><Plus size={14} aria-hidden />Add colour</button>}
                <span className="text-[12px] text-ink/50">Quick pick:</span>
                {COLOR_PRESETS.map((c) => (
                  <button key={c.name} type="button" title={c.name} aria-label={`Use ${c.name}`} onClick={() => {
                    const blank = form.colors.findIndex((x) => !x.name.trim())
                    set({ colors: blank >= 0 ? form.colors.map((x, n) => (n === blank ? { ...c } : x)) : form.colors.length < 8 ? [...form.colors, { ...c }] : form.colors })
                  }} className="size-7 rounded-full border border-ink/20 transition-transform hover:scale-110" style={{ background: c.hex }} />
                ))}
              </div>
            )}
          </Card>

          <Card id="sec-sizes" title="Sizes & stock" hint={isNew || isOwner ? 'Pick the sizes this comes in, then set how many you have.' : 'Tap a size to change its stock. It saves straight away.'}>
            {isOwner && (
              <>
                {SIZE_GROUPS.map((g) => (
                  <div key={g.label} className="mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">{g.label}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {g.sizes.map((size) => {
                        const on = form.sizes.some((s) => s.size === size)
                        return <button key={size} type="button" aria-pressed={on} onClick={() => toggleSize(size)} className={`inline-flex h-10 min-w-12 items-center justify-center gap-1 rounded-full border px-3.5 text-[13px] font-bold transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-sand bg-white/70 text-ink/70 hover:border-ink/40'}`}>{on && <Check size={13} strokeWidth={3} aria-hidden />}{size}</button>
                      })}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={useSuggested} className="text-[12.5px] font-bold uppercase tracking-wide text-olive underline-offset-4 hover:underline">Use the usual sizes for {CATEGORIES.find((c) => c.id === form.category)?.label.toLowerCase()}</button>
              </>
            )}
            <SectionError>{errors.sizes}</SectionError>

            {(isOwner ? form.sizes.length > 0 : (product?.sizes.length ?? 0) > 0) && (
              <div className="mt-5 border-t border-sand pt-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">Stock</p>
                <div className="mt-2 flex flex-wrap gap-2.5">
                  {(isOwner ? form.sizes : product.sizes).map((s) => {
                    const live = product?.sizes.find((x) => x.size === s.size)
                    return live ? (
                      <SizeStock key={s.size} product={product} size={s.size} stock={live.stock} low={live.low} onSaved={(p, m) => { setProduct(p); if (m) say(m) }} onError={(m) => say(m, 'error')} />
                    ) : (
                      <label key={s.size} className="inline-flex h-10 items-center gap-2 rounded-xl border border-dashed border-ink/40 bg-white/80 px-2.5 text-[13px]" title="New size: saved with the product">
                        <b className="w-7 text-center">{s.size}</b>
                        <input value={s.stock} inputMode="numeric" aria-label={`Starting stock for size ${s.size}`} onFocus={(e) => e.target.select()} onChange={(e) => set({ sizes: form.sizes.map((x) => (x.size === s.size ? { ...x, stock: e.target.value.replace(/\D/g, '').slice(0, 4) } : x)) })} className="w-14 bg-transparent text-right text-base font-bold tabular-nums outline-none" />
                      </label>
                    )
                  })}
                </div>
                {!isNew && <p className="mt-3 text-[12.5px] text-ink/55">Sizes already on the store save as soon as you change them. New sizes (dashed) are saved with the product.</p>}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24">
          <Card title="On the store" hint={isNew ? 'Choose whether it goes live as soon as it’s added.' : undefined}>
            <div className="flex items-center justify-between gap-4">
              <span><b className="block text-[14px]">{form.isActive ? 'Live' : 'Hidden'}</b><span className="text-[13px] text-ink/60">{form.isActive ? 'Shoppers can find and buy it.' : 'Off the store. Nothing is deleted.'}</span></span>
              <Switch checked={form.isActive} busy={togglingLive} onChange={toggleLive} label={`Product is ${form.isActive ? 'live' : 'hidden'}. Switch to ${form.isActive ? 'hide' : 'show'}`} />
            </div>
          </Card>

          <Card title="Home page" hint="Where it shows up. Set the order on the Home page order screen.">
            <ul className="space-y-3">
              {PLACEMENTS.map((p) => {
                const at = product?.placements[p.id]
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0"><b className="block text-[14px]">{p.label}{form.placements[p.id] && at != null && <span className="ml-2 rounded-full bg-olive/12 px-2 py-0.5 text-[11px] font-bold text-olive">#{at}</span>}</b><span className="text-[12.5px] text-ink/55">{p.hint}</span></span>
                    <Switch checked={form.placements[p.id]} onChange={(v) => set({ placements: { ...form.placements, [p.id]: v } })} label={p.label} disabled={ro} />
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 text-[12.5px] text-ink/55">New ones go to the end of the line.{!isNew && <> <Link to="/admin/products/placements" className="font-bold text-olive underline-offset-4 hover:underline">Change the order</Link></>}</p>
          </Card>

          {isOwner && !isNew && (
            <Card title="Delete" className="border-red-600/20">
              <p className="text-[13.5px] text-ink/65">Deleting removes it for good. Past orders keep their own copy of the name, price and picture. To take it off the store but keep it, switch it to Hidden instead.</p>
              <button type="button" onClick={() => setConfirmDelete(true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-red-700/50 px-4 text-[12px] font-bold uppercase tracking-wide text-red-700 hover:bg-red-700 hover:text-white"><Trash2 size={15} aria-hidden />Delete product</button>
            </Card>
          )}
        </aside>
      </div>

      {showBar && (
        <div className="sticky bottom-[5.25rem] z-20 mt-6 md:bottom-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-full bg-ink px-3 py-2.5 pl-5 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,.6)]">
            <span className="text-[13.5px] font-medium">{isNew ? 'Ready to add it?' : 'You have unsaved changes'}</span>
            <span className="flex gap-2">
              {!isNew && <button type="button" disabled={saving} onClick={() => { setForm(initial); setErrors({}); setSaveError('') }} className="h-10 rounded-full px-4 text-[12px] font-bold uppercase tracking-wide text-white/80 hover:text-white disabled:opacity-50">Discard</button>}
              <button type="submit" disabled={saving || uploading} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[12px] font-bold uppercase tracking-wide text-ink hover:bg-sand disabled:cursor-wait disabled:opacity-70">
                {saving ? <><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />Saving…</> : uploading ? 'Uploading…' : isNew ? 'Add product' : 'Save changes'}
              </button>
            </span>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this product?" confirmLabel="Delete for good" busyLabel="Deleting…" danger
        onConfirm={async () => { await deleteProduct(slug); nav('/admin/products', { replace: true }) }}>
        <p><b>{product?.name}</b> will be removed from the store and the back office. This can’t be undone.</p>
        <p>Want it gone from the store but kept for later? Go back and switch it to Hidden.</p>
      </ConfirmDialog>
      {toast}
    </form>
  )
}

// A readable prefix for the picture's file name before the product has an address. (The server adds random letters, so it never collides.)
const slugGuess = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || undefined

export default function ProductEdit() {
  const { slug } = useParams()
  const { admin } = useAdminAuth()
  if (!slug && admin.role !== 'owner') return <Navigate to="/admin/products" replace />
  return <Editor key={slug ?? 'new'} slug={slug} />
}
