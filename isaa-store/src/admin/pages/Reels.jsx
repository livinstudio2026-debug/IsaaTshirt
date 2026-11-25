import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink, Film, LoaderCircle, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { deleteReel, listReels, saveReelOrder, setReelVisibility } from '../../lib/adminApi'
import { useAdminAuth } from '../../lib/adminAuthContext'
import { useAdminPage } from '../useAdminPage'
import ConfirmDialog from '../orders/ConfirmDialog'
import { btnSolid, ErrorBanner, PageTitle, Switch } from '../products/ui'
import { useToast } from '../products/useToast'
import ReelDialog from '../reels/ReelDialog'

const ids = (rows) => rows.map((r) => r.id).join('|')

// The row of slots the home page actually fills: the first `shows` visible reels, in order.
function WallStrip({ rows, shows }) {
  const live = rows.filter((r) => r.isActive).slice(0, shows)
  return (
    <section aria-label="What the home page shows" className="rounded-[24px] border border-sand bg-white/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.16em]">On the home page now</h2>
        <p className="text-[13px] text-ink/55">{live.length ? `${live.length} of ${shows} spots filled` : 'Nothing yet: the store shows its built-in pictures'}</p>
      </div>
      <ol className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {Array.from({ length: shows }, (_, i) => {
          const r = live[i]
          return (
            <li key={i} className="relative aspect-[9/16] overflow-hidden rounded-xl border border-dashed border-ink/20 bg-sand/30" style={r?.accent ? { boxShadow: `0 8px 18px -10px ${r.accent}` } : undefined}>
              {r && <img src={r.poster.thumb} alt={r.caption || `Reel ${i + 1}`} loading="lazy" className="size-full border-0 object-cover" />}
              <span className="absolute left-1 top-1 grid size-5 place-items-center rounded-full bg-ink/80 text-[10px] font-black text-white tabular-nums">{i + 1}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default function Reels() {
  useAdminPage('Reels')
  const { admin } = useAdminAuth()
  const isOwner = admin.role === 'owner'
  const [toast, say] = useToast()
  const [items, setItems] = useState(null)
  const [meta, setMeta] = useState({ wallShows: 8, max: 24 })
  const [order, setOrder] = useState(null) // unsaved order: a list of ids
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [dialog, setDialog] = useState(null) // { kind: 'add' } | { kind: 'edit' | 'delete', reel }

  useEffect(() => {
    const ac = new AbortController()
    listReels(ac.signal).then(
      (d) => { setItems(d.items); setMeta(d.meta); setError('') },
      (err) => { if (err.name !== 'AbortError') setError(err.message) },
    )
    return () => ac.abort()
  }, [tick])

  const dirty = Boolean(items && order && order.join('|') !== ids(items))
  useEffect(() => {
    if (!dirty) return
    const warn = (e) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (error) return <div className="space-y-5"><PageTitle>Reels</PageTitle><ErrorBanner onRetry={() => { setError(''); setTick((n) => n + 1) }}>{error}</ErrorBanner></div>
  if (!items) return <div aria-hidden className="space-y-4"><div className="h-12 w-1/2 animate-pulse rounded-2xl bg-sand/45" /><div className="h-28 animate-pulse rounded-[24px] bg-sand/45" /><div className="h-72 animate-pulse rounded-[24px] bg-sand/45" /></div>

  const byId = Object.fromEntries(items.map((r) => [r.id, r]))
  const rows = order ? order.map((id) => byId[id]).filter(Boolean) : items
  const current = order ?? items.map((r) => r.id)
  const move = (i, d) => { const n = [...current]; [n[i], n[i + d]] = [n[i + d], n[i]]; setOrder(n) }
  const replace = (reel) => setItems((list) => list.map((r) => (r.id === reel.id ? reel : r)))

  const toggle = async (r, isActive) => {
    setBusyId(r.id)
    try { replace(await setReelVisibility(r.id, isActive)); say(isActive ? 'On the home page in a few seconds.' : 'Hidden from the home page. Nothing was deleted.') } catch (err) { say(err.message, 'error') } finally { setBusyId('') }
  }
  const saveOrder = async () => {
    setSaving(true)
    try { const d = await saveReelOrder(current); setItems(d.items); setMeta(d.meta); setOrder(null); say('Order saved. The home page updates in a few seconds.') } catch (err) { say(err.message, 'error') } finally { setSaving(false) }
  }
  const onSaved = (reel, wasNew) => {
    if (wasNew) { setItems((list) => [...list, reel]); setOrder((o) => (o ? [...o, reel.id] : o)) } else replace(reel)
    setDialog(null)
    say(wasNew ? 'Reel added. It’s on the home page in a few seconds.' : 'Saved. Changes reach the home page in a few seconds.')
  }

  // a visible reel's place among the visible ones decides whether it makes the wall
  const wallRank = new Map(rows.filter((r) => r.isActive).map((r, n) => [r.id, n + 1]))
  return (
    <div className="animate-[rise_.5s_ease-out_both] motion-reduce:animate-none">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>Reels</PageTitle>
          <p className="mt-3 max-w-xl text-[15px] text-ink/65">The Instagram wall on the home page. The first {meta.wallShows} visible reels show, in this order.</p>
        </div>
        {isOwner && <button type="button" disabled={items.length >= meta.max} onClick={() => setDialog({ kind: 'add' })} className={btnSolid}><Plus size={16} aria-hidden />Add reel</button>}
      </div>
      {!isOwner && <p className="mt-5 flex items-start gap-2.5 rounded-2xl border border-sand bg-cream px-4 py-3 text-[14px] text-ink/70"><Lock size={16} className="mt-0.5 shrink-0" aria-hidden />You can hide or show a reel. Only the owner can add, edit, reorder or delete them.</p>}

      <div className="mt-6"><WallStrip rows={rows} shows={meta.wallShows} /></div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-[24px] border border-dashed border-sand px-5 py-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-sand/60 text-ink/60"><Film size={24} aria-hidden /></span>
          <p className="mt-4 text-[17px] font-black uppercase italic">No reels yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[14px] text-ink/60">Until you add one, the home page shows its built-in pictures.{isOwner ? '' : ' Ask the owner to add some.'}</p>
          {isOwner && <button type="button" onClick={() => setDialog({ kind: 'add' })} className={`${btnSolid} mt-5`}><Plus size={16} aria-hidden />Add the first reel</button>}
        </div>
      ) : (
        <ol className="mt-5 space-y-3">
          {rows.map((r, i) => {
            const onWall = r.isActive && wallRank.get(r.id) <= meta.wallShows
            return (
              <li key={r.id} className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[22px] border border-sand bg-white/70 p-3 sm:p-4 ${r.isActive ? '' : 'opacity-75'}`}>
                <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-black tabular-nums text-white">{i + 1}</span>
                <span className={`relative block h-24 w-[3.4rem] shrink-0 overflow-hidden rounded-xl border border-sand bg-ink ${r.isActive ? '' : 'grayscale'}`}>
                  <img src={r.poster.thumb} alt="" loading="lazy" className="size-full object-cover" />
                  {r.video && <span className="absolute bottom-1 right-1 grid size-5 place-items-center rounded-full bg-ink/80 text-white" title="Has a video"><Film size={11} aria-hidden /><span className="sr-only">Has a video</span></span>}
                </span>
                <span className="min-w-0 flex-1 basis-40">
                  <b className="block truncate text-[15px]">{r.caption || 'No caption'}</b>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {r.tag && <span className="rounded-full bg-ink px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">{r.tag}</span>}
                    {!r.isActive ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-amber-900">Hidden</span>
                      : onWall ? <span className="rounded-full bg-olive/12 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-olive">On the home page</span>
                        : <span className="rounded-full bg-sand px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ink/65">Past the first {meta.wallShows}</span>}
                    {r.accent && <span aria-hidden className="size-3.5 rounded-full border border-ink/15" style={{ background: r.accent }} />}
                  </span>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[12.5px] text-ink/55 underline-offset-4 hover:text-ink hover:underline"><span className="truncate">{r.url.replace(/^https:\/\/(www\.)?/, '')}</span><ExternalLink size={12} className="shrink-0" aria-hidden /></a>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <Switch checked={r.isActive} busy={busyId === r.id} onChange={(v) => toggle(r, v)} label={`${r.isActive ? 'Hide' : 'Show'} ${r.caption || `reel ${i + 1}`}`} disabled={dirty} />
                  {isOwner && (
                    <>
                      <button type="button" disabled={i === 0 || saving} onClick={() => move(i, -1)} aria-label={`Move reel ${i + 1} up`} className="grid size-10 place-items-center rounded-full border border-sand bg-white/80 hover:border-ink disabled:opacity-30"><ArrowUp size={16} aria-hidden /></button>
                      <button type="button" disabled={i === rows.length - 1 || saving} onClick={() => move(i, 1)} aria-label={`Move reel ${i + 1} down`} className="grid size-10 place-items-center rounded-full border border-sand bg-white/80 hover:border-ink disabled:opacity-30"><ArrowDown size={16} aria-hidden /></button>
                      <button type="button" disabled={dirty} onClick={() => setDialog({ kind: 'edit', reel: r })} aria-label={`Edit reel ${i + 1}`} className="grid size-10 place-items-center rounded-full border border-sand bg-white/80 hover:border-ink disabled:opacity-30"><Pencil size={15} aria-hidden /></button>
                      <button type="button" disabled={dirty} onClick={() => setDialog({ kind: 'delete', reel: r })} aria-label={`Delete reel ${i + 1}`} className="grid size-10 place-items-center rounded-full border border-sand bg-white/80 text-red-700 hover:border-red-700 hover:bg-red-50 disabled:opacity-30"><Trash2 size={15} aria-hidden /></button>
                    </>
                  )}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {isOwner && dirty && (
        <div className="sticky bottom-[5.25rem] z-20 mt-6 md:bottom-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-full bg-ink px-3 py-2.5 pl-5 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,.6)]">
            <span className="text-[13.5px] font-medium">The new order isn’t saved yet</span>
            <span className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => setOrder(null)} className="h-10 rounded-full px-4 text-[12px] font-bold uppercase tracking-wide text-white/80 hover:text-white disabled:opacity-50">Discard</button>
              <button type="button" disabled={saving} onClick={saveOrder} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-[12px] font-bold uppercase tracking-wide text-ink hover:bg-sand disabled:cursor-wait disabled:opacity-70">
                {saving ? <><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />Saving…</> : 'Save order'}
              </button>
            </span>
          </div>
        </div>
      )}

      {dialog?.kind === 'add' && <ReelDialog open onClose={() => setDialog(null)} onSaved={(r) => onSaved(r, true)} />}
      {dialog?.kind === 'edit' && <ReelDialog key={dialog.reel.id} open reel={dialog.reel} onClose={() => setDialog(null)} onSaved={(r) => onSaved(r, false)} />}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog open danger onClose={() => setDialog(null)} title="Delete this reel?" confirmLabel="Delete for good" busyLabel="Deleting…"
          onConfirm={async () => { await deleteReel(dialog.reel.id); setItems((list) => list.filter((r) => r.id !== dialog.reel.id)); setOrder((o) => o?.filter((id) => id !== dialog.reel.id) ?? null); setDialog(null); say('Reel deleted.') }}>
          <p>“{dialog.reel.caption || 'This reel'}” comes off the home page and out of this list. The uploaded picture stays in Cloudinary.</p>
          <p>Want it gone for now but kept? Go back and switch it to hidden instead.</p>
        </ConfirmDialog>
      )}
      {toast}
    </div>
  )
}
