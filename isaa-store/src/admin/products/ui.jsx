import { CircleAlert, LoaderCircle } from 'lucide-react'

// An on/off switch: "Visible on the store", the placement toggles.
export function Switch({ checked, onChange, label, disabled = false, busy = false }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled || busy} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'border-olive bg-olive' : 'border-ink/25 bg-sand'}`}>
      <span aria-hidden className="absolute top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-white shadow transition-[left] duration-200" style={{ left: checked ? 24 : 3 }}>
        {busy && <LoaderCircle size={12} className="animate-spin text-ink/60 motion-reduce:animate-none" />}
      </span>
    </button>
  )
}

export function ErrorBanner({ children, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-600/25 bg-red-50 px-5 py-4 text-[14px] text-red-800">
      <span className="flex items-start gap-2.5"><CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden />{children}</span>
      {onRetry && <button type="button" onClick={onRetry} className="rounded-full border border-red-800/40 px-4 py-2 text-[12px] font-bold uppercase tracking-wide hover:bg-red-800 hover:text-white">Try again</button>}
    </div>
  )
}

export const StockBadge = ({ state }) => state === 'out'
  ? <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-800">Sold out</span>
  : state === 'low' ? <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">Low stock</span> : null

export const PageTitle = ({ eyebrow = 'Back office', children }) => (
  <div>
    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-olive">{eyebrow}</p>
    <h1 className="mt-2 font-black italic uppercase leading-[0.95] tracking-tight text-[clamp(30px,4.4vw,52px)]" style={{ fontVariationSettings: '"wdth" 86' }}>{children}</h1>
  </div>
)

export const btnGhost = 'inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 px-4 text-[12px] font-bold uppercase tracking-wide transition-colors hover:border-ink hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-50'
export const btnSolid = 'inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[12px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive disabled:pointer-events-none disabled:opacity-50'
