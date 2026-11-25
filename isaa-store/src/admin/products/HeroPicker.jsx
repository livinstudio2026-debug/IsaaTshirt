import { useEffect, useRef, useState } from 'react'
import { ImagePlus, LoaderCircle, RefreshCw } from 'lucide-react'
import { uploadProductImage } from '../../lib/adminApi'
import { prepareHero } from './heroCheck'

const thumbOf = (img) => img.thumb || (img.url.includes('res.cloudinary.com') ? img.url.replace('/upload/', '/upload/f_auto,q_auto,w_360/') : img.url)

// The hero picture of ONE colour: what shoppers see for that colour in lists and first on the product page.
// Any PNG/WebP/JPG is accepted: the browser clears a plain background, centres and frames it, then uploads the result.
// `onBusy(colorKey, bool)` tells the form an upload is running, so "Save" waits for it.
export default function HeroPicker({ colorKey, colorName, value, onChange, slug, disabled, missing, onBusy, onNote }) {
  const [job, setJob] = useState(null) // { name, progress } while uploading
  const [over, setOver] = useState(false)
  const input = useRef(null)
  const busy = Boolean(job)

  useEffect(() => {
    onBusy?.(colorKey, busy)
    return () => onBusy?.(colorKey, false)
  }, [busy, colorKey, onBusy])

  const take = async (fileList) => {
    const file = fileList?.[0]
    if (!file || busy) return
    onNote?.(colorKey, null)
    setJob({ name: file.name, progress: 0 })
    try {
      const prep = await prepareHero(file)
      if (prep.error) { onNote?.(colorKey, { error: prep.error }); return }
      const img = await uploadProductImage(prep.file, { slug, onProgress: (p) => setJob({ name: file.name, progress: p }) })
      onChange({ ...img, alt: '' })
      onNote?.(colorKey, { notes: prep.notes })
    } catch (err) {
      onNote?.(colorKey, { error: err.message })
    } finally { setJob(null) }
  }

  const frame = 'relative grid aspect-[4/4.5] w-28 shrink-0 place-items-center overflow-hidden rounded-2xl sm:w-36'
  return (
    <div className="w-28 shrink-0 sm:w-36">
      {value && !busy ? (
        <div className={`${frame} border border-sand bg-[#efe6d6]`}>
          <img src={thumbOf(value)} alt={`${colorName.trim() || 'Colour'} hero picture`} className="size-full object-contain p-1.5" />
          <span className="absolute left-1.5 top-1.5 rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Hero</span>
          {!disabled && (
            <button type="button" onClick={() => input.current?.click()} aria-label={`Replace the ${colorName.trim() || 'colour'} hero picture`}
              className="absolute bottom-1.5 right-1.5 inline-flex h-8 items-center gap-1 rounded-full bg-white/95 px-2.5 text-[11px] font-bold uppercase tracking-wide text-ink shadow hover:bg-ink hover:text-white">
              <RefreshCw size={12} aria-hidden />Replace
            </button>
          )}
        </div>
      ) : busy ? (
        <div className={`${frame} border border-sand bg-sand/40 px-3 text-center`}>
          <span className="w-full text-[12px] text-ink/65"><LoaderCircle size={20} className="mx-auto mb-1.5 animate-spin motion-reduce:animate-none" aria-hidden />Uploading…
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sand"><span className="block h-full rounded-full bg-olive transition-[width]" style={{ width: `${Math.round((job?.progress ?? 0) * 100)}%` }} /></span>
          </span>
        </div>
      ) : (
        <button type="button" disabled={disabled} onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) take(e.dataTransfer.files) }}
          className={`${frame} border-2 border-dashed p-2 text-center transition-colors disabled:cursor-not-allowed ${over ? 'border-olive bg-olive/10' : missing ? 'border-red-600/60 bg-red-50/50' : 'border-ink/25 bg-white/40 hover:border-ink/60'}`}>
          <span className="text-[12px] font-bold"><ImagePlus size={22} className="mx-auto mb-1.5 text-ink/60" aria-hidden />Add hero picture<span className="mt-0.5 block text-[11px] font-normal text-ink/55">Required</span></span>
        </button>
      )}
      <input ref={input} type="file" accept="image/png,image/webp,image/jpeg" hidden onChange={(e) => { take(e.target.files); e.target.value = '' }} />
    </div>
  )
}
