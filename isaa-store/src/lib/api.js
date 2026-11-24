// Storefront → Isaa API. In dev, Vite proxies /api to the server (see vite.config.js).
// In production set VITE_API_URL to the API's origin, e.g. https://isaa-api.example.com
// Origin only (no trailing slash, no /api): the paths below already start with /api.
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')
export const API_BASE = BASE // the admin client (lib/adminApi.js) talks to the same server

// The API sends prices in paise; the UI works in rupees.
// Every colour has its own hero picture (`img`): lists show the first colour's, the product page swaps it as the shopper picks a colour.
// `images` are the pictures every colour shares, shown after the hero: images[0] is the back shot.
const toTee = (p) => {
  const colors = (p.colors ?? []).map((c) => ({ name: c.name, hex: c.hex, img: c.hero?.url ?? '', alt: c.hero?.alt || `${p.name} in ${c.name}` }))
  return {
    id: p.slug,
    slug: p.slug,
    name: p.name,
    color: colors[0]?.name ?? '',
    colors,
    price: p.price / 100,
    mrp: p.mrp / 100,
    img: colors[0]?.img ?? '', // the first colour's hero
    limited: p.isLimited,
    back: p.images[0]?.url ?? null, // the back shot, when there is one
    category: p.category,
    isBest: p.isBestSeller,
    isNew: p.isNewArrival,
    inStock: p.inStock,
  }
}

// Full product for the detail page: everything toTee has, plus the shared pictures, sizes and copy.
const toProduct = (p) => ({
  ...toTee(p),
  description: p.description ?? '',
  tagline: p.tagline ?? '', // this product's own line; '' means use its category's
  images: p.images.map((i, n) => ({ url: i.url, alt: i.alt || `${p.name}, view ${n + 2}` })), // after the hero: [0] back, then details
  sizes: p.sizes ?? [], // [{ size, stock }]
})

async function getPlacement(placement, signal, limit) {
  const res = await fetch(`${BASE}/api/products?placement=${placement}${limit ? `&limit=${limit}` : ''}`, { signal })
  if (!res.ok) throw new Error(`Could not load products (${res.status})`)
  const { data } = await res.json()
  return data.map(toTee)
}

// Both home-page rails, in the order set by heroOrder / featuredOrder in the database.
export async function fetchHomeRails(signal) {
  const [hero, featured] = await Promise.all([getPlacement('hero', signal), getPlacement('featured', signal)])
  return { hero, featured }
}

// The Best Sellers / New Arrivals shelves: the first 5 of each, in the order set in the database.
export async function fetchShelves(signal) {
  const [best, fresh] = await Promise.all([getPlacement('bestsellers', signal, 5), getPlacement('newarrivals', signal, 5)])
  return { best, fresh }
}

// Shop page: one page of the catalogue. `collection` is '', 'new', 'bestsellers' or 'limited'.
export const SHOP_PAGE_SIZE = 12
const COLLECTION_FLAG = { new: 'newArrival', bestsellers: 'bestSeller', limited: 'limited' }
export async function fetchProducts({ category, collection, sort = 'newest', page = 1, limit = SHOP_PAGE_SIZE }, signal) {
  const qs = new URLSearchParams({ sort, page, limit })
  if (category) qs.set('category', category)
  if (COLLECTION_FLAG[collection]) qs.set(COLLECTION_FLAG[collection], 'true')
  const res = await fetch(`${BASE}/api/products?${qs}`, { signal })
  if (!res.ok) throw new Error(`Could not load products (${res.status})`)
  const { data, meta } = await res.json()
  return { items: data.map(toTee), meta }
}

// Search: products matching every word, best match first. `sort` is 'relevance' (default), 'newest', 'price-asc' or 'price-desc'.
export async function searchProducts({ q, sort, page = 1, limit = SHOP_PAGE_SIZE }, signal) {
  const qs = new URLSearchParams({ q, page, limit })
  if (sort && sort !== 'relevance') qs.set('sort', sort)
  const res = await fetch(`${BASE}/api/products?${qs}`, { signal })
  if (!res.ok) throw new Error(`Could not search (${res.status})`)
  const { data, meta } = await res.json()
  return { items: data.map(toTee), meta }
}

// The wishlist: these products only (those no longer on sale are simply missing), in the order asked. Up to 50.
export async function fetchBySlugs(slugs, signal) {
  if (!slugs.length) return []
  const res = await fetch(`${BASE}/api/products?slugs=${slugs.slice(0, 50).map(encodeURIComponent).join(',')}`, { signal })
  if (!res.ok) throw new Error(`Could not load your wishlist (${res.status})`)
  const { data } = await res.json()
  return data.map(toTee)
}

// Product detail page. Rejects with an Error whose `.status` is the HTTP status (404 = no such product).
export async function fetchProduct(slug, signal) {
  const res = await fetch(`${BASE}/api/products/${encodeURIComponent(slug)}`, { signal })
  if (!res.ok) throw Object.assign(new Error(`Could not load product (${res.status})`), { status: res.status })
  const { data } = await res.json()
  return toProduct(data)
}

// "You may also like": same category first, topped up from the rest of the shop. Never includes the product itself.
export async function fetchRelated(product, signal, count = 4) {
  const others = (list) => list.filter((t) => t.slug !== product.slug)
  const { items } = await fetchProducts({ category: product.category, limit: count + 1 }, signal)
  let rel = others(items)
  if (rel.length < count) {
    const more = await fetchProducts({ limit: count * 2 + 1 }, signal)
    rel = [...rel, ...others(more.items).filter((t) => !rel.some((r) => r.slug === t.slug))]
  }
  return rel.slice(0, count)
}

export async function fetchReels(signal) {
  const res = await fetch(`${BASE}/api/reels?limit=8`, { signal })
  if (!res.ok) throw new Error(`Could not load reels (${res.status})`)
  const { data } = await res.json()
  return data.map((r) => ({
    id: r.id,
    url: r.url,
    poster: r.poster.url,
    video: r.videoUrl,
    caption: r.caption,
    tag: r.tag,
    accent: r.accent,
  }))
}

// Cloudinary delivers any width on request; other hosts are returned untouched.
export const sized = (url, w) => url.replace('/upload/f_auto,q_auto:good/', `/upload/f_auto,q_auto:good,w_${w}/`)
export const srcSet = (url, widths = [420, 700, 1000]) => widths.map((w) => `${sized(url, w)} ${w}w`).join(', ')

export const discount = (p) => Math.round(((p.mrp - p.price) / p.mrp) * 100)

// Newsletter sign-up. Resolves with the server's friendly message; rejects with a message that is safe to show.
export async function subscribeNewsletter(email, website = '') {
  let res
  try {
    res = await fetch(`${BASE}/api/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, website }),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error?.details?.[0]?.message || body?.error?.message || 'Something went wrong. Please try again.')
  return body.message
}

// Contact form. Resolves with the server's friendly message.
// Rejects with an Error whose `.fields` maps field name -> message when the server rejects specific inputs, so the form can mark them.
export async function sendContact(payload) {
  let res
  try {
    res = await fetch(`${BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const details = body?.error?.details
    const fields = Array.isArray(details) ? Object.fromEntries(details.filter((d) => d.path).map((d) => [d.path, d.message])) : {}
    const msg = res.status === 429 ? 'Too many messages from this device. Please try again in a while.' : body?.error?.message
    throw Object.assign(new Error(msg || 'Something went wrong. Please try again.'), { fields })
  }
  return body.message ?? "Thanks! We'll get back to you soon."
}

// ---------------------------------------------------------------- store rules + orders

// Server error -> Error with .status, .fields (field path -> message), and .details (the 409 stock conflicts).
async function post(path, payload, fallback) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  } catch {
    throw Object.assign(new Error('Could not reach the server. Check your connection and try again.'), { network: true })
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const details = body?.error?.details
    const fields = Array.isArray(details) ? Object.fromEntries(details.filter((d) => d.path && d.message).map((d) => [d.path, d.message])) : {}
    const message = res.status === 429 ? 'Too many attempts from this device. Please try again in a while.' : body?.error?.message || fallback
    throw Object.assign(new Error(message), { status: res.status, fields, details: res.status === 409 ? details : undefined })
  }
  return body
}

// Shipping / COD fees, free-shipping minimum, payment options and the list of states. Prices arrive in paise.
export async function fetchStoreConfig(signal) {
  const res = await fetch(`${BASE}/api/store-config`, { signal })
  if (!res.ok) throw new Error(`Could not load checkout settings (${res.status})`)
  const { data } = await res.json()
  return { ...data, freeShippingMin: data.freeShippingMin / 100, shippingFee: data.shippingFee / 100, codFee: data.codFee / 100 }
}

const toOrder = (o) => ({
  ...o,
  items: o.items.map((i) => ({ ...i, price: i.price / 100, mrp: i.mrp / 100 })),
  totals: { subtotal: o.totals.subtotal / 100, shipping: o.totals.shipping / 100, codFee: o.totals.codFee / 100, total: o.totals.total / 100 },
})

// Guest checkout. Rejects with the shape described on `post`; a 409 means some lines are no longer available.
export async function placeOrder(payload) {
  const { data } = await post('/api/orders', payload, 'We could not place your order. Please try again.')
  return toOrder(data)
}

// Look an order up by order number + the email used to place it.
export async function trackOrder({ orderNumber, email }) {
  const { data } = await post('/api/orders/track', { orderNumber, email }, 'We could not look that order up. Please try again.')
  return toOrder(data)
}
