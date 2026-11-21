import { useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { Dialog } from './shared'

// A "are you sure?" box for actions that can't be undone. `onConfirm(reason)` may throw: the message is shown and the box stays open.
export default function ConfirmDialog({ open, onClose, title, children, confirmLabel, busyLabel = 'Working…', danger = false, reasonLabel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const run = async () => {
    if (busy) return
    setBusy(true); setError('')
    try { await onConfirm(reason.trim()) } catch (err) { setError(err.message); setBusy(false) }
  }
  const close = () => { if (!busy) { setError(''); onClose() } }

  return (
    <Dialog open={open} onClose={close} title={title} busy={busy}>
      <span className={`grid size-12 place-items-center rounded-full ${danger ? 'bg-red-100 text-red-800' : 'bg-olive/15 text-olive'}`}><CircleAlert size={22} aria-hidden /></span>
      <h2 className="mt-4 text-[26px] font-black uppercase italic leading-none tracking-tight">{title}</h2>
      <div className="mt-3 space-y-2 text-[14.5px] leading-relaxed text-ink/70">{children}</div>
      {reasonLabel && (
        <label className="mt-5 block">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50">{reasonLabel} <span className="font-normal normal-case tracking-normal">(optional)</span></span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} disabled={busy} className="mt-1.5 h-12 w-full rounded-2xl border border-sand bg-white/80 px-4 text-base outline-none focus:border-olive focus:shadow-[0_0_0_4px_rgba(107,106,34,.14)]" />
        </label>
      )}
      {error && <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-600/25 bg-red-50 px-4 py-3 text-[14px] text-red-800"><CircleAlert size={17} className="mt-0.5 shrink-0" aria-hidden />{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={close} disabled={busy} className="h-12 rounded-full border border-ink/25 px-6 text-[13px] font-bold uppercase tracking-wide hover:border-ink disabled:opacity-50">Go back</button>
        <button type="button" onClick={run} disabled={busy} className={`inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[13px] font-bold uppercase tracking-wide text-white transition-colors disabled:cursor-wait disabled:opacity-80 ${danger ? 'bg-red-700 hover:bg-red-800' : 'bg-ink hover:bg-olive'}`}>
          {busy ? <><LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden />{busyLabel}</> : confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
