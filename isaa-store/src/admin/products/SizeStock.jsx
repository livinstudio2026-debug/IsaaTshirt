import { useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { setProductStock } from '../../lib/adminApi'

// One size and its stock. Tap to type a new number; Enter or tapping away saves, Esc cancels. It saves straight away (owner and staff):
// the server only applies it if the number is still what you were looking at, so it can never wipe out an order that just came in.
// onSaved(product, message?) gets the fresh product; onError(message) is for the toast.
export default function SizeStock({ product, size, stock, low, onSaved, onError }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const skip = useRef(false)

  const start = () => { setValue(String(stock)); setEditing(true) }
  const commit = async () => {
    if (skip.current) { skip.current = false; return }
    const n = Number(value)
    if (value.trim() === '' || !Number.isInteger(n) || n < 0 || n > 9999) { setEditing(false); return onError('Stock must be a whole number from 0 to 9999.') }
    if (n === stock) return setEditing(false)
    setBusy(true)
    try {
      onSaved(await setProductStock(product.slug, size, stock, n), `${product.name} · ${size}: ${n} in stock`)
    } catch (err) {
      if (err.current) onSaved(err.current) // someone else changed it: show the real number
      onError(err.message)
    } finally { setBusy(false); setEditing(false) }
  }

  const tone = stock === 0 ? 'border-red-300 bg-red-50 text-red-800' : low ? 'border-amber-400 bg-amber-50 text-amber-950' : 'border-sand bg-white/80 text-ink'

  if (editing) {
    return (
      <label className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-olive bg-white px-2.5 text-[13px] shadow-[0_0_0_4px_rgba(107,106,34,.14)]">
        <b className="w-7 text-center">{size}</b>
        <input autoFocus type="number" inputMode="numeric" min={0} max={9999} step={1} value={value} aria-label={`Stock for size ${size}`}
          onChange={(e) => setValue(e.target.value)} onFocus={(e) => e.target.select()} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { skip.current = true; setEditing(false) } }}
          className="w-14 bg-transparent text-right text-base font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      </label>
    )
  }
  return (
    <button type="button" onClick={start} disabled={busy} aria-label={`Size ${size}: ${stock} in stock. Change stock`} title="Tap to change stock"
      className={`inline-flex h-10 min-w-[4.25rem] items-center justify-between gap-2 rounded-xl border px-2.5 text-[13px] tabular-nums transition-colors hover:border-ink/60 disabled:cursor-wait ${tone}`}>
      <b>{size}</b>
      {busy ? <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <span className="font-bold">{stock}</span>}
    </button>
  )
}
