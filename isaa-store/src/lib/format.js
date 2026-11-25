// Shared money + store rules, so the product page, cart and checkout all quote the same numbers.
export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
export const FREE_SHIPPING_MIN = 1499 // rupees: orders at or above this ship free
export const MAX_QTY = 10 // most of one piece per order line

// Cash-on-delivery fee for a bag (rupees), the same rule the server applies: waived once the subtotal reaches codFreeMin (0 = never waived).
export const codWaived = (config, subtotal) => config.codFreeMin > 0 && subtotal >= config.codFreeMin
export const codFeeFor = (config, subtotal) => (codWaived(config, subtotal) ? 0 : config.codFee)

// Tees are named "<Print> Oversized Tee" and shown as just "<Print>" (the page says what it is). Other pieces keep their full name.
export const displayName = (p) => (p.category === 't-shirts' ? p.name.replace(/\s*Oversized Tee$/, '') : p.name)
// Only tees named "… Oversized Tee" are called that; a fit tee or any other cut is not labelled Oversized.
export const isOversized = (p) => p.category === 't-shirts' && /\s*Oversized Tee$/.test(p.name)
export const kindLine = (p) => (isOversized(p) ? `Oversized Tee · ${p.color}` : p.color)

// "Racing Championship Oversized Tee" -> ['Racing Championship Oversized', 'Tee']; "Orbit Hoodie" -> ['Orbit', 'Hoodie'].
// The last word is what the piece is, shown in script on the Featured Drop. A one-word name has no kind word to show.
export function splitKind(name) {
  const m = /^(.*\S)\s+(\S+)$/.exec(name.trim())
  return m ? [m[1], m[2]] : [name.trim(), '']
}
