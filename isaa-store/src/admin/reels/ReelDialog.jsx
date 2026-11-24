import { useState } from 'react'
import { CircleAlert, ExternalLink, LoaderCircle, X } from 'lucide-react'
import { createReel, updateReel } from '../../lib/adminApi'
import { Field } from '../../components/form/Field'
import { Dialog } from '../orders/shared'
import { Switch } from '../products/ui'
import ReelUpload from './ReelUpload'

const IG = /^https:\/\/(www\.)?instagram\.com\/(reels?|p|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/
const DEFAULT_ACCENT = '#c9a27a'

// Add a reel, or edit one (`reel` set). Calls onSaved(reel) with the server's version.
export default function ReelDialog({ open, onClose, reel, onSaved }) {
  const editing = Boolean(reel)
  const [form, setForm] = useState(() => ({
    url: reel?.url ?? '', poster: reel?.poster ?? null, video: reel?.video ?? null,
    caption: reel?.caption ?? '', tag: reel?.tag ?? '', accent: reel?.accent ?? '', isActive: reel?.isActive ?? true,
  }))
  const [errors, setErrors] = useState({})
  const [fail, setFail] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = (patch) => { setForm((f) => ({ ...f, ...patch })); setErrors((e) => { const n = { ...e }; for (const k of Object.keys(patch)) delete n[k]; return n }) }
  const close = () => { if (!busy && !uploading) onClose() }

  const submit = async (e) => {
    e.preventDefault()
    if (busy || uploading) return
    const errs = {}
    if (!IG.test(form.url.trim())) errs.url = 'Paste the full link to the reel, like https://www.instagram.com/reel/…/'
    if (!form.poster) errs.poster = 'Add the poster picture.'
    setErrors(errs); setFail('')
    if (Object.keys(errs).length) return
    const body = {
      url: form.url.trim(),
      poster: { url: form.poster.url, publicId: form.poster.publicId },
      video: form.video ? { url: form.video.url, publicId: form.video.publicId } : null,
      caption: form.caption.trim(), tag: form.tag.trim(), accent: form.accent || null,
    }
    setBusy(true)
    try {
      const saved = editing ? await updateReel(reel.id, body) : await createReel({ ...body, isActive: form.isActive })
      onSaved(saved)
    } catch (err) {
      setErrors(Object.fromEntries(Object.entries(err.fields ?? {}).map(([p, m]) => [p.split('.')[0], m])))
      if (!Object.keys(err.fields ?? {}).length) setFail(err.message)
      setBusy(false)
    }
  }

  const accent = form.accent || DEFAULT_ACCENT
  return (
    <Dialog open={open} onClose={close} title={editing ? 'Edit reel' : 'Add a reel'} busy={busy || uploading} wide>
      <form onSubmit={submit} noValidate>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[26px] font-black uppercase italic leading-none tracking-tight">{editing ? 'Edit reel' : 'Add a reel'}</h2>
          <button type="button" onClick={close} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full border border-sand hover:border-ink"><X size={16} aria-hidden /></button>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/65">Upload a poster (Instagram’s own thumbnails expire). A short muted video is optional: it plays on the card in front.</p>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 sm:gap-5">
          <ReelUpload kind="poster" label="Poster" value={form.poster} onChange={(v) => set({ poster: v })} onBusy={setUploading} error={errors.poster} />
          <ReelUpload kind="video" label="Video (optional)" value={form.video} onChange={(v) => set({ video: v })} onBusy={setUploading} error={errors.video} />
        </div>

        <div className="mt-5">
          <Field id="r-url" label="Instagram link" inputMode="url" autoComplete="off" value={form.url} onChange={(e) => set({ url: e.target.value })} error={errors.url} hint="Where the card goes when someone taps it." />
          <Field id="r-caption" label="Caption" optional maxLength={200} value={form.caption} onChange={(e) => set({ caption: e.target.value })} error={errors.caption} />
          <Field id="r-tag" label="Tag" optional maxLength={30} value={form.tag} onChange={(e) => set({ tag: e.target.value })} error={errors.tag} hint="A short label on the card, like “New drop”." />
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-sand bg-white/60 px-4 py-3">
          <input type="color" value={accent} onChange={(e) => set({ accent: e.target.value })} aria-label="Glow colour" className="size-11 shrink-0 cursor-pointer rounded-full border border-sand bg-transparent p-1" />
          <span className="min-w-0 flex-1"><b className="block text-[14px]">Glow colour</b><span className="text-[13px] text-ink/60">The soft light around the card when it’s in front.</span></span>
          {form.accent && <button type="button" onClick={() => set({ accent: '' })} className="shrink-0 text-[12px] font-bold uppercase tracking-wide text-ink/55 underline-offset-4 hover:text-ink hover:underline">Reset</button>}
          <span aria-hidden className="hidden h-9 w-9 shrink-0 rounded-full sm:block" style={{ background: accent, boxShadow: `0 0 18px ${accent}` }} />
        </div>

        {!editing && (
          <label className="mt-3 flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-sand bg-white/60 px-4 py-3">
            <span><b className="block text-[14px]">Show on the home page</b><span className="text-[13px] text-ink/60">Off keeps it saved but hidden.</span></span>
            <Switch checked={form.isActive} onChange={(v) => set({ isActive: v })} label="Show on the home page" />
          </label>
        )}
        {editing && <a href={reel.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide text-olive underline-offset-4 hover:underline">Open on Instagram <ExternalLink size={13} aria-hidden /></a>}

        {fail && <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />{fail}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} disabled={busy || uploading} className="h-12 rounded-full border border-ink/25 px-6 text-[13px] font-bold uppercase tracking-wide hover:border-ink disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || uploading} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[13px] font-bold uppercase tracking-wide text-white hover:bg-olive disabled:cursor-wait disabled:opacity-80">
            {busy ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden />Saving…</> : uploading ? 'Uploading…' : editing ? 'Save reel' : 'Add reel'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
