import { createContext, useContext } from 'react'

export const WishlistContext = createContext(null)

// { slugs (newest first), count, has(slug), toggle(slug, name?), remove(slug), clear(), undo() }
export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>')
  return ctx
}
