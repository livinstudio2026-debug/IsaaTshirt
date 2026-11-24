import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'

// The search box and the Prev / Next row, as on the Orders page, shared by the two Inbox tabs.
export function SearchBox({ value, onChange, placeholder, label }) {
  return (
    <div className="relative w-full lg:max-w-sm">
      <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/45" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} maxLength={60} placeholder={placeholder} aria-label={label} autoComplete="off"
        className="h-12 w-full rounded-full border border-sand bg-white/80 pl-11 pr-11 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-ink/40 hover:border-ink/40 focus:border-olive focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)] [&::-webkit-search-cancel-button]:hidden" />
      {value && <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ink/55 hover:bg-sand/60 hover:text-ink"><X size={16} /></button>}
    </div>
  )
}

const pagerBtn = 'inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/25 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-40'

export function Pager({ meta, loading, noun, onPage }) {
  if (!meta || meta.pages <= 1) return null
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <p className="text-[13px] tabular-nums text-ink/55">Page {meta.page} of {meta.pages} · {meta.total} {noun}</p>
      <div className="flex gap-2">
        <button type="button" disabled={meta.page <= 1 || loading} onClick={() => onPage(meta.page - 1)} className={`${pagerBtn} pl-3 pr-4`}><ChevronLeft size={16} aria-hidden />Prev</button>
        <button type="button" disabled={meta.page >= meta.pages || loading} onClick={() => onPage(meta.page + 1)} className={`${pagerBtn} pl-4 pr-3`}>Next<ChevronRight size={16} aria-hidden /></button>
      </div>
    </div>
  )
}

export function ListSkeleton({ rows = 5, height = 'h-[84px]' }) {
  return (
    <div aria-hidden className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <div key={i} className={`${height} animate-pulse rounded-2xl bg-sand/45 motion-reduce:animate-none`} />)}
    </div>
  )
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="grid place-items-center rounded-[28px] border border-dashed border-sand bg-white/40 px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-sand/60 text-ink/55"><Icon size={26} aria-hidden /></span>
      <p className="mt-4 text-[17px] font-black uppercase italic tracking-tight">{title}</p>
      <p className="mt-1.5 max-w-sm text-[14px] text-ink/60">{children}</p>
      {action}
    </div>
  )
}
