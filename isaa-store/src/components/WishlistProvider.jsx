import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Undo2 } from 'lucide-react'
import { WishlistContext } from '../lib/wishlistContext'

// The wishlist is the list of product addresses (slugs) a shopper has hearted, newest first.
// It lives in localStorage, like the bag: it survives reloads, is shared between tabs, and stays on this device (there are no accounts).
// Only the slugs are kept: the page fetches fresh prices and stock, so nothing here can go stale.
const KEY = 'isaa:wishlist:v1'
const MAX = 60
const isSlug = (s) => typeof s === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) && s.length <= 120

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(raw) ? [...new Set(raw.filter(isSlug))].slice(0, MAX) : []
  } catch {
    return []
  }
}

export default function WishlistProvider({ children }) {
  const [slugs, setSlugs] = useState(read)
  const [toast, setToast] = useState(null) // { kind: 'added' | 'removed', slug, name }
  const timer = useRef(0)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(slugs)) } catch { /* private mode / quota: it still works for this visit */ }
  }, [slugs])
  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setSlugs(read()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])

  const say = useCallback((t) => {
    setToast(t)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 4200)
  }, [])

  const toggle = useCallback((slug, name = '') => {
    if (!isSlug(slug)) return
    const had = slugs.includes(slug)
    setSlugs((c) => (c.includes(slug) ? c.filter((s) => s !== slug) : [slug, ...c].slice(0, MAX)))
    say({ kind: had ? 'removed' : 'added', slug, name })
  }, [slugs, say])
  const remove = useCallback((slug) => setSlugs((c) => c.filter((s) => s !== slug)), [])
  const clear = useCallback(() => setSlugs([]), [])
  const undo = useCallback(() => {
    if (toast?.kind === 'removed') setSlugs((c) => (c.includes(toast.slug) ? c : [toast.slug, ...c]))
    setToast(null)
  }, [toast])

  const value = useMemo(() => ({ slugs, count: slugs.length, has: (s) => slugs.includes(s), toggle, remove, clear, undo }), [slugs, toggle, remove, clear, undo])

  return (
    <WishlistContext.Provider value={value}>
      {children}
      {/* a small confirmation, so it's clear where the heart put the piece */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4">
        {toast && (
          <div key={`${toast.kind}-${toast.slug}`} className="pointer-events-auto flex max-w-[min(92vw,26rem)] animate-[rise_.35s_ease-out_both] items-center gap-3 rounded-full bg-ink py-2 pl-4 pr-2 text-[14px] text-white shadow-[0_18px_40px_-14px_rgba(0,0,0,.6)] motion-reduce:animate-none">
            <Heart size={16} aria-hidden className={toast.kind === 'added' ? 'shrink-0 fill-amber-300 text-amber-300' : 'shrink-0 text-white/60'} />
            <span className="min-w-0 truncate">{toast.kind === 'added' ? 'Saved to your wishlist' : 'Removed from your wishlist'}</span>
            {toast.kind === 'added'
              ? <Link to="/wishlist" onClick={() => setToast(null)} className="shrink-0 rounded-full bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-ink hover:bg-sand">View</Link>
              : <button type="button" onClick={undo} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-ink hover:bg-sand"><Undo2 size={13} aria-hidden />Undo</button>}
          </div>
        )}
      </div>
    </WishlistContext.Provider>
  )
}
