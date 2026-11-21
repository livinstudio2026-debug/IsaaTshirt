// Shared money + store rules, so the product page, cart and checkout all quote the same numbers.
export const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN')
export const FREE_SHIPPING_MIN = 1499 // rupees: orders at or above this ship free
export const MAX_QTY = 10 // most of one piece per order line

// Tees are named "<Print> Oversized Tee" and shown as just "<Print>" (the page says what it is). Other pieces keep their full name.
export const displayName = (p) => (p.category === 't-shirts' ? p.name.replace(/\s*Oversized Tee$/, '') : p.name)
export const kindLine = (p) => (p.category === 't-shirts' ? `Oversized Tee · ${p.color}` : p.color)
