import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react'
import { sized } from '../../lib/api'

const MIN = 1
const MAX = 4
const DOUBLE = 2.5
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// The zoomable photo. Fits the screen first; then: pinch (touch), wheel (mouse/trackpad), double-tap/double-click,
// the +/- buttons or the +/-/0 keys to zoom, and drag to move around. Remounted per photo (key), so each starts fitted.
function Viewer({ img }) {
  const [view, setView] = useState({ s: 1, x: 0, y: 0 })
  const [smooth, setSmooth] = useState(false) // animate button/double-tap zooms, never drags
  const stage = useRef(null)
  const pic = useRef(null)
  const pts = useRef(new Map())
  const g = useRef({ d: null, moved: 0 })
  const tap = useRef({ t: 0, x: 0, y: 0 })
  const live = useRef(view)
  useEffect(() => { live.current = view })

  // keep the picture from being dragged off-screen
  const fit = ({ s, x, y }) => {
    const w = pic.current?.offsetWidth ?? 0
    const h = pic.current?.offsetHeight ?? 0
    const mx = (w * s - w) / 2
    const my = (h * s - h) / 2
    return s <= MIN ? { s: MIN, x: 0, y: 0 } : { s, x: clamp(x, -mx, mx), y: clamp(y, -my, my) }
  }
  // zoom to `ns`, keeping the point (px, py) — measured from the centre of the stage — where it is
  const zoomAt = (ns, px = 0, py = 0, animate = false) => {
    const v = live.current
    const s = clamp(ns, MIN, MAX)
    const k = s / v.s
    setSmooth(animate)
    setView(fit({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k }))
  }
  const centred = (e) => {
    const r = stage.current.getBoundingClientRect()
    return [e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)]
  }

  const panBy = (dx, dy) => {
    setSmooth(false)
    setView(fit({ ...live.current, x: live.current.x + dx, y: live.current.y + dy }))
  }

  useEffect(() => {
    const el = stage.current
    const onWheel = (e) => {
      e.preventDefault()
      const v = live.current
      const r = el.getBoundingClientRect()
      const px = e.clientX - (r.left + r.width / 2)
      const py = e.clientY - (r.top + r.height / 2)
      if (e.ctrlKey || e.metaKey) zoomAt(v.s * Math.exp(-e.deltaY * 0.01), px, py) // trackpad pinch, or Ctrl + wheel
      else if (v.s > MIN) panBy(-e.deltaX, -e.deltaY) // zoomed in: the wheel scrolls around the photo
      else if (e.deltaY < 0) zoomAt(DOUBLE, px, py, true) // fitted: scrolling up zooms in
    }
    const onKey = (e) => {
      const v = live.current
      if (e.key === '+' || e.key === '=') zoomAt(v.s * 1.5, 0, 0, true)
      else if (e.key === '-') zoomAt(v.s / 1.5, 0, 0, true)
      else if (e.key === '0') zoomAt(1, 0, 0, true)
      else if (v.s > MIN && e.key.startsWith('Arrow')) {
        // zoomed in: arrow keys move around the photo instead of switching photos
        e.preventDefault()
        e.stopImmediatePropagation()
        const step = 80
        panBy(e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0, e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('wheel', onWheel); window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const down = (e) => {
    stage.current.setPointerCapture?.(e.pointerId)
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pts.current.size === 1) g.current.moved = 0
    g.current.d = null
  }
  const move = (e) => {
    const prev = pts.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    pts.current.set(e.pointerId, cur)
    if (pts.current.size === 1) {
      const dx = cur.x - prev.x
      const dy = cur.y - prev.y
      g.current.moved += Math.abs(dx) + Math.abs(dy)
      if (live.current.s > MIN) { setSmooth(false); setView(fit({ ...live.current, x: live.current.x + dx, y: live.current.y + dy })) }
    } else if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      g.current.moved = 99
      if (g.current.d) {
        const r = stage.current.getBoundingClientRect()
        zoomAt(live.current.s * (d / g.current.d), (a.x + b.x) / 2 - (r.left + r.width / 2), (a.y + b.y) / 2 - (r.top + r.height / 2))
      }
      g.current.d = d
    }
  }
  const up = (e) => {
    const wasTap = pts.current.size === 1 && g.current.moved < 8
    pts.current.delete(e.pointerId)
    g.current.d = null
    if (!wasTap || e.type !== 'pointerup') return
    // two quick taps in the same spot toggle between fitted and zoomed
    const now = Date.now()
    const t = tap.current
    if (now - t.t < 320 && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30) {
      const [px, py] = centred(e)
      zoomAt(live.current.s > MIN ? MIN : DOUBLE, px, py, true)
      tap.current = { t: 0, x: 0, y: 0 }
    } else tap.current = { t: now, x: e.clientX, y: e.clientY }
  }

  const btn = 'grid h-11 w-11 place-items-center rounded-full transition-colors hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-30'
  return (
    <>
      <div ref={stage} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className={`absolute inset-0 touch-none select-none overflow-hidden ${view.s > MIN ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}>
        <div className="grid h-full w-full place-items-center px-4 pb-24 pt-20 sm:px-16">
          <img ref={pic} src={sized(img.url, 1800)} alt={img.alt} width="1200" height="1300" draggable="false"
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: smooth ? 'transform .3s cubic-bezier(.2,.8,.2,1)' : 'none' }}
            className="block h-auto max-h-full w-auto max-w-full select-none object-contain drop-shadow-[0_30px_30px_rgba(70,45,15,.28)]" />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-5 z-10 flex flex-col items-center gap-2">
        <p aria-hidden className="pointer-events-none font-script text-[20px] text-olive">{view.s === MIN ? 'Double-tap, pinch or scroll up to zoom' : 'Drag or scroll to look around'}</p>
        <div role="group" aria-label="Zoom" className="inline-flex items-center rounded-full border border-ink/80 bg-cream/90 p-1 backdrop-blur">
          <button type="button" aria-label="Zoom out" disabled={view.s <= MIN} onClick={() => zoomAt(view.s / 1.6, 0, 0, true)} className={btn}><Minus size={18} /></button>
          <output aria-live="polite" className="w-14 text-center text-[13px] font-bold tabular-nums">{Math.round(view.s * 100)}%</output>
          <button type="button" aria-label="Zoom in" disabled={view.s >= MAX} onClick={() => zoomAt(view.s * 1.6, 0, 0, true)} className={btn}><Plus size={18} /></button>
        </div>
      </div>
    </>
  )
}

// Full-screen dialog around the Viewer. Esc closes, arrow keys switch photos, Tab stays inside.
export default function Lightbox({ images, index, onClose, onIndex }) {
  const closeBtn = useRef(null)
  const panel = useRef(null)
  const n = images.length
  const live = useRef({ index, n, onClose, onIndex })
  useEffect(() => { live.current = { index, n, onClose, onIndex } })

  useEffect(() => {
    const root = document.documentElement
    const opener = document.activeElement
    root.style.overflow = 'hidden'
    closeBtn.current?.focus()
    const onKey = (e) => {
      const { index: i, n: count, onClose: close, onIndex: go } = live.current
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' && count > 1) go((i + 1) % count)
      else if (e.key === 'ArrowLeft' && count > 1) go((i - 1 + count) % count)
      else if (e.key === 'Tab') {
        const f = panel.current?.querySelectorAll('button:not([disabled])')
        if (!f?.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { root.style.overflow = ''; window.removeEventListener('keydown', onKey); opener?.focus?.() }
  }, [])

  const arrow = 'absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-ink/80 bg-cream/90 backdrop-blur transition-colors hover:bg-ink hover:text-white'

  return (
    <div ref={panel} role="dialog" aria-modal="true" aria-label="Zoomed photo" className="fixed inset-0 z-[200] animate-[fade-in_.25s_ease-out] bg-cream motion-reduce:animate-none">
      <Viewer key={images[index].url} img={images[index]} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 lg:px-[3vw]">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] tabular-nums text-ink/60">{n > 1 ? `${index + 1} / ${n}` : ''}</p>
        <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close zoomed photo" className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full bg-ink pl-5 pr-4 text-[12px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-olive">Close <X size={20} aria-hidden /></button>
      </div>

      {n > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => onIndex((index - 1 + n) % n)} className={`${arrow} left-3 lg:left-[2vw]`}><ChevronLeft size={22} /></button>
          <button type="button" aria-label="Next photo" onClick={() => onIndex((index + 1) % n)} className={`${arrow} right-3 lg:right-[2vw]`}><ChevronRight size={22} /></button>
        </>
      )}
    </div>
  )
}