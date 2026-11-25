import { useRef, useState } from 'react'
import { CircleAlert, Film, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react'
import { uploadToCloudinary } from '../../lib/adminApi'

const SPEC = {
  poster: { kind: 'reel-poster', types: ['image/webp', 'image/png', 'image/jpeg'], max: 10 * 1024 * 1024, bad: 'Use a WebP, PNG or JPG picture.', big: 'That picture is over 10 MB. Export a smaller one.', Icon: ImagePlus, add: 'Add the poster', hint: '9:16 portrait' },
  video: { kind: 'reel-video', types: ['video/mp4', 'video/webm', 'video/quicktime'], max: 40 * 1024 * 1024, bad: 'Use an MP4, WebM or MOV video.', big: 'That video is over 40 MB. Trim or compress it.', Icon: Film, add: 'Add a video', hint: 'optional · muted loop' },
}

// The poster is shown 9:16 on the home page; a different shape still uploads but gets cropped, so say so.
async function shapeNote(file) {
  try {
    const bmp = await createImageBitmap(file)
    const ratio = bmp.width / bmp.height
    bmp.close?.()
    if (ratio < 0.5 || ratio > 0.62) return 'This isn’t 9:16 (tall). It will be cropped on the home page.'
  } catch { /* can't read it here: Cloudinary will say if it's not an image */ }
  return ''
}

// One file slot (the poster, or the optional video) with its own upload progress. `value` is { url, publicId, thumb? } or null.
export default function ReelUpload({ kind, value, onChange, onBusy, disabled, error, label }) {
  const spec = SPEC[kind]
  const input = useRef(null)
  const [job, setJob] = useState(null) // { progress, error }
  const [note, setNote] = useState('')

  const pick = async (file) => {
    if (!file) return
    setNote('')
    if (!spec.types.includes(file.type)) return setJob({ progress: 0, error: spec.bad })
    if (file.size > spec.max) return setJob({ progress: 0, error: spec.big })
    setJob({ progress: 0 }); onBusy?.(true)
    if (kind === 'poster') shapeNote(file).then(setNote)
    else if (file.size > 20 * 1024 * 1024) setNote('Over 20 MB: phones on mobile data may be slow to start it.')
    try {
      const up = await uploadToCloudinary(file, { kind: spec.kind, onProgress: (p) => setJob({ progress: p }) })
      onChange(up); setJob(null)
    } catch (err) { setJob({ progress: 0, error: err.message }) } finally { onBusy?.(false) }
  }

  const poster = kind === 'poster'
  const src = value ? (poster ? value.thumb || value.url : value.url) : ''
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">{label}</p>
      <div className={`relative mt-1.5 aspect-[9/16] w-full overflow-hidden rounded-2xl border-2 ${error || job?.error ? 'border-red-600/50 bg-red-50/50' : value ? 'border-sand bg-ink' : 'border-dashed border-ink/25 bg-white/50'}`}>
        {value && !job && (poster
          ? <img src={src} alt="Poster" className="size-full object-cover" />
          : <video src={src} muted loop playsInline autoPlay preload="metadata" aria-label="Video preview" className="size-full object-cover" />)}
        {job && !job.error && (
          <div className="grid size-full place-items-center bg-sand/50 px-3 text-center text-[12.5px] text-ink/65">
            <span className="w-full"><LoaderCircle size={22} className="mx-auto mb-2 animate-spin motion-reduce:animate-none" aria-hidden />Uploading…
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-sand"><span className="block h-full rounded-full bg-olive transition-[width]" style={{ width: `${Math.round(job.progress * 100)}%` }} /></span></span>
          </div>
        )}
        {job?.error && <div className="grid size-full place-items-center px-3 text-center text-[12.5px] text-red-800"><span><CircleAlert size={20} className="mx-auto mb-1.5" aria-hidden />{job.error}</span></div>}
        {!value && !job && !disabled && (
          <button type="button" onClick={() => input.current?.click()} className="absolute inset-0 grid place-items-center p-3 text-center transition-colors hover:bg-white/60">
            <span className="text-[13px] font-bold"><spec.Icon size={24} className="mx-auto mb-1.5 text-ink/60" aria-hidden />{spec.add}<span className="mt-0.5 block text-[11.5px] font-normal text-ink/55">{spec.hint}</span></span>
          </button>
        )}
        {job?.error && !disabled && <button type="button" onClick={() => { setJob(null); input.current?.click() }} className="absolute inset-x-2 bottom-2 h-9 rounded-full bg-white/90 text-[12px] font-bold uppercase tracking-wide hover:bg-white">Try another</button>}
      </div>
      {!disabled && value && !job && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => input.current?.click()} className="h-9 flex-1 rounded-full border border-ink/25 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white">Replace</button>
          {!poster && <button type="button" onClick={() => { onChange(null); setNote('') }} aria-label="Remove the video" className="grid size-9 place-items-center rounded-full border border-sand text-red-700 hover:border-red-700 hover:bg-red-50"><Trash2 size={15} aria-hidden /></button>}
        </div>
      )}
      {note && <p className="mt-2 text-[12.5px] leading-snug text-amber-800">{note}</p>}
      {error && <p role="alert" className="mt-2 text-[12.5px] font-medium text-red-700">{error}</p>}
      <input ref={input} type="file" accept={spec.types.join(',')} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}
