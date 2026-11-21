import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { Product, CATEGORIES, SIZES } from '../models/Product.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeAdminProduct, serializePlacementRow } from '../utils/serialize.js'
import { store } from '../config/store.js'
import { env } from '../config/env.js'
import { PRODUCT_FOLDER, signProductUpload } from '../config/cloudinary.js'

// Who can do what (enforced in routes/admin.js):
//   owner + staff: see products, change a size's stock, hide / show a product
//   owner only:    add, edit details and prices, images, placements, delete
// Prices are integers in paise, like everywhere in the API; the back office screens convert from rupees.

const LOW = store.lowStockAt
const PLACEMENTS = ['hero', 'featured', 'bestsellers', 'newarrivals']
const ORDER_FIELD = { hero: 'heroOrder', featured: 'featuredOrder', bestsellers: 'bestSellerOrder', newarrivals: 'newArrivalOrder' }
const FLAG_FIELD = { bestsellers: 'isBestSeller', newarrivals: 'isNewArrival' } // flags that travel with a shelf position
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---- validation -------------------------------------------------------------------------------------------

export const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120) })

export const listQuery = z.object({
  q: z.string().trim().max(60).optional(),
  category: z.enum(CATEGORIES).optional(),
  status: z.enum(['all', 'active', 'hidden', 'low', 'out']).default('all'),
  placement: z.enum(PLACEMENTS).optional(),
  sort: z.enum(['newest', 'name', 'price-asc', 'price-desc']).default('newest'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const MAX_PAISE = 100_000_00 // ₹1,00,000
const paise = z.number('Enter an amount').int('Whole paise only').min(100, 'Must be at least ₹1').max(MAX_PAISE, 'That looks too high')
const productFields = z.object({
  name: z.string('Enter a name').trim().min(2, 'Enter a name').max(120),
  description: z.string().trim().max(2000),
  category: z.enum(CATEGORIES, 'Pick a category'),
  price: paise,
  mrp: paise,
  colors: z.array(z.object({ name: z.string().trim().min(1, 'Name the colour').max(30), hex: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a colour') })).min(1, 'Add at least one colour').max(8),
  sizes: z.array(z.object({ size: z.enum(SIZES), stock: z.number().int('Whole pieces only').min(0).max(9999) })).min(1, 'Add at least one size').max(12),
  images: z.array(z.object({ url: z.string().trim().min(1).max(600), publicId: z.string().trim().max(200).optional(), alt: z.string().trim().max(160).optional() })).min(1, 'Add at least one image').max(6),
  isLimited: z.boolean(),
  isActive: z.boolean(),
  placements: z.object({ hero: z.boolean(), featured: z.boolean(), bestsellers: z.boolean(), newarrivals: z.boolean() }).partial(),
})

const check = (b, ctx) => {
  if (b.price != null && b.mrp != null && b.mrp < b.price) ctx.addIssue({ code: 'custom', path: ['mrp'], message: 'MRP can’t be lower than the price' })
  const dupe = (list, key) => list && new Set(list.map((x) => x[key].toLowerCase())).size !== list.length
  if (dupe(b.sizes, 'size')) ctx.addIssue({ code: 'custom', path: ['sizes'], message: 'Each size can only be listed once' })
  if (dupe(b.colors, 'name')) ctx.addIssue({ code: 'custom', path: ['colors'], message: 'Each colour can only be listed once' })
}

// description, isLimited, isActive and placements may be left out when adding (they get defaults below)
export const createBody = productFields.partial({ description: true, isLimited: true, isActive: true, placements: true }).superRefine(check)
export const updateBody = productFields.partial().superRefine(check)

export const stockBody = z.object({
  size: z.enum(SIZES),
  from: z.number().int().min(0), // what the screen was showing: if an order changed it meanwhile, we say so instead of overwriting
  to: z.number('Enter a number').int('Whole pieces only').min(0, 'Can’t be negative').max(9999, 'That looks too high'),
})
export const visibilityBody = z.object({ isActive: z.boolean() })
export const placementParam = z.object({ name: z.enum(PLACEMENTS) })
export const placementBody = z.object({ slugs: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(60) })
export const signBody = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60).optional() })

// ---- helpers ----------------------------------------------------------------------------------------------

const row = (doc) => serializeAdminProduct(doc, LOW)

export function slugify(name) {
  return name.toLowerCase().replace(/&/g, ' and ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
}

const RESERVED_SLUGS = new Set(['new', 'placements']) // these are back-office addresses (/admin/products/new)

async function freeSlug(name) {
  const base = slugify(name) || 'product'
  for (let n = 1; n <= 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    if (!RESERVED_SLUGS.has(slug) && !(await Product.exists({ slug }))) return slug
  }
  throw new ApiError(409, 'Pick a more distinctive name; that one is already used.')
}

const defaultAlt = (name, n) => `${name}, ${['front view', 'back view'][n] ?? `view ${n + 1}`}`
const fieldError = (path, message) => new ApiError(400, 'Validation failed', [{ path, message }])

// Images that are new must come from our own uploader (signed Cloudinary upload into isaa/products), so nobody can point the
// shop at some other site's picture. Images the product already has are accepted as they are.
export function cleanImages(images, existing, name) {
  const known = new Map((existing ?? []).map((i) => [i.url, i]))
  return images.map((img, n) => {
    const kept = known.get(img.url)
    if (!kept) {
      let u
      try { u = new URL(img.url) } catch { throw fieldError(`images.${n}`, 'Upload this image again') }
      const cloud = env.CLOUDINARY_CLOUD_NAME
      const ok = u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && (!cloud || u.pathname.startsWith(`/${cloud}/`)) &&
        img.publicId?.startsWith(`${PRODUCT_FOLDER}/`) && u.pathname.includes(`/${img.publicId}`)
      if (!ok) throw fieldError(`images.${n}`, 'Upload this image again')
    }
    return { url: img.url, publicId: kept?.publicId ?? img.publicId ?? '', alt: img.alt || defaultAlt(name, n) }
  })
}

const nextPosition = async (field) => {
  const top = await Product.findOne({ [field]: { $type: 'number' } }, { [field]: 1 }).sort({ [field]: -1 }).lean()
  return (top?.[field] ?? 0) + 1
}

// { hero: true } puts a product at the end of that rail (it keeps its place if it is already there); { hero: false } takes it off.
// Best Sellers and New Arrivals also carry a flag the shop's filters use, so the two always agree.
async function placementChanges(wanted = {}, current = {}) {
  const set = {}
  for (const [name, on] of Object.entries(wanted)) {
    const field = ORDER_FIELD[name]
    if (on) {
      if (typeof current[field] !== 'number') set[field] = await nextPosition(field)
      if (FLAG_FIELD[name]) set[FLAG_FIELD[name]] = true
    } else {
      set[field] = null
      if (FLAG_FIELD[name]) set[FLAG_FIELD[name]] = false
    }
  }
  return set
}

const sameSizes = (a, b) => a.length === b.length && a.every((s, i) => s.size === b[i].size && s.stock === b[i].stock)

// ---- list / read ------------------------------------------------------------------------------------------

const SORTS = { newest: { createdAt: -1, _id: -1 }, name: { name: 1, _id: 1 }, 'price-asc': { price: 1, _id: 1 }, 'price-desc': { price: -1, _id: 1 } }
const hasStock = { sizes: { $elemMatch: { stock: { $gt: 0 } } } }
const STATUS_FILTER = {
  active: { isActive: true },
  hidden: { isActive: false },
  low: { $and: [hasStock, { sizes: { $elemMatch: { stock: { $lte: LOW } } } }] },
  out: { sizes: { $not: { $elemMatch: { stock: { $gt: 0 } } } } },
}

// GET /api/admin/products?q=&category=&status=all|active|hidden|low|out&placement=&sort=&page=  -> { data, meta, counts }
export async function listProducts(req, res) {
  const { q, category, status, placement, sort, page, limit } = req.valid.query
  const filter = {}
  if (category) filter.category = category
  if (placement) filter[ORDER_FIELD[placement]] = { $type: 'number' }
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { slug: rx }] }
  Object.assign(filter, status === 'all' ? {} : STATUS_FILTER[status])
  const [docs, total, ...counts] = await Promise.all([
    Product.find(filter).sort(SORTS[sort]).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
    Product.countDocuments({}),
    ...['active', 'hidden', 'low', 'out'].map((s) => Product.countDocuments(STATUS_FILTER[s])),
  ])
  res.json({
    data: docs.map(row),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), lowStockAt: LOW },
    counts: { all: counts[0], active: counts[1], hidden: counts[2], low: counts[3], out: counts[4] },
  })
}

async function load(slug) {
  const doc = await Product.findOne({ slug }).lean()
  if (!doc) throw ApiError.notFound('Product not found')
  return doc
}

// GET /api/admin/products/:slug  (hidden products included)
export async function getProduct(req, res) {
  res.json({ data: row(await load(req.valid.params.slug)) })
}

// ---- create / edit / delete (owner) -----------------------------------------------------------------------

// POST /api/admin/products
export async function createProduct(req, res) {
  const b = req.valid.body
  const doc = {
    slug: await freeSlug(b.name),
    name: b.name,
    description: b.description ?? '',
    category: b.category,
    price: b.price,
    mrp: b.mrp,
    colors: b.colors,
    sizes: b.sizes,
    images: cleanImages(b.images, [], b.name),
    isLimited: b.isLimited ?? false,
    isActive: b.isActive ?? true,
    ...(await placementChanges(b.placements)),
  }
  try {
    const created = await Product.create(doc)
    res.status(201).json({ data: row(created.toObject ? created.toObject() : created) })
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, 'A product with that name already exists. Try again.')
    throw err
  }
}

const STOCK_CHANGED = 'An order just changed this product’s stock. Reload it and save again.'

// PATCH /api/admin/products/:slug  (only the fields sent are changed; the slug, i.e. the web address, never changes)
export async function updateProduct(req, res) {
  const { slug } = req.valid.params
  const b = req.valid.body
  const current = await load(slug)

  const set = {}
  for (const k of ['name', 'description', 'category', 'price', 'mrp', 'colors', 'isLimited', 'isActive']) if (b[k] !== undefined) set[k] = b[k]
  if ((b.mrp ?? current.mrp) < (b.price ?? current.price)) throw fieldError('mrp', 'MRP can’t be lower than the price')
  if (b.images) set.images = cleanImages(b.images, current.images, b.name ?? current.name)

  // Sizes: the list says which sizes the product has. A size it already has keeps its LIVE stock (the number sent for it is ignored:
  // stock changes go through /stock, which can't overwrite an order that came in a moment ago); a new size starts at the number sent.
  // The write only applies if nobody changed the sizes since they were read here.
  const filter = { slug }
  if (b.sizes) {
    const have = new Map(current.sizes.map((s) => [s.size, s]))
    const next = b.sizes.map((s) => have.get(s.size) ?? s)
    if (!sameSizes(next, current.sizes)) { set.sizes = next; filter.sizes = current.sizes }
  }
  Object.assign(set, await placementChanges(b.placements, current))

  if (!Object.keys(set).length) return res.json({ data: row(current) })
  const updated = await Product.findOneAndUpdate(filter, { $set: set }, { new: true, runValidators: true }).lean()
  if (!updated) throw filter.sizes ? new ApiError(409, STOCK_CHANGED) : ApiError.notFound('Product not found')
  res.json({ data: row(updated) })
}

// DELETE /api/admin/products/:slug
// Orders keep their own copy of the name, price and picture, so past orders, packing slips and tracking pages are unaffected.
// The pictures stay in Cloudinary for the same reason.
export async function deleteProduct(req, res) {
  const gone = await Product.findOneAndDelete({ slug: req.valid.params.slug }).lean()
  if (!gone) throw ApiError.notFound('Product not found')
  res.json({ data: { slug: gone.slug, deleted: true } })
}

// ---- stock and visibility (owner and staff) ---------------------------------------------------------------

// POST /api/admin/products/:slug/stock  { size, from, to }
// One atomic update that only applies if the stock is still `from`; otherwise 409 and the screen reloads the real number.
export async function setStock(req, res) {
  const { slug } = req.valid.params
  const { size, from, to } = req.valid.body
  const updated = await Product.findOneAndUpdate(
    { slug, sizes: { $elemMatch: { size, stock: from } } },
    { $set: { 'sizes.$.stock': to } },
    { new: true },
  ).lean()
  if (updated) return res.json({ data: row(updated) })

  const now = await load(slug)
  const s = now.sizes.find((x) => x.size === size)
  if (!s) throw ApiError.notFound(`This product has no size ${size}`)
  throw new ApiError(409, `Size ${size} now has ${s.stock} in stock (it changed while you were editing). Showing the latest.`, { current: row(now) })
}

// POST /api/admin/products/:slug/visibility  { isActive }
export async function setVisibility(req, res) {
  const updated = await Product.findOneAndUpdate({ slug: req.valid.params.slug }, { $set: { isActive: req.valid.body.isActive } }, { new: true }).lean()
  if (!updated) throw ApiError.notFound('Product not found')
  res.json({ data: row(updated) })
}

// ---- placements (owner sets, everyone reads) --------------------------------------------------------------

// GET /api/admin/placements -> { data: { hero: [...], featured: [...], bestsellers: [...], newarrivals: [...] }, meta: { homeShows } }
export async function getPlacements(_req, res) {
  const lists = await Promise.all(PLACEMENTS.map((name) => {
    const field = ORDER_FIELD[name]
    return Product.find({ [field]: { $type: 'number' } }, `slug name price images sizes isActive ${field}`).sort({ [field]: 1, _id: 1 }).lean()
  }))
  const data = Object.fromEntries(PLACEMENTS.map((name, i) => [name, lists[i].map((p, n) => serializePlacementRow(p, n + 1))]))
  res.json({ data, meta: { homeShows: { bestsellers: 5, newarrivals: 5 } } })
}

// POST /api/admin/placements/:name  { slugs: [...] }
// The list IS the rail: its products get positions 1…n in this order, and anything not listed comes off it.
export async function setPlacement(req, res) {
  const { name } = req.valid.params
  const { slugs } = req.valid.body
  if (new Set(slugs).size !== slugs.length) throw new ApiError(400, 'A product can only be listed once')
  const field = ORDER_FIELD[name]
  const flag = FLAG_FIELD[name]

  const found = slugs.length ? await Product.find({ slug: { $in: slugs } }, 'slug').lean() : []
  const have = new Set(found.map((p) => p.slug))
  const unknown = slugs.filter((s) => !have.has(s))
  if (unknown.length) throw new ApiError(404, `Not found: ${unknown.join(', ')}`)

  await Product.bulkWrite([
    { updateMany: { filter: { [field]: { $type: 'number' }, slug: { $nin: slugs } }, update: { $set: { [field]: null, ...(flag ? { [flag]: false } : {}) } } } },
    ...slugs.map((slug, i) => ({ updateOne: { filter: { slug }, update: { $set: { [field]: i + 1, ...(flag ? { [flag]: true } : {}) } } } })),
  ])
  return getPlacements(req, res)
}

// ---- image uploads (owner) --------------------------------------------------------------------------------

// POST /api/admin/uploads/sign  { slug? } -> { url, fields }: the browser posts the file plus `fields` straight to Cloudinary.
export async function signUpload(req, res) {
  if (!env.cloudinaryEnabled) throw new ApiError(503, 'Image uploads aren’t set up yet. Add the Cloudinary keys to the server’s .env.')
  const publicId = `${req.valid.body.slug ?? 'new'}-${randomBytes(4).toString('hex')}`
  res.json({ data: signProductUpload(publicId) })
}
