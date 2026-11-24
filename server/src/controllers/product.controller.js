import { z } from 'zod'
import { Product, CATEGORIES } from '../models/Product.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeProduct } from '../utils/serialize.js'

const flag = z.enum(['true', 'false']).transform((v) => v === 'true')

export const listQuery = z.object({
  category: z.enum(CATEGORIES).optional(),
  bestSeller: flag.optional(),
  newArrival: flag.optional(),
  limited: flag.optional(),
  placement: z.enum(['hero', 'featured', 'bestsellers', 'newarrivals']).optional(), // the home page rails/shelves, in their set order
  q: z.string().trim().min(1, 'Type something to search for').max(60, 'Keep the search to 60 characters').optional(), // search: every word must match (name, colour, category, description)
  slugs: z.string().max(2000).transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)).pipe(z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120)).min(1).max(50)).optional(), // these products only (the wishlist), in the order asked
  sort: z.enum(['relevance', 'newest', 'price-asc', 'price-desc']).optional(), // relevance only means something with q; it is the default there, `newest` otherwise
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120) })

const SORTS = { newest: { createdAt: -1, _id: -1 }, 'price-asc': { price: 1, _id: 1 }, 'price-desc': { price: -1, _id: 1 } }
const PLACEMENT_FIELD = { hero: 'heroOrder', featured: 'featuredOrder', bestsellers: 'bestSellerOrder', newarrivals: 'newArrivalOrder' }

// Words people type for a kind of product that isn't in its name. "tee" finds the t-shirts, "joggers" the bottoms.
const ALIASES = {
  tee: 't-shirts', tees: 't-shirts', tshirt: 't-shirts', tshirts: 't-shirts', shirt: 't-shirts', shirts: 't-shirts', top: 't-shirts', tops: 't-shirts',
  hoodie: 'hoodies', sweatshirt: 'hoodies', sweatshirts: 'hoodies', jumper: 'hoodies', pullover: 'hoodies',
  pant: 'bottoms', pants: 'bottoms', trouser: 'bottoms', trousers: 'bottoms', jeans: 'bottoms', jogger: 'bottoms', joggers: 'bottoms', shorts: 'bottoms', bottom: 'bottoms',
  cap: 'accessories', caps: 'accessories', hat: 'accessories', hats: 'accessories', bag: 'accessories', bags: 'accessories', belt: 'accessories', socks: 'accessories',
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const startsAWord = (token) => new RegExp(`(^|[^a-z0-9])${escapeRe(token)}`, 'i') // "ol" finds Olive, "live" does not

// How well a product answers a search: name beats colour and category beats description. Only products matching EVERY word get here.
function score(doc, tokens, phrase) {
  const name = doc.name.toLowerCase()
  let n = name.includes(phrase) ? 3 : 0
  for (const t of tokens) {
    const re = startsAWord(t)
    if (name.startsWith(t)) n += 2
    if (re.test(name)) n += 4
    if ((doc.colors ?? []).some((c) => re.test(c.name))) n += 2
    if (re.test(doc.category) || ALIASES[t] === doc.category) n += 2
    if (re.test(doc.description ?? '')) n += 1
  }
  return n + (doc.isBestSeller ? 0.3 : 0) + ((doc.sizes ?? []).some((s) => s.stock > 0) ? 0.5 : 0)
}

// A search: every word must match something (name, slug, colour, category, description), best matches first.
// A shop this size has hundreds of products, not millions, so matching is done on the (capped) hits in memory rather than with a search index.
async function searchProducts(q, filter) {
  const tokens = [...new Set(q.q.toLowerCase().split(/\s+/).filter(Boolean))].slice(0, 5)
  filter.$and = tokens.map((t) => {
    const re = startsAWord(t)
    return { $or: [{ name: re }, { slug: re }, { category: re }, { 'colors.name': re }, { description: re }, ...(ALIASES[t] ? [{ category: ALIASES[t] }] : [])] }
  })
  const docs = await Product.find(filter).limit(300).lean()
  const phrase = tokens.join(' ')
  const by = q.sort ?? 'relevance'
  const ranked = docs.map((d) => ({ d, s: score(d, tokens, phrase) }))
  ranked.sort((a, b) => {
    if (by === 'price-asc') return a.d.price - b.d.price
    if (by === 'price-desc') return b.d.price - a.d.price
    if (by === 'relevance' && b.s !== a.s) return b.s - a.s
    return new Date(b.d.createdAt) - new Date(a.d.createdAt) || String(b.d._id).localeCompare(String(a.d._id))
  })
  return ranked.map((r) => r.d)
}

// GET /api/products
export async function listProducts(req, res) {
  const q = req.valid.query
  const filter = { isActive: true }
  if (q.category) filter.category = q.category
  if (q.bestSeller) filter.isBestSeller = true
  if (q.newArrival) filter.isNewArrival = true
  if (q.limited) filter.isLimited = true

  const limit = q.limit ?? (q.placement ? 50 : 12)

  if (q.slugs) { // the wishlist: exactly these, still on sale, in the order asked
    filter.slug = { $in: q.slugs }
    const found = new Map((await Product.find(filter).lean()).map((d) => [d.slug, d]))
    const docs = q.slugs.map((s) => found.get(s)).filter(Boolean)
    return res.json({ data: docs.map(serializeProduct), meta: { page: 1, limit: docs.length || 1, total: docs.length, pages: 1 } })
  }
  if (q.q) {
    const all = await searchProducts(q, filter)
    const page = all.slice((q.page - 1) * limit, q.page * limit)
    return res.json({ data: page.map(serializeProduct), meta: { page: q.page, limit, total: all.length, pages: Math.max(1, Math.ceil(all.length / limit)) } })
  }

  let sort = SORTS[q.sort ?? 'newest'] ?? SORTS.newest
  if (q.placement) {
    const field = PLACEMENT_FIELD[q.placement]
    filter[field] = { $type: 'number' }
    sort = { [field]: 1, _id: 1 }
  }

  const [docs, total] = await Promise.all([
    Product.find(filter).sort(sort).skip((q.page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ])
  res.json({ data: docs.map(serializeProduct), meta: { page: q.page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } })
}

// GET /api/products/:slug
export async function getProduct(req, res) {
  const doc = await Product.findOne({ slug: req.valid.params.slug, isActive: true }).lean()
  if (!doc) throw ApiError.notFound('Product not found')
  res.json({ data: serializeProduct(doc) })
}
