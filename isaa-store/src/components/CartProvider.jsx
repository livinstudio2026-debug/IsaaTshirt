import { useCallback, useEffect, useMemo, useState } from 'react'
import { CartContext } from '../lib/cartContext'
import { MAX_QTY } from '../lib/format'

// A cart line is one piece in one size and colour: { id, slug, name, img, price, mrp, size, color, qty }.
// The bag lives in localStorage so it survives reloads and is shared between tabs.
const KEY = 'isaa:cart:v1'
const clampQty = (q) => Math.max(1, Math.min(MAX_QTY, q))
const isLine = (l) => l && typeof l.id === 'string' && typeof l.slug === 'string' && typeof l.size === 'string' && Number.isFinite(l.price) && Number.isInteger(l.qty) && l.qty > 0

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(raw) ? raw.filter(isLine).map((l) => ({ ...l, qty: clampQty(l.qty) })) : []
  } catch {
    return []
  }
}

export default function CartProvider({ children }) {
  const [lines, setLines] = useState(read)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(lines)) } catch { /* private mode / quota: the bag still works for this visit */ }
  }, [lines])

  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setLines(read()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((item) => setLines((c) => {
    const at = c.findIndex((l) => l.id === item.id)
    if (at < 0) return [...c, { ...item, qty: clampQty(item.qty) }]
    return c.map((l, i) => (i === at ? { ...l, qty: clampQty(l.qty + item.qty) } : l))
  }), [])
  const setQty = useCallback((id, qty) => setLines((c) => c.map((l) => (l.id === id ? { ...l, qty: clampQty(qty) } : l))), [])
  const remove = useCallback((id) => setLines((c) => c.filter((l) => l.id !== id)), [])
  const clear = useCallback(() => setLines([]), [])
  // bring saved prices/images in line with the live catalogue: `fresh` maps slug -> { price, mrp, img, heroes: { [colour]: url } }
  // (each colour has its own hero picture, so a bag line takes the hero of ITS colour)
  const sync = useCallback((fresh) => setLines((c) => {
    let changed = false
    const next = c.map((l) => {
      const f = fresh[l.slug]
      if (!f) return l
      const img = f.heroes?.[l.color] ?? f.img ?? l.img
      if (f.price === l.price && f.mrp === l.mrp && img === l.img) return l
      changed = true
      return { ...l, price: f.price, mrp: f.mrp, img }
    })
    return changed ? next : c
  }), [])
  const openCart = useCallback(() => setOpen(true), [])
  const closeCart = useCallback(() => setOpen(false), [])

  const value = useMemo(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotal: lines.reduce((n, l) => n + l.price * l.qty, 0),
    add, setQty, remove, clear, sync, open, openCart, closeCart,
  }), [lines, open, add, setQty, remove, clear, sync, openCart, closeCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
