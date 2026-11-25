import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ArrowUp, LoaderCircle, Lock, Plus, X } from 'lucide-react'
import { getPlacements, listAllProducts, savePlacement } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { useAdminPage } from '../useAdminPage'
import { PLACEMENTS } from '../products/catalog'
import { ErrorBanner, PageTitle } from '../products/ui'
import { useToast } from '../products/useToast'

const slugsOf = (rows) => rows.map((r) => r.slug).join('|')
const toRow = (p) => ({ slug: p.slug, name: p.name, thumb: p.colors[0]?.hero?.thumb ?? p.images[0]?.thumb ?? '', isActive: p.isActive })

export default function ProductPlacements() {
  useAdminPage('Home page order')
  const { admin } = useAdminAuth()
  const isOwner = admin.role === 'owner'
  const [toast, say] = useToast()
  const [tab, setTab] = useState('hero')
  const [server, setServer] = useState(null) // { hero: [...], ... } as saved
  const [homeShows, setHomeShows] = useState({})
  const [all, setAll] = useState([])
  const [draft, setDraft] = useState({}) // unsaved lists, by rail
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const ac = new AbortController()
    Promise.all([getPlacements(ac.signal), listAllProducts(ac.signal)]).then(
      ([p, list]) => { setServer(p.rails); setHomeShows(p.homeShows); setAll(list); setError('') },
      (err) => { if (err.name !== 'AbortError') setError(err.message) },
    )
    return () => ac.abort()
  }, [tick])

  const dirtyIds = server ? PLACEMENTS.filter((p) => draft[p.id] && slugsOf(draft[p.id]) !== slugsOf(server[p.id])).map((p) => p.id) : []
  useEffect(() => {
    if (!dirtyIds.length) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  })

  if (error) return <div><Link to="/admin/products" className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink/60 hover:text-ink"><ArrowLeft size={15} aria-hidden />Products</Link><div className="mt-5"><ErrorBanner onRetry={() => { setError(''); setTick((n) => n + 1) }}>{error}</ErrorBanner></div></div>
  if (!server) return <div aria-hidden className="space-y-4"><div className="h-12 w-1/2 animate-pulse rounded-2xl bg-sand/45" /><div className="h-80 animate-pulse rounded-[24px] bg-sand/45" /></div>

  const rail = PLACEMENTS.find((p) => p.id === tab)
  const rows = draft[tab] ?? server[tab]
  const dirty = dirtyIds.includes(tab)
  const limit = homeShows[tab] // shelves show only the first few on the home page
  const setRows = (next) => setDraft((d) => ({ ...d, [tab]: next }))
  const move = (i, dir) => { const n = [...rows]; [n[i], n[i + dir]] = [n[i + dir], n[i]]; setRows(n) }
  const remove = (i) => setRows(rows.filter((_, n) => n !== i))
  const addable = all.filter((p) => !rows.some((r) => r.slug === p.slug))

  const save = async () => {
    setSaving(true)
    try {
      const fresh = await savePlacement(tab, rows.map((r) => r.slug))
      setServer(fresh); setDraft((d) => { const n = { ...d }; delete n[tab]; return n })
      say(`${rail.label} order saved. The store updates in a few seconds.`)
    } catch (err) { say(err.message, 'error') } finally { setSaving(false) }
  }

  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <Link to="/admin/products" className="inline-flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-ink/60 hover:text-ink"><ArrowLeft size={15} aria-hidden />Products</Link>
      <div className="mt-3"><PageTitle>Home page order</PageTitle></div>
      <p className="mt-3 max-w-xl text-[15px] text-ink/65">Pick a section, then put its products in the order shoppers should see them.</p>
      {!isOwner && <p className="mt-4 flex items-start gap-2.5 rounded-2xl border border-sand bg-cream px-4 py-3 text-[14px] text-ink/70"><Lock size={16} className="mt-0.5 shrink-0" aria-hidden />Only the owner can change the order. You can look.</p>}

      <nav aria-label="Home page sections" className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PLACEMENTS.map((p) => {
          const on = p.id === tab
          return (
            <button key={p.id} type="button" aria-pressed={on} onClick={() => setTab(p.id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-bold transition-colors ${on ? 'border-ink bg-ink text-white' : 'border-sand bg-white/60 text-ink/70 hover:border-ink/40 hover:text-ink'}`}>
              {p.label}
              <span className={`grid min-w-6 place-items-center rounded-full px-1.5 text-[11px] leading-5 tabular-nums ${on ? 'bg-white/20' : 'bg-sand/80'}`}>{(draft[p.id] ?? server[p.id]).length}</span>
              {dirtyIds.includes(p.id) && <span className="size-2 rounded-full bg-amber-400" title="Unsaved changes"><span className="sr-only">Unsaved changes</span></span>}
            </button>
          )
        })}
      </nav>

      <section aria-label={rail.label} className="mt-5 rounded-[24px] border border-sand bg-white/70 p-4 sm:p-6">
        <p className="text-[14px] text-ink/65">{rail.hint}{limit ? ` The home page shows the first ${limit}.` : ' Every product listed here appears, in this order.'}</p>

        {rows.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-dashed border-sand px-4 py-8 text-center text-[14px] text-ink/55">Nothing here yet. {isOwner ? 'Add a product below.' : ''}</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {rows.map((r, i) => (
              <li key={r.slug}>
                {limit && i === limit && <p className="my-3 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/45"><span className="h-px flex-1 bg-sand" />Not on the home page<span className="h-px flex-1 bg-sand" /></p>}
                <div className={`flex items-center gap-3 rounded-2xl border p-2.5 pr-3 ${limit && i >= limit ? 'border-sand/70 bg-cream/40 opacity-75' : 'border-sand bg-cream/70'}`}>
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-black tabular-nums text-white">{i + 1}</span>
                  <span className="block h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-sand bg-sand/50">{r.thumb && <img src={r.thumb} alt="" loading="lazy" className="size-full object-contain" />}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[14.5px]">{r.name}</b>
                    {!r.isActive && <span className="text-[12px] font-bold uppercase tracking-wide text-amber-800">Hidden: not shown until it’s live</span>}
                  </span>
                  {isOwner && (
                    <span className="flex shrink-0 items-center gap-1">
                      <button type="button" disabled={i === 0 || saving} onClick={() => move(i, -1)} aria-label={`Move ${r.name} up`} className="grid size-10 place-items-center rounded-full border border-sand bg-white/80 hover:border-ink disabled:opacity-30"><ArrowUp size={16} aria-hidden /></button>
                      <button type="button" disabled={i === rows.length - 1 || saving} onClick={() => move(i, 1)} aria-label={`Move ${r.name} down`} className="grid size-10 place-items-center rounded-full border border-sand bg-white/80 hover:border-ink disabled:opacity-30"><ArrowDown size={16} aria-hidden /></button>
                      <button type="button" disabled={saving} onClick={() => remove(i)} aria-label={`Remove ${r.name} from ${rail.label}`} className="grid size-10 place-items-center rounded-full border border-sand bg-white/80 text-red-700 hover:border-red-700 hover:bg-red-50 disabled:opacity-30"><X size={16} aria-hidden /></button>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}

        {isOwner && (
          <div className="mt-5 flex flex-col gap-3 border-t border-sand pt-5 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2.5">
              <Plus size={16} aria-hidden className="shrink-0 text-ink/55" />
              <select aria-label={`Add a product to ${rail.label}`} value="" disabled={!addable.length || saving} onChange={(e) => { const p = all.find((x) => x.slug === e.target.value); if (p) setRows([...rows, toRow(p)]) }}
                className="h-11 w-full min-w-0 rounded-full border border-sand bg-white/80 px-4 text-[14px] font-medium outline-none hover:border-ink/40 focus:border-olive disabled:opacity-50 sm:w-72">
                <option value="">{addable.length ? 'Add a product…' : 'Every product is already here'}</option>
                {addable.map((p) => <option key={p.slug} value={p.slug}>{p.name}{p.isActive ? '' : ' (hidden)'}</option>)}
              </select>
            </label>
            <span className="flex gap-2">
              <button type="button" disabled={!dirty || saving} onClick={() => setDraft((d) => { const n = { ...d }; delete n[tab]; return n })} className="h-11 rounded-full border border-ink/25 px-5 text-[12px] font-bold uppercase tracking-wide hover:border-ink disabled:pointer-events-none disabled:opacity-40">Discard</button>
              <button type="button" disabled={!dirty || saving} onClick={save} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[12px] font-bold uppercase tracking-wide text-white hover:bg-olive disabled:pointer-events-none disabled:opacity-40">
                {saving ? <><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />Saving…</> : 'Save order'}
              </button>
            </span>
          </div>
        )}
      </section>
      {toast}
    </div>
  )
}
