import { hasRows } from './sizeChart.js'

// Cloudinary delivery: ask for the best format (WebP/AVIF) and sensible quality per browser.
export const optimize = (url) => (url.includes('res.cloudinary.com') && !url.includes('/upload/f_auto') ? url.replace('/upload/', '/upload/f_auto,q_auto:good/') : url)

// Pictures of a product, split into each colour's HERO and the shared pictures that follow it.
// Products saved before per-colour heroes kept their front shot in images[0]: for those it stands in as the hero and the rest are shared.
// `fillAll: false` (back office) lends that front shot to the first colour only, so the editor asks for the other heroes.
export function pictures(p, { fillAll = true } = {}) {
  const colors = p.colors ?? []
  const images = p.images ?? []
  const older = images.length > 0 && colors.some((c) => !c.hero?.url)
  const lend = older ? images[0] : null
  return {
    heroes: colors.map((c, i) => (c.hero?.url ? c.hero : fillAll || i === 0 ? lend : null)),
    shared: older ? images.slice(1) : images,
  }
}

// The hero of one colour (by name); the first colour's when the name isn't found. Returns a url, or '' if there is none.
export function heroUrl(p, colorName = '') {
  const { heroes } = pictures(p)
  const at = (p.colors ?? []).findIndex((c) => c.name.toLowerCase() === String(colorName).toLowerCase())
  return (heroes[at] ?? heroes[0] ?? heroes.find(Boolean))?.url ?? p.images?.[0]?.url ?? ''
}

// Public shape of a product. Prices are integers in paise (₹899 → 89900); the client formats them.
export function serializeProduct(p) {
  const { heroes, shared } = pictures(p)
  return {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description,
    tagline: p.tagline ?? '',
    category: p.category,
    price: p.price,
    mrp: p.mrp,
    discountPercent: p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
    // each colour carries its own hero (a transparent cut-out): what lists show and what the product page opens with
    colors: p.colors.map((c, n) => ({ name: c.name, hex: c.hex, hero: heroes[n] ? { url: optimize(heroes[n].url), alt: heroes[n].alt || `${p.name} in ${c.name}` } : null })),
    sizes: p.sizes,
    images: shared.map((i) => ({ url: optimize(i.url), alt: i.alt })), // the pictures every colour shares: images[0] is the back shot, when it exists
    inStock: p.sizes.some((s) => s.stock > 0),
    isLimited: p.isLimited,
    isBestSeller: p.isBestSeller,
    isNewArrival: p.isNewArrival,
    heroOrder: p.heroOrder,
    featuredOrder: p.featuredOrder,
    bestSellerOrder: p.bestSellerOrder,
    newArrivalOrder: p.newArrivalOrder,
  }
}


// ---- back office: products -------------------------------------------------------------------------------

// A small copy of the image for lists and editors (the original stays untouched in Cloudinary).
const thumb = (url) => (url.includes('res.cloudinary.com') ? url.replace('/upload/', '/upload/f_auto,q_auto,w_360/') : url)

// 'out' = nothing left to sell; 'low' = something is left but at least one size is at or below `lowAt` (a sold-out size counts); else 'ok'.
export function stockState(sizes, lowAt) {
  if (!sizes.some((s) => s.stock > 0)) return 'out'
  return sizes.some((s) => s.stock <= lowAt) ? 'low' : 'ok'
}

// Everything the product list and the editor need. Images keep their real url (the editor sends it back); `thumb` is for display.
export function serializeAdminProduct(p, lowAt) {
  const { heroes, shared } = pictures(p, { fillAll: false })
  return {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description ?? '',
    tagline: p.tagline ?? '',
    category: p.category,
    price: p.price,
    mrp: p.mrp,
    colors: (p.colors ?? []).map((c, n) => ({ name: c.name, hex: c.hex, hero: heroes[n] ? { url: heroes[n].url, publicId: heroes[n].publicId ?? '', alt: heroes[n].alt ?? '', thumb: thumb(heroes[n].url) } : null })),
    sizes: p.sizes.map((s) => ({ size: s.size, stock: s.stock, low: s.stock > 0 && s.stock <= lowAt })),
    sizeChart: p.sizeChart ?? '', // the shared chart this product uses ('' = none)
    customChart: hasRows(p.customChart) ? { columns: [...p.customChart.columns], rows: p.customChart.rows.map((r) => ({ size: r.size, values: [...r.values] })) } : null, // its own table, which wins over the shared chart
    fit: { note: p.fit?.note ?? '', modelHeightCm: p.fit?.modelHeightCm ?? null, modelSize: p.fit?.modelSize ?? '' },
    images: shared.map((i) => ({ url: i.url, publicId: i.publicId ?? '', alt: i.alt ?? '', thumb: thumb(i.url) })),
    totalStock: p.sizes.reduce((n, s) => n + s.stock, 0),
    stockState: stockState(p.sizes, lowAt),
    isActive: p.isActive !== false,
    isLimited: Boolean(p.isLimited),
    placements: { hero: p.heroOrder ?? null, featured: p.featuredOrder ?? null, bestsellers: p.bestSellerOrder ?? null, newarrivals: p.newArrivalOrder ?? null },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

// A product that is running out, for the dashboard: only the sizes that need attention are listed.
export function serializeStockAlert(p, lowAt) {
  const sizes = p.sizes.filter((s) => s.stock <= lowAt).map((s) => ({ size: s.size, stock: s.stock }))
  return {
    slug: p.slug,
    name: p.name,
    thumb: thumb(heroUrl(p)),
    state: stockState(p.sizes, lowAt),
    totalStock: p.sizes.reduce((n, s) => n + s.stock, 0),
    sizes,
  }
}

// ---- back office: inbox -----------------------------------------------------------------------------------

// A contact-form message. The sender's IP and browser are kept in the database but never sent to the screen.
export function serializeMessage(m) {
  return {
    id: String(m._id),
    name: m.name,
    email: m.email,
    phone: m.phone ?? '',
    topic: m.topic ?? 'other',
    message: m.message,
    status: m.status ?? 'new',
    createdAt: m.createdAt,
    handledBy: m.handledBy?.name ?? '',
    handledAt: m.handledAt ?? null,
  }
}

export const serializeSubscriber = (s) => ({ id: String(s._id), email: s.email, source: s.source ?? 'footer', createdAt: s.createdAt })

export const serializePlacementRow = (p, position) => ({ slug: p.slug, name: p.name, thumb: thumb(heroUrl(p)), isActive: p.isActive !== false, price: p.price, inStock: p.sizes.some((s) => s.stock > 0), position })

export function serializeReel(r) {
  return {
    id: String(r._id),
    url: r.url,
    poster: { url: optimize(r.poster.url) },
    videoUrl: r.videoUrl ?? null,
    caption: r.caption ?? '',
    tag: r.tag ?? '',
    accent: r.accent ?? null,
    order: r.order,
  }
}

// A reel for the back office: hidden ones too, with a small copy of the poster for the list.
export function serializeAdminReel(r) {
  return {
    id: String(r._id),
    url: r.url,
    poster: { url: r.poster.url, publicId: r.poster.publicId ?? '', thumb: thumb(r.poster.url) },
    video: r.videoUrl ? { url: r.videoUrl, publicId: r.videoPublicId ?? '' } : null,
    caption: r.caption ?? '',
    tag: r.tag ?? '',
    accent: r.accent ?? null,
    order: r.order ?? 0,
    isActive: r.isActive !== false,
    createdAt: r.createdAt,
  }
}

const maskPhone = (p) => (p ? `${'•'.repeat(Math.max(0, p.length - 4))}${p.slice(-4)}` : '')

// Public shape of an order (paise). Used for the confirmation and for tracking, where the phone is masked.
export function serializeOrder(o, { mask = false } = {}) {
  return {
    orderNumber: o.orderNumber,
    status: o.status,
    statusHistory: (o.statusHistory ?? []).map((h) => ({ status: h.status, at: h.at, note: h.note ?? '' })),
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ slug: i.slug, name: i.name, image: i.image ? optimize(i.image) : '', color: i.color, size: i.size, qty: i.qty, price: i.price, mrp: i.mrp })),
    customer: { name: o.customer.name, email: o.customer.email, phone: mask ? maskPhone(o.customer.phone) : o.customer.phone },
    address: o.address,
    notes: o.notes ?? '',
    totals: o.totals,
    payment: o.payment,
    tracking: o.tracking?.url || o.tracking?.number ? { carrier: o.tracking.carrier ?? '', number: o.tracking.number ?? '', url: o.tracking.url ?? '' } : null,
  }
}

// ---- back office ------------------------------------------------------------------------------------------

// One row of the order list: just what the table / cards need.
export function serializeOrderRow(o) {
  return {
    orderNumber: o.orderNumber,
    status: o.status,
    createdAt: o.createdAt,
    customer: { name: o.customer.name, email: o.customer.email, phone: o.customer.phone },
    place: [o.address?.city, o.address?.state].filter(Boolean).join(', '),
    itemCount: o.items.reduce((n, i) => n + i.qty, 0),
    images: o.items.slice(0, 3).map((i) => (i.image ? optimize(i.image) : '')),
    total: o.totals.total,
    payment: { method: o.payment.method, status: o.payment.status },
  }
}

// Everything the order page needs: the customer-facing fields (full phone number, no masking) plus the audit trail.
export function serializeAdminOrder(o) {
  return {
    ...serializeOrder(o),
    id: String(o._id),
    payment: { method: o.payment.method, status: o.payment.status, paidAt: o.payment.paidAt ?? null },
    shippedAt: o.shippedAt ?? null,
    deliveredAt: o.deliveredAt ?? null,
    cancelledAt: o.cancelledAt ?? null,
    cancelReason: o.cancelReason ?? '',
    stockReleased: Boolean(o.stockReleased),
    emails: { customer: Boolean(o.emails?.customer), shipped: Boolean(o.emails?.shipped), delivered: Boolean(o.emails?.delivered), cancelled: Boolean(o.emails?.cancelled) },
    history: (o.history ?? []).map((h) => ({ at: h.at, by: h.by?.name ?? '', action: h.action, from: h.from ?? '', to: h.to ?? '', note: h.note ?? '' })).reverse(), // newest first
  }
}
