// Cloudinary delivery: ask for the best format (WebP/AVIF) and sensible quality per browser.
export const optimize = (url) => (url.includes('res.cloudinary.com') && !url.includes('/upload/f_auto') ? url.replace('/upload/', '/upload/f_auto,q_auto:good/') : url)

// Public shape of a product. Prices are integers in paise (₹899 → 89900); the client formats them.
export function serializeProduct(p) {
  return {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    price: p.price,
    mrp: p.mrp,
    discountPercent: p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
    colors: p.colors,
    sizes: p.sizes,
    images: p.images.map((i) => ({ url: optimize(i.url), alt: i.alt })), // images[0] is the front shot (transparent cut-out); images[1] is the back, when it exists
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
  return {
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description ?? '',
    category: p.category,
    price: p.price,
    mrp: p.mrp,
    colors: p.colors ?? [],
    sizes: p.sizes.map((s) => ({ size: s.size, stock: s.stock, low: s.stock > 0 && s.stock <= lowAt })),
    images: p.images.map((i) => ({ url: i.url, publicId: i.publicId ?? '', alt: i.alt ?? '', thumb: thumb(i.url) })),
    totalStock: p.sizes.reduce((n, s) => n + s.stock, 0),
    stockState: stockState(p.sizes, lowAt),
    isActive: p.isActive !== false,
    isLimited: Boolean(p.isLimited),
    placements: { hero: p.heroOrder ?? null, featured: p.featuredOrder ?? null, bestsellers: p.bestSellerOrder ?? null, newarrivals: p.newArrivalOrder ?? null },
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

export const serializePlacementRow = (p, position) => ({ slug: p.slug, name: p.name, thumb: thumb(p.images?.[0]?.url ?? ''), isActive: p.isActive !== false, price: p.price, inStock: p.sizes.some((s) => s.stock > 0), position })

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
    emails: { customer: Boolean(o.emails?.customer), shipped: Boolean(o.emails?.shipped) },
    history: (o.history ?? []).map((h) => ({ at: h.at, by: h.by?.name ?? '', action: h.action, from: h.from ?? '', to: h.to ?? '', note: h.note ?? '' })).reverse(), // newest first
  }
}
