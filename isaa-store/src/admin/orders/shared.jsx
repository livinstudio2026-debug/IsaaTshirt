import { useEffect, useRef } from 'react'
import { STATUS } from './format'

export function StatusBadge({ status, className = '' }) {
  const s = STATUS[status] ?? { label: status, tone: 'bg-sand text-ink' }
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${s.tone} ${className}`}>{s.label}</span>
}

export function PaymentBadge({ payment, className = '' }) {
  const cod = payment.method === 'cod'
  const paid = payment.status === 'paid'
  const label = paid ? (cod ? 'COD · Paid' : 'Paid online') : cod ? 'COD · To collect' : `Online · ${payment.status}`
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${paid ? 'bg-olive/12 text-olive' : 'bg-ink/8 text-ink/70'} ${className}`}>{label}</span>
}

// A native <dialog>: focus is trapped, Esc closes it, and the page behind can't be reached. `busy` keeps it open while saving.
export function Dialog({ open, onClose, title, children, busy = false, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
    document.documentElement.style.overflow = open ? 'hidden' : ''
    return () => { document.documentElement.style.overflow = '' }
  }, [open])
  return (
    <dialog ref={ref} aria-label={title} onCancel={(e) => { e.preventDefault(); if (!busy) onClose() }} onMouseDown={(e) => { if (e.target === ref.current && !busy) onClose() }}
      className={`m-auto max-h-[92svh] ${wide ? 'w-[min(94vw,34rem)]' : 'w-[min(94vw,28rem)]'} overflow-y-auto rounded-[28px] border border-sand bg-cream p-0 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,.5)] backdrop:bg-ink/55 backdrop:backdrop-blur-[2px]`}>
      {open && <div className="p-6 sm:p-8">{children}</div>}
    </dialog>
  )
}
