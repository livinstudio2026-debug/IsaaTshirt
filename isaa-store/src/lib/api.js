// Storefront → Isaa API. In dev, Vite proxies /api to the server (see vite.config.js).
// In production set VITE_API_URL to the API's origin, e.g. https://isaa-api.example.com
// Origin only (no trailing slash, no /api): the paths below already start with /api.
const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '')

// The API sends prices in paise; the UI works in rupees.
const toTee = (p) => ({
  id: p.slug,
  slug: p.slug,
  name: p.name,
  color: p.colors?.[0]?.name ?? '',
  price: p.price / 100,
  mrp: p.mrp / 100,
  img: p.images[0].url,
  limited: p.isLimited,
  back: p.images[1]?.url ?? null, // images[1] is the back shot, when there is one
  category: p.category,
  isBest: p.isBestSeller,
  isNew: p.isNewArrival,
  inStock: p.inStock,
})

// Full product for the detail page: everything toTee has, plus the gallery, colours, sizes and copy.
const toProduct = (p) => ({
  ...toTee(p),
  description: p.description ?? '',
  images: p.images.map((i, n) => ({ url: i.url, alt: i.alt || `${p.name}, view ${n + 1}` })), // [0] front, [1] back when there is one
  colors: p.colors ?? [],
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
