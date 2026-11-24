import { useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, LoaderCircle, MapPin, PackageCheck, Pencil, Plus } from 'lucide-react'
import { getProductHistory } from '../../lib/adminApi'
import { inr } from '../../lib/format'
import { ago, fullDateTime } from '../orders/format'
import { ErrorBanner } from './ui'

// A value as the team reads it. `kind` comes from the server, so every screen shows the same change the same way.
const show = (c, v) => {
  switch (c.kind) {
    case 'money': return v == null ? '—' : inr(v / 100)
    case 'bool': return c.field === 'isActive' ? (v ? 'Live' : 'Hidden') : v ? 'On' : 'Off'
    case 'list': return v?.length ? v.join(', ') : 'none'
    case 'position': return v == null ? 'Not listed' : `#${v}`
    case 'number': return v ?? '—'
    default: return v === null || v === '' ? '—' : String(v)
  }
}

const ACTIONS = {
  create: { Icon: Plus, label: 'Added the product' },
  update: { Icon: Pencil, label: 'Edited the product' },
  stock: { Icon: PackageCheck, label: 'Changed stock' },
  visibility: { Icon: Eye, label: 'Changed visibility' },
  placement: { Icon: MapPin, label: 'Moved it on the home page' },
  delete: { Icon: Pencil, label: 'Deleted the product' },
}

function Row({ c }) {
  if (c.kind === 'event') return <li className="text-[14px]"><b>{c.label}</b> <span className="text-ink/65">{c.to}</span></li>
  const long = c.field === 'description' || c.field === 'name'
  return (
    <li className="text-[14px]">
      <span className="font-bold">{c.label}</span>
      <span className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${long ? 'sm:flex-nowrap' : ''}`}>
        <span className="min-w-0 break-words text-ink/50 line-through decoration-ink/30">{show(c, c.from)}</span>
        <ArrowRight size={13} aria-label="changed to" className="shrink-0 text-ink/40" />
        <span className="min-w-0 break-words font-semibold">{show(c, c.to)}</span>
      </span>
      {c.note && <span className="mt-0.5 block text-[12.5px] text-amber-800">{c.note}</span>}
    </li>
  )
}

function Entry({ e }) {
  const hidden = e.action === 'visibility' && e.changes[0]?.to === false
  const { Icon, label } = ACTIONS[e.action] ?? ACTIONS.update
  const Ic = e.action === 'visibility' && hidden ? EyeOff : Icon
  return (
    <li className="relative">
      <span aria-hidden className="absolute -left-[31px] top-0 grid size-6 place-items-center rounded-full border-2 border-cream bg-ink text-white"><Ic size={12} /></span>
      <p className="text-[14.5px]"><b>{e.by}</b> <span className="text-ink/60">{label.charAt(0).toLowerCase() + label.slice(1)}</span>
        <time dateTime={e.at} title={fullDateTime(e.at)} className="text-ink/45"> · {ago(e.at)}</time></p>
      {e.note && <p className="mt-0.5 text-[13.5px] text-ink/65">{e.note}</p>}
      {e.changes.length > 0 && <ul className="mt-2 space-y-2 rounded-2xl border border-sand bg-cream/60 px-4 py-3">{e.changes.map((c) => <Row key={c.field} c={c} />)}</ul>}
    </li>
  )
}

// Who changed what on this product, newest first. `refreshKey` changes whenever the page itself saved something, so the log catches up.
export default function ChangeLog({ slug, refreshKey = 0 }) {
  const [state, setState] = useState({ items: null, meta: null, error: '' })
  const [more, setMore] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    getProductHistory(slug, { page: 1 }, ac.signal).then(
      (d) => setState({ items: d.items, meta: d.meta, error: '' }),
      (err) => { if (err.name !== 'AbortError') setState((s) => ({ ...s, error: err.message })) },
    )
    return () => ac.abort()
  }, [slug, refreshKey, tick])

  const older = async () => {
    setMore(true)
    try {
      const d = await getProductHistory(slug, { page: state.meta.page + 1 })
      setState((s) => ({ items: [...s.items, ...d.items.filter((x) => !s.items.some((y) => y.id === x.id))], meta: d.meta, error: '' }))
    } catch (err) { setState((s) => ({ ...s, error: err.message })) } finally { setMore(false) }
  }

  if (state.error && !state.items) return <ErrorBanner onRetry={() => { setState({ items: null, meta: null, error: '' }); setTick((n) => n + 1) }}>{state.error}</ErrorBanner>
  if (!state.items) return <div aria-hidden className="space-y-3"><div className="h-14 animate-pulse rounded-2xl bg-sand/45 motion-reduce:animate-none" /><div className="h-14 animate-pulse rounded-2xl bg-sand/45 motion-reduce:animate-none" /></div>
  if (!state.items.length) return <p className="rounded-2xl border border-dashed border-sand px-4 py-6 text-center text-[14px] text-ink/55">Nothing yet. Price, stock, picture and visibility changes made from now on will be listed here.</p>

  const left = state.meta.total - state.items.length
  return (
    <div>
      <ol className="space-y-5 border-l-2 border-sand pl-6">{state.items.map((e) => <Entry key={e.id} e={e} />)}</ol>
      {state.error && <p role="alert" className="mt-3 text-[13px] font-medium text-red-700">{state.error}</p>}
      {left > 0 && (
        <button type="button" onClick={older} disabled={more} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-ink/25 px-5 text-[12px] font-bold uppercase tracking-wide hover:border-ink hover:bg-ink hover:text-white disabled:cursor-wait disabled:opacity-60">
          {more && <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />}Show {Math.min(left, 15)} older
        </button>
      )}
    </div>
  )
}
