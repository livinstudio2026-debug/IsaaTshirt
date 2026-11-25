import { useEffect, useRef, useState } from 'react'
import { Ruler, X } from 'lucide-react'

// The size guide on the product page: a "Size guide" link beside the size picker that opens a sheet (a bottom sheet on phones, a
// centred card on larger screens) with the size table and how the piece fits. The server sends measurements in cm; shoppers can flip to inches.
// `guide` = { name, source, columns, rows: [{ size, values }], note }, `fit` = { note, modelHeightCm, modelSize }; either may be null.

const UNIT_KEY = 'isaa.sizeUnit'
const readUnit = () => { try { return localStorage.getItem(UNIT_KEY) === 'cm' ? 'cm' : 'in' } catch { return 'in' } } // inches first: that's how most shoppers here read garment sizes
const saveUnit = (u) => { try { localStorage.setItem(UNIT_KEY, u) } catch { /* private mode: the choice just isn't remembered */ } }

const trim = (n) => String(Math.round(n * 10) / 10)
const inches = (cm) => trim(Math.round((cm / 2.54) * 2) / 2) // to the nearest half inch, the way tape measures read
const value = (cm, unit) => (unit === 'in' ? inches(cm) : trim(cm))
const sizeName = (s) => (s === 'FREE' ? 'Free' : s)

// 178 -> 5′10″ (178 cm)
function height(cm) {
  const total = cm / 2.54
  let ft = Math.floor(total / 12)
  let inch = Math.round(total - ft * 12)
  if (inch === 12) { ft += 1; inch = 0 }
  return `${ft}′${inch}″ (${cm} cm)`
}

const modelLine = (fit) => {
  const parts = []
  if (fit?.modelHeightCm) parts.push(`${height(fit.modelHeightCm)} tall`)
  if (fit?.modelSize) parts.push(`wearing ${sizeName(fit.modelSize)}`)
  return parts.length ? `Model is ${parts.join(', ')}` : ''
}

// The short fit line under the size picker, so shoppers see it without opening anything.
export function FitSummary({ fit }) {
  if (!fit) return null
  const model = modelLine(fit)
  return (
    <div className="mt-1 flex items-start gap-2.5 text-[13px] leading-snug text-ink/70">
      <Ruler size={15} className="mt-0.5 shrink-0 text-olive" aria-hidden />
      <p>{fit.note && <b className="font-semibold text-ink">{fit.note}</b>}{fit.note && model && ' · '}{model}</p>
    </div>
  )
}

function UnitToggle({ unit, onChange }) {
  return (
    <div role="radiogroup" aria-label="Units" className="inline-flex rounded-full border border-ink/25 p-0.5">
      {[['in', 'Inches'], ['cm', 'cm']].map(([id, label]) => (
        <button key={id} type="button" role="radio" aria-checked={unit === id} onClick={() => onChange(id)}
          className={`h-8 rounded-full px-3.5 text-[12px] font-bold uppercase tracking-wide transition-colors ${unit === id ? 'bg-ink text-white' : 'text-ink/65 hover:text-ink'}`}>{label}</button>
      ))}
    </div>
  )
}

export default function SizeGuide({ guide, fit, size, title }) {
  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState(readUnit)
  const ref = useRef(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // the page behind doesn't scroll while the sheet is open
  useEffect(() => {
    if (!open) return
    document.documentElement.classList.add('is-modal-open')
    return () => document.documentElement.classList.remove('is-modal-open')
  }, [open])

  const pick = (u) => { setUnit(u); saveUnit(u) }
  const model = modelLine(fit)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide underline decoration-ink/30 decoration-2 underline-offset-[6px] transition-colors hover:decoration-olive">
        <Ruler size={15} aria-hidden />Size guide
      </button>

      <dialog ref={ref} aria-label={`Size guide for ${title}`} onClose={() => setOpen(false)} onMouseDown={(e) => { if (e.target === ref.current) setOpen(false) }}
        className="m-0 mt-auto max-h-[90svh] w-full max-w-none animate-[sheet-up_.38s_cubic-bezier(.2,.8,.2,1)] overflow-y-auto overscroll-contain rounded-b-none rounded-t-[28px] border border-sand bg-cream p-0 text-ink shadow-[0_-30px_80px_-30px_rgba(0,0,0,.5)] backdrop:bg-ink/55 backdrop:backdrop-blur-[2px] motion-reduce:animate-none sm:m-auto sm:max-h-[88svh] sm:w-[min(92vw,40rem)] sm:animate-[zoom-in_.28s_ease-out] sm:rounded-[28px]">
        {open && (
          <div className="p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-olive">{guide ? (guide.source === 'custom' ? title : guide.name) : title}</p>
                <h2 className="mt-1.5 font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(28px,7vw,40px)]" style={{ fontVariationSettings: '"wdth" 86' }}>Size guide</h2>
              </div>
              <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Close size guide" className="grid size-11 shrink-0 place-items-center rounded-full border border-ink/25 transition-colors hover:border-ink hover:bg-ink hover:text-white"><X size={18} aria-hidden /></button>
            </div>

            {guide && (
              <>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[13px] text-ink/65">{unit === 'in' ? 'Garment measurements in inches' : 'Garment measurements in cm'}</p>
                  <UnitToggle unit={unit} onChange={pick} />
                </div>

                <div role="region" aria-label="Size table, scrolls sideways if needed" tabIndex={0} className="-mx-1 mt-3 overflow-x-auto rounded-[20px] border border-sand bg-white/60 px-1">
                  <table className="w-full min-w-[20rem] border-collapse text-left text-[14px] tabular-nums">
                    <caption className="sr-only">{`${guide.name} measurements in ${unit === 'in' ? 'inches' : 'centimetres'}`}</caption>
                    <thead>
                      <tr className="border-b border-sand text-[11px] font-bold uppercase tracking-[0.12em] text-ink/55">
                        <th scope="col" className="px-3 py-3 sm:px-4">Size</th>
                        {guide.columns.map((c) => <th key={c} scope="col" className="px-3 py-3 sm:px-4">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {guide.rows.map((r) => {
                        const mine = r.size === size
                        return (
                          <tr key={r.size} aria-current={mine ? 'true' : undefined} className={`border-b border-sand/70 last:border-0 ${mine ? 'bg-olive/12 font-bold' : ''}`}>
                            <th scope="row" className="px-3 py-3 font-black sm:px-4">{sizeName(r.size)}{mine && <span className="ml-2 rounded-full bg-olive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Your pick</span>}</th>
                            {r.values.map((v, i) => <td key={i} className="px-3 py-3 sm:px-4">{value(v, unit)}</td>)}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {guide.note && <p className="mt-3 text-[12.5px] leading-relaxed text-ink/60">{guide.note}</p>}
              </>
            )}

            {fit && (
              <div className="mt-6 rounded-[20px] border border-dashed border-ink/25 bg-white/50 px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">How it fits</p>
                {fit.note && <p className="mt-1.5 text-[15px] font-bold leading-snug">{fit.note}</p>}
                {model && <p className="mt-1 text-[14px] text-ink/70">{model}</p>}
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  )
}
