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
  sort: z.enum(['newest', 'price-asc', 'price-desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120) })

const SORTS = { newest: { createdAt: -1, _id: -1 }, 'price-asc': { price: 1, _id: 1 }, 'price-desc': { price: -1, _id: 1 } }
const PLACEMENT_FIELD = { hero: 'heroOrder', featured: 'featuredOrder', bestsellers: 'bestSellerOrder', newarrivals: 'newArrivalOrder' }

// GET /api/products
export async function listProducts(req, res) {
  const q = req.valid.query
  const filter = { isActive: true }
  if (q.category) filter.category = q.category
  if (q.bestSeller) filter.isBestSeller = true
  if (q.newArrival) filter.isNewArrival = true
  if (q.limited) filter.isLimited = true

  let sort = SORTS[q.sort]
  if (q.placement) {
    const field = PLACEMENT_FIELD[q.placement]
    filter[field] = { $type: 'number' }
    sort = { [field]: 1, _id: 1 }
  }

  const limit = q.limit ?? (q.placement ? 50 : 12)
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
