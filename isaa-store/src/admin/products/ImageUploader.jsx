import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, CircleAlert, ImagePlus, LoaderCircle, X } from 'lucide-react'
import { uploadProductImage } from '../../lib/adminApi'

const MAX_IMAGES = 5 // shared pictures; every colour also has its own hero picture
const MAX_BYTES = 10 * 1024 * 1024 // Cloudinary's free plan stops at 10 MB per image
const TYPES = ['image/webp', 'image/png', 'image/jpeg']
const slotLabel = (i) => (i === 0 ? 'Back' : 'Extra') // the hero of each colour is the front shot (added with the colour); these come after it
const thumbOf = (img) => img.thumb || (img.url.includes('res.cloudinary.com') ? img.url.replace('/upload/', '/upload/f_auto,q_auto,w_360/') : img.url)

// Shop pictures are about 1200 × 1300 (a little taller than wide). A wrong shape still uploads, but the shop shows it badly, so say so.
async function shapeWarning(file) {
  try {
    const bmp = await createImageBitmap(file)
    const ratio = bmp.width / bmp.height
    const { width } = bmp
    bmp.close?.()
    if (ratio < 0.84 || ratio > 0.97) return `${file.name} isn’t about 1200 × 1300 (a little taller than wide). It may look off on the store.`
    if (width < 800) return `${file.name} is small (${width}px wide). 1200px wide looks sharpest.`
  } catch { /* can't read it here: Cloudinary will tell us if it's not an image */ }
  return ''
}

// The pictures every colour shares. Each colour has its own HERO (the front shot, added with the colour); these come after it:
// the first is the BACK (shown on hover in lists and second in the gallery), the rest are details.
// `setImages` takes a function (current list -> new list), so several uploads finishing together never overwrite each other.
export default function ImageUploader({ images, setImages, slug, disabled, error, onNotice, onBusy }) {
  const [jobs, setJobs] = useState([]) // uploads in flight or failed: { id, name, progress, error }
  const [over, setOver] = useState(false)
  const input = useRef(null)
  const room = MAX_IMAGES - images.length - jobs.filter((j) => !j.error).length

  const patchJob = (id, patch) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  const dropJob = (id) => setJobs((js) => js.filter((j) => j.id !== id))

  const add = async (fileList) => {
    const files = [...fileList]
    if (!files.length) return
    if (files.length > room) onNotice?.(`Up to ${MAX_IMAGES} more pictures. Added the first ${Math.max(room, 0)}.`)
    for (const file of files.slice(0, Math.max(room, 0))) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      if (!TYPES.includes(file.type)) { setJobs((js) => [...js, { id, name: file.name, progress: 0, error: 'Use a WebP, PNG or JPG picture.' }]); continue }
      if (file.size > MAX_BYTES) { setJobs((js) => [...js, { id, name: file.name, progress: 0, error: 'That picture is over 10 MB. Export a smaller one.' }]); continue }
      setJobs((js) => [...js, { id, name: file.name, progress: 0 }])
      shapeWarning(file).then((w) => w && onNotice?.(w))
      uploadProductImage(file, { slug, onProgress: (p) => patchJob(id, { progress: p }) }).then(
        (img) => { setImages((list) => [...list, { ...img, alt: '' }]); dropJob(id) },
        (err) => patchJob(id, { error: err.message }),
      )
    }
  }

  const move = (i, d) => setImages((list) => { const next = [...list]; [next[i], next[i + d]] = [next[i + d], next[i]]; return next })
  const remove = (i) => setImages((list) => list.filter((_, n) => n !== i))
  const busy = jobs.some((j) => !j.error)
  useEffect(() => { onBusy?.(busy) }, [busy, onBusy])

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <li key={img.url} className="rounded-2xl border border-sand bg-white/70 p-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#efe6d6]">
              <img src={thumbOf(img)} alt={`${slotLabel(i)} picture`} className="size-full object-contain" />
              <span className={`absolute left-2 top-2 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${i === 0 ? 'bg-ink text-white' : 'bg-white/90 text-ink'}`}>{slotLabel(i)}</span>
            </div>
            {!disabled && (
              <div className="mt-2 flex items-center justify-between">
                <span className="flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${slotLabel(i).toLowerCase()} picture earlier`} className="grid size-9 place-items-center rounded-full border border-sand hover:border-ink disabled:opacity-30"><ArrowLeft size={16} aria-hidden /></button>
                  <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${slotLabel(i).toLowerCase()} picture later`} className="grid size-9 place-items-center rounded-full border border-sand hover:border-ink disabled:opacity-30"><ArrowRight size={16} aria-hidden /></button>
                </span>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${slotLabel(i).toLowerCase()} picture`} className="grid size-9 place-items-center rounded-full border border-sand text-red-700 hover:border-red-700 hover:bg-red-50"><X size={16} aria-hidden /></button>
              </div>
            )}
          </li>
        ))}

        {jobs.map((j) => (
          <li key={j.id} className={`rounded-2xl border p-2 ${j.error ? 'border-red-600/30 bg-red-50' : 'border-sand bg-white/70'}`}>
            <div className="grid aspect-[4/5] place-items-center rounded-xl bg-sand/40 px-3 text-center">
              {j.error ? (
                <span className="text-[12.5px] text-red-800"><CircleAlert size={20} className="mx-auto mb-1.5" aria-hidden /><b className="block break-all">{j.name}</b>{j.error}</span>
              ) : (
                <span className="w-full text-[12.5px] text-ink/65"><LoaderCircle size={22} className="mx-auto mb-2 animate-spin motion-reduce:animate-none" aria-hidden />Uploading…
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sand"><span className="block h-full rounded-full bg-olive transition-[width]" style={{ width: `${Math.round(j.progress * 100)}%` }} /></span>
                </span>
              )}
            </div>
            {j.error && <button type="button" onClick={() => dropJob(j.id)} className="mt-2 h-9 w-full rounded-full border border-red-800/40 text-[12px] font-bold uppercase tracking-wide text-red-800 hover:bg-red-800 hover:text-white">Dismiss</button>}
          </li>
        ))}

        {!disabled && room > 0 && (
          <li>
            <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
              className={`grid aspect-[4/5] w-full place-items-center rounded-2xl border-2 border-dashed p-3 text-center transition-colors ${over ? 'border-olive bg-olive/10' : error ? 'border-red-600/60 bg-red-50/50' : 'border-ink/25 bg-white/40 hover:border-ink/60'}`}>
              <span className="text-[13px] font-bold"><ImagePlus size={26} className="mx-auto mb-2 text-ink/60" aria-hidden />{images.length === 0 ? 'Add the back picture' : 'Add another'}<span className="mt-1 block text-[12px] font-normal text-ink/55">Tap, or drop files here</span></span>
            </button>
            <input ref={input} type="file" accept={TYPES.join(',')} multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
          </li>
        )}
      </ul>
      <p aria-live="polite" className="mt-3 text-[13px] text-ink/55">
        {busy ? 'Uploading…' : 'Optional. The back picture first, then details; the same for every colour. Transparent cut-outs work best: WebP or PNG, about 1200 × 1300 px, under 10 MB.'}
      </p>
    </div>
  )
}
