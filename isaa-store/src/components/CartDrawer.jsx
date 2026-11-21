import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X, Minus, Plus, Trash2, ArrowRight, Truck, Check } from 'lucide-react'
import { useCart } from '../lib/cartContext'
import { useStoreConfig, fallback } from '../hooks/useStoreConfig'
import { inr, MAX_QTY } from '../lib/format'
import hanger from '../assets/featuredDrop/hanger.webp'

const title = (name) => name.replace(/\s*Oversized Tee$/, '')
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Free-shipping progress: how far the bag is from the minimum, and a tick once it's there.
export function ShippingProgress({ subtotal, min }) {
  const left = Math.max(0, min - subtotal)
  const pct = Math.min(100, (subtotal / min) * 100)
  return (
    <div>
      <p className="flex items-center gap-2 text-[13px] font-semibold">
        {left > 0 ? (<><Truck size={16} className="text-olive" aria-hidden /> Add <b className="tabular-nums">{inr(left)}</b> more for free shipping</>) : (<><Check size={16} strokeWidth={2.8} className="text-olive" aria-hidden /> You’ve unlocked free shipping</>)}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand" role="progressbar" aria-label="Progress to free shipping" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className="h-full rounded-full bg-olive transition-[width] duration-700 ease-[cubic-bezier(.7,0,.2,1)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function CartDrawer() {
  const { lines, count, subtotal, setQty, remove, open, closeCart } = useCart()
  const { config } = useStoreConfig()
  const min = (config ?? fallback).freeShippingMin
  const panel = useRef(null)
  const closeBtn = useRef(null)

  // scroll lock (on <html>, like the mobile menu), Esc to close, focus in and back out, Tab kept inside
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    const before = document.activeElement
    const prevOverflow = root.style.overflow
    root.style.overflow = 'hidden'
    const t = setTimeout(() => closeBtn.current?.focus(), 80)
    const onKey = (e) => {
      if (e.key === 'Escape') return closeCart()
      if (e.key !== 'Tab' || !panel.current) return
      const f = [...panel.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!f.length) return
      const first = f[0], last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(t); root.style.overflow = prevOverflow; window.removeEventListener('keydown', onKey); before?.focus?.() }
  }, [open, closeCart])

  return (
    <div inert={!open} aria-hidden={!open} className={`fixed inset-0 z-[80] ${open ? '' : 'pointer-events-none'}`}>
      <div onClick={closeCart} className={`absolute inset-0 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
      <aside ref={panel} role="dialog" aria-modal="true" aria-label="Your bag"
        className={`absolute inset-y-0 right-0 flex w-full max-w-[28rem] flex-col bg-cream shadow-[-24px_0_60px_rgba(13,13,13,.18)] transition-transform duration-500 ease-[cubic-bezier(.7,0,.2,1)] motion-reduce:transition-none ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="flex items-center justify-between gap-4 border-b border-sand px-5 py-4 sm:px-6">
          <h2 className="flex items-baseline gap-3 font-black italic uppercase leading-none tracking-tight text-[28px]" style={{ fontVariationSettings: '"wdth" 84' }}>
            Your bag <span className="text-[13px] not-italic font-bold tracking-normal text-olive tabular-nums">{count} {count === 1 ? 'item' : 'items'}</span>
          </h2>
          <button ref={closeBtn} onClick={closeCart} aria-label="Close bag" className="grid size-10 place-items-center rounded-full transition-colors hover:bg-sand/70"><X size={22} /></button>
        </header>

        {lines.length === 0 ? (
          <div className="grid flex-1 place-items-center px-8 text-center">
            <div>
              <img src={hanger} alt="" aria-hidden width="1150" height="697" className="mx-auto w-28 origin-top animate-[swing_4s_ease-in-out_infinite] motion-reduce:animate-none" />
              <p className="mt-4 text-xl font-black italic uppercase tracking-tight" style={{ fontVariationSettings: '"wdth" 84' }}>Your bag is empty</p>
              <p className="mt-1 font-script text-[26px] leading-tight text-olive -rotate-2">Fill it with something loud</p>
              <Link to="/shop" onClick={closeCart} className="group mt-7 inline-flex items-center gap-3 rounded-full bg-ink px-8 py-4 text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">
                Shop the drop <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-sand px-5 py-4 sm:px-6"><ShippingProgress subtotal={subtotal} min={min} /></div>
            <ul className="flex-1 divide-y divide-sand overflow-y-auto overscroll-contain px-5 sm:px-6">
              {lines.map((l) => (
                <li key={l.id} className="flex gap-4 py-5">
                  <Link to={`/product/${l.slug}`} onClick={closeCart} className="block h-28 w-24 shrink-0 overflow-hidden rounded-2xl bg-sand/45">
                    <img src={l.img} alt="" width="240" height="260" className="size-full object-contain p-1" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/product/${l.slug}`} onClick={closeCart} className="min-w-0 font-bold leading-snug transition-colors hover:text-olive">{title(l.name)}</Link>
                      <button onClick={() => remove(l.id)} aria-label={`Remove ${title(l.name)}`} className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-ink/45 transition-colors hover:bg-sand/70 hover:text-red-700"><Trash2 size={17} /></button>
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink/60">{[l.color, l.size && `Size ${l.size}`].filter(Boolean).join(' · ')}</p>
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <div className="inline-flex h-10 items-center rounded-full border border-ink/25">
                        <button aria-label="Decrease quantity" disabled={l.qty <= 1} onClick={() => setQty(l.id, l.qty - 1)} className="grid h-full w-9 place-items-center rounded-full transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30"><Minus size={14} /></button>
                        <output className="w-7 text-center text-[14px] font-bold tabular-nums" aria-live="polite">{l.qty}</output>
                        <button aria-label="Increase quantity" disabled={l.qty >= MAX_QTY} onClick={() => setQty(l.id, l.qty + 1)} className="grid h-full w-9 place-items-center rounded-full transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30"><Plus size={14} /></button>
                      </div>
                      <p className="text-right leading-tight">
                        <b className="block tabular-nums">{inr(l.price * l.qty)}</b>
                        {l.mrp > l.price && <s className="text-[12px] tabular-nums text-ink/40">{inr(l.mrp * l.qty)}</s>}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <footer className="border-t border-sand bg-white/50 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-6">
              <p className="flex items-baseline justify-between text-[17px] font-bold"><span>Subtotal</span><span className="tabular-nums">{inr(subtotal)}</span></p>
              <p className="mt-1 text-[13px] text-ink/55">Shipping and any COD fee are shown at checkout.</p>
              <Link to="/checkout" onClick={closeCart} className="group mt-4 flex h-14 items-center justify-center gap-3 rounded-full bg-ink text-[13px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">
                Checkout <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <button onClick={closeCart} className="mt-2 w-full py-3 text-[13px] font-semibold text-ink/60 underline-offset-4 transition-colors hover:text-ink hover:underline">Continue shopping</button>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
