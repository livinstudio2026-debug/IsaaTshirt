import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert, Lock, LoaderCircle, Trash2 } from 'lucide-react'
import { createSizeChart, deleteSizeChart, getSizeChart, updateSizeChart } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { Field } from '../../components/form/Field'
import { useAdminPage } from '../useAdminPage'
import ConfirmDialog from '../orders/ConfirmDialog'
import { CATEGORIES } from '../products/catalog'
import { ErrorBanner } from '../products/ui'
import { useToast } from '../products/useToast'
import ChartTable from '../size-charts/ChartTable'
import { tableFromApi, tableProblem, tableToApi } from '../size-charts/table'

const STARTER = { columns: ['Chest', 'Length', 'Shoulder', 'Sleeve'], rows: ['S', 'M', 'L', 'XL'].map((size) => ({ size, values: ['', '', '', ''] })) }
const NEW = { name: '', category: '', note: '', table: STARTER }
const fromChart = (c) => ({ name: c.name, category: c.category, note: c.note, table: tableFromApi(c) })

// Server errors come as { name: msg, 'table.rows.0.values.1': msg }: names go under the name box, the rest under the table.
const splitErrors = (fields = {}) => {
  const out = {}
  for (const [path, msg] of Object.entries(fields)) { const k = path.startsWith('table') ? 'table' : path.split('.')[0]; out[k] ??= msg }
  return out
}

function Card({ title, hint, children, className = '' }) {
  return (
    <section className={`rounded-[24px] border border-sand bg-white/70 p-5 sm:p-6 ${className}`}>
      <h2 className="text-[17px] font-black uppercase italic tracking-tight">{title}</h2>
      {hint && <p className="mt-1 text-[13.5px] text-ink/60">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Editor({ slug }) {
  const isNew = !slug
  const { admin } = useAdminAuth()
  const ro = admin.role !== 'owner'
  const nav = useNavigate()
  const [toast, say] = useToast()
  const [chart, setChart] = useState(null)
  const [form, setForm] = useState(isNew ? NEW : null)
  const [initial, setInitial] = useState(isNew ? NEW : null)
  const [errors, setErrors] = useState({})
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [tick, setTick] = useState(0)
  useAdminPage(isNew ? 'New size chart' : form?.name || 'Size chart')

  useEffect(() => {
    if (isNew) return
    const ac = new AbortController()
    getSizeChart(slug, ac.signal).then(
      (c) => { setChart(c); const f = fromChart(c); setForm(f); setInitial(f); setLoadError('') },
      (err) => { if (err.name !== 'AbortError') setLoadError(err.status === 404 ? 'We couldn’t find that size chart. It may have been deleted.' : err.message) },
    )
    return () => ac.abort()
  }, [slug, isNew, tick])

  const dirty = Boolean(form && initial && JSON.stringify(form) !== JSON.stringify(initial))
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErrors((e) => { const n = { ...e }; for (const k of Object.keys(patch)) delete n[k]; return n }) }

  const submit = async (e) => {
    e?.preventDefault()
    if (saving || ro) return
    const found = {}
    if (form.name.trim().length < 2) found.name = 'Enter a name, like Oversized Tee.'
    const problem = tableProblem(form.table)
    if (problem) found.table = problem
    setErrors(found); setSaveError('')
    if (Object.keys(found).length) return
    const body = { name: form.name.trim(), category: form.category, note: form.note.trim(), table: tableToApi(form.table) }
    setSaving(true)
    try {
      if (isNew) {
        const created = await createSizeChart(body)
        nav(`/admin/products/size-charts/${created.slug}`, { replace: true })
      } else {
        const saved = await updateSizeChart(slug, body)
        setChart(saved); const f = fromChart(saved); setForm(f); setInitial(f)
        say(saved.usedBy ? `Saved. ${saved.usedBy} ${saved.usedBy === 1 ? 'product shows' : 'products show'} it within a few seconds.` : 'Saved.')
      }
    } catch (err) {
      setErrors(splitErrors(err.fields))
      setSaveError(Object.keys(err.fields ?? {}).length ? 'Please fix the highlighted parts.' : err.message)
    } finally { setSaving(false) }
  }

  if (loadError) return <div><Link to="/admin/products/size-charts" className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink/60 hover:text-ink"><ArrowLeft size={15} aria-hidden />Size charts</Link><div className="mt-5"><ErrorBanner onRetry={() => setTick((n) => n + 1)}>{loadError}</ErrorBanner></div></div>
  if (!form) return <div aria-hidden className="space-y-4"><div className="h-12 w-1/2 animate-pulse rounded-2xl bg-sand/45" /><div className="h-72 animate-pulse rounded-[24px] bg-sand/45" /></div>

  return (
    <form onSubmit={submit} noValidate className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <Link to="/admin/products/size-charts" className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink/60 hover:text-ink"><ArrowLeft size={15} aria-hidden />Size charts</Link>
      <div className="mt-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-olive">{isNew ? 'New size chart' : 'Size chart'}</p>
        <h1 className="mt-2 break-words font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(26px,4vw,44px)]" style={{ fontVariationSettings: '"wdth" 86' }}>{form.name.trim() || (isNew ? 'Untitled' : '…')}</h1>
      </div>

      {ro && <p className="mt-5 flex items-start gap-2.5 rounded-2xl border border-sand bg-cream px-4 py-3 text-[14px] text-ink/70"><Lock size={16} className="mt-0.5 shrink-0" aria-hidden />Only the owner can change size charts.</p>}
      {saveError && <div className="mt-5"><ErrorBanner>{saveError}</ErrorBanner></div>}
      {!isNew && chart?.usedBy > 0 && !ro && <p className="mt-5 rounded-2xl border border-amber-400/60 bg-amber-50 px-4 py-3 text-[14px] text-amber-950">Used by <b>{chart.usedBy} {chart.usedBy === 1 ? 'product' : 'products'}</b>. Changing the numbers changes what shoppers see on all of them.</p>}

      <div className="mt-6 space-y-5">
        <Card title="Details">
          <Field id="c-name" label="Chart name" maxLength={40} autoComplete="off" value={form.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} disabled={ro} hint={isNew ? 'You’ll pick this name on products, e.g. Oversized Tee or Hoodie.' : undefined} />
          <fieldset disabled={ro}>
            <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">Usually for</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[{ id: '', label: 'Any product' }, ...CATEGORIES].map((c) => (
                <button key={c.id} type="button" aria-pressed={form.category === c.id} onClick={() => set({ category: c.id })} disabled={ro}
                  className={`h-10 rounded-full border px-4 text-[13px] font-bold transition-colors disabled:cursor-not-allowed ${form.category === c.id ? 'border-ink bg-ink text-white' : 'border-sand bg-white/70 text-ink/70 hover:border-ink/40'}`}>{c.label}</button>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] text-ink/55">When you add a product in that category, this chart is picked for you.</p>
          </fieldset>
          <Field className="mt-4" id="c-note" label="Note under the table" optional maxLength={200} autoComplete="off" value={form.note} onChange={(e) => set({ note: e.target.value })} error={errors.note} disabled={ro} hint={`${form.note.length}/200. Say how it was measured, e.g. “Garment measurements laid flat, ±1–2 cm”.`} />
        </Card>

        <Card title="Measurements" hint="Name the measurements across the top (Chest, Length…), then fill in each size. Measure the garment itself, not the body: that is what shoppers compare it to.">
          <ChartTable value={form.table} onChange={(table) => set({ table })} disabled={ro} idPrefix="c" />
          {errors.table && <p role="alert" className="mt-3 flex items-center gap-1.5 text-[13px] font-medium text-red-700"><CircleAlert size={14} className="shrink-0" aria-hidden />{errors.table}</p>}
        </Card>

        {!ro && !isNew && (
          <Card title="Delete" className="border-red-600/20">
            <p className="text-[13.5px] text-ink/65">{chart?.usedBy ? `A chart that products use can’t be deleted. Switch those ${chart.usedBy} ${chart.usedBy === 1 ? 'product' : 'products'} to another chart first.` : 'Nothing uses this chart, so it can be deleted safely.'}</p>
            <button type="button" onClick={() => setConfirmDelete(true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-red-700/50 px-4 text-[12px] font-bold uppercase tracking-wide text-red-700 hover:bg-red-700 hover:text-white"><Trash2 size={15} aria-hidden />Delete chart</button>
          </Card>
        )}
      </div>

      {!ro && (dirty || isNew) && (
        <div className="sticky bottom-[5.25rem] z-20 mt-6 md:bottom-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-full bg-ink px-3 py-2.5 pl-5 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,.6)]">
            <span className="text-[13.5px] font-medium">{isNew ? 'Ready to add it?' : 'You have unsaved changes'}</span>
            <span className="flex gap-2">
              {!isNew && <button type="button" disabled={saving} onClick={() => { setForm(initial); setErrors({}); setSaveError('') }} className="h-10 rounded-full px-4 text-[12px] font-bold uppercase tracking-wide text-white/80 hover:text-white disabled:opacity-50">Discard</button>}
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[12px] font-bold uppercase tracking-wide text-ink hover:bg-sand disabled:cursor-wait disabled:opacity-70">
                {saving ? <><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />Saving…</> : isNew ? 'Add chart' : 'Save changes'}
              </button>
            </span>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this chart?" confirmLabel="Delete for good" busyLabel="Deleting…" danger
        onConfirm={async () => { await deleteSizeChart(slug); nav('/admin/products/size-charts', { replace: true }) }}>
        <p><b>{chart?.name}</b> will be removed. This can’t be undone.</p>
      </ConfirmDialog>
      {toast}
    </form>
  )
}

export default function SizeChartEdit() {
  const { slug } = useParams()
  const { admin } = useAdminAuth()
  if (!slug && admin.role !== 'owner') return <Navigate to="/admin/products/size-charts" replace />
  return <Editor key={slug ?? 'new'} slug={slug} />
}
