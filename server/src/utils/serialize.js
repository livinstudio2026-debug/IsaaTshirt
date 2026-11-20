// Cloudinary delivery: ask for the best format (WebP/AVIF) and sensible quality per browser.
const optimize = (url) => (url.includes('res.cloudinary.com') && !url.includes('/upload/f_auto') ? url.replace('/upload/', '/upload/f_auto,q_auto:good/') : url)

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
