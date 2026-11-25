import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { Product, CATEGORIES, SIZES } from '../models/Product.js'
import { ProductChange } from '../models/ProductChange.js'
import { SizeChart } from '../models/SizeChart.js'
import { chartTable, tidyTable } from '../utils/sizeChart.js'
import { diffProduct, logChange, logMany, serializeChange, RAILS, RAIL_FIELD } from '../utils/productLog.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeAdminProduct, serializePlacementRow, pictures } from '../utils/serialize.js'
import { store } from '../config/store.js'
import { env } from '../config/env.js'
import { PRODUCT_FOLDER, signProductUpload, signReelPoster, signReelVideo } from '../config/cloudinary.js'

// Who can do what (enforced in routes/admin.js):
//   owner + staff: see products, change a size's stock, hide / show a product
//   owner only:    add, edit details and prices, images, placements, delete
// Prices are integers in paise, like everywhere in the API; the back office screens convert from rupees.

const LOW = store.lowStockAt
const PLACEMENTS = ['hero', 'featured', 'bestsellers', 'newarrivals']
const ORDER_FIELD = RAIL_FIELD
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
const uploaded = (message) => z.object({ url: z.string().trim().min(1).max(600), publicId: z.string().trim().max(200).optional(), alt: z.string().trim().max(160).optional() }, message)
const productFields = z.object({
  name: z.string('Enter a name').trim().min(2, 'Enter a name').max(120),
  description: z.string().trim().max(2000),
  tagline: z.string().trim().max(40, 'Keep the tagline to 40 characters'), // optional line under the name; '' clears it (the category default shows)
  category: z.enum(CATEGORIES, 'Pick a category'),
  price: paise,
  mrp: paise,
  // every colour has its own hero picture (a transparent cut-out); it is what shoppers see for that colour
  colors: z.array(z.object({ name: z.string().trim().min(1, 'Name the colour').max(30), hex: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a colour'), hero: uploaded('Add a hero picture for this colour') })).min(1, 'Add at least one colour').max(8),
  sizes: z.array(z.object({ size: z.enum(SIZES), stock: z.number().int('Whole pieces only').min(0).max(9999) })).min(1, 'Add at least one size').max(12),
  // the pictures every colour shares, shown after the hero: back first, then details. Optional.
  images: z.array(uploaded()).max(5, 'Up to 5 more pictures'),
  // size guide: a shared chart (its slug, '' = none) and/or this product's own table (null = use the shared chart); how it fits + the model
  sizeChart: z.string().trim().max(60).regex(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/, 'Pick a size chart'),
  customChart: chartTable.nullable(),
  fit: z.object({
    note: z.string().trim().max(160, 'Keep the fit note to 160 characters'),
    modelHeightCm: z.number('Enter the height in cm').int('Whole centimetres only').min(100, 'Enter the height in cm, e.g. 178').max(230, 'Enter the height in cm, e.g. 178').nullable(),
    modelSize: z.enum(SIZES).or(z.literal('')),
  }),
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

// description, tagline, images, isLimited, isActive and placements may be left out when adding (they get defaults below)
export const createBody = productFields.partial({ description: true, tagline: true, images: true, isLimited: true, isActive: true, placements: true, sizeChart: true, customChart: true, fit: true }).superRefine(check)
export const updateBody = productFields.partial().superRefine(check)

export const stockBody = z.object({
  size: z.enum(SIZES),
  from: z.number().int().min(0), // what the screen was showing: if an order changed it meanwhile, we say so instead of overwriting
  to: z.number('Enter a number').int('Whole pieces only').min(0, 'Can’t be negative').max(9999, 'That looks too high'),
})
export const visibilityBody = z.object({ isActive: z.boolean() })
export const placementParam = z.object({ name: z.enum(PLACEMENTS) })
export const placementBody = z.object({ slugs: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(60) })
export const historyQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(15),
})
export const signBody = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60).optional(),
  kind: z.enum(['product', 'reel-poster', 'reel-video']).default('product'),
})

// ---- helpers ----------------------------------------------------------------------------------------------

const row = (doc) => serializeAdminProduct(doc, LOW)

export function slugify(name) {
  return name.toLowerCase().replace(/&/g, ' and ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '')
}

const RESERVED_SLUGS = new Set(['new', 'placements', 'size-charts']) // these are back-office addresses (/admin/products/new)

async function freeSlug(name) {
  const base = slugify(name) || 'product'
  for (let n = 1; n <= 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    if (!RESERVED_SLUGS.has(slug) && !(await Product.exists({ slug }))) return slug
  }
  throw new ApiError(409, 'Pick a more distinctive name; that one is already used.')
}

const defaultAlt = (name, n) => `${name}, ${n === 0 ? 'back view' : `view ${n + 2}`}`
const fieldError = (path, message) => new ApiError(400, 'Validation failed', [{ path, message }])

// Pictures that are new must come from our own uploader (signed Cloudinary upload into isaa/products), so nobody can point the
// shop at some other site's picture. Pictures the product already has are accepted as they are.
function assertOurUpload(img, path) {
  let u
  try { u = new URL(img.url) } catch { throw fieldError(path, 'Upload this image again') }
  const cloud = env.CLOUDINARY_CLOUD_NAME
  const ok = u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && (!cloud || u.pathname.startsWith(`/${cloud}/`)) &&
    img.publicId?.startsWith(`${PRODUCT_FOLDER}/`) && u.pathname.includes(`/${img.publicId}`)
  if (!ok) throw fieldError(path, 'Upload this image again')
}

// The shared pictures (after the hero).
export function cleanImages(images, existing, name) {
  const known = new Map((existing ?? []).map((i) => [i.url, i]))
  return images.map((img, n) => {
    const kept = known.get(img.url)
    if (!kept) assertOurUpload(img, `images.${n}`)
    return { url: img.url, publicId: kept?.publicId ?? img.publicId ?? '', alt: img.alt || defaultAlt(name, n) }
  })
}

// The colours, each with its hero picture. A hero the product already uses (any colour's, or an older product's front shot) is accepted as it is.
export function cleanColors(colors, existingColors, existingImages, name) {
  const known = new Map([...(existingColors ?? []).map((c) => c.hero).filter((h) => h?.url), ...(existingImages ?? [])].map((i) => [i.url, i]))
  return colors.map((c, n) => {
    const kept = known.get(c.hero.url)
    if (!kept) assertOurUpload(c.hero, `colors.${n}.hero`)
    return { name: c.name, hex: c.hex, hero: { url: c.hero.url, publicId: kept?.publicId ?? c.hero.publicId ?? '', alt: c.hero.alt || `${name} in ${c.name}` } }
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

// The size chart a product points to must exist; a product's own table is tidied into the usual size order.
async function assertChart(slug) {
  if (slug && !(await SizeChart.exists({ slug }))) throw fieldError('sizeChart', 'That size chart doesn’t exist. Pick another.')
}
const fitDoc = (f) => ({ note: f.note, modelHeightCm: f.modelHeightCm, modelSize: f.modelSize })

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
  await assertChart(b.sizeChart)
  const doc = {
    slug: await freeSlug(b.name),
    name: b.name,
    description: b.description ?? '',
    tagline: b.tagline ?? '',
    category: b.category,
    price: b.price,
    mrp: b.mrp,
    colors: cleanColors(b.colors, [], [], b.name),
    sizes: b.sizes,
    images: cleanImages(b.images ?? [], [], b.name),
    sizeChart: b.sizeChart ?? '',
    ...(b.customChart ? { customChart: tidyTable(b.customChart) } : {}),
    ...(b.fit ? { fit: fitDoc(b.fit) } : {}),
    isLimited: b.isLimited ?? false,
    isActive: b.isActive ?? true,
    ...(await placementChanges(b.placements)),
  }
  try {
    const created = await Product.create(doc)
    const plain = created.toObject ? created.toObject() : created
    const rails = Object.entries(ORDER_FIELD).filter(([, f]) => typeof plain[f] === 'number').map(([name, f]) => ({ field: `placement.${name}`, label: RAILS[name], kind: 'position', from: null, to: plain[f] }))
    await logChange(req.admin, plain, 'create', [
      { field: 'price', label: 'Price', kind: 'money', from: null, to: plain.price },
      { field: 'mrp', label: 'MRP', kind: 'money', from: null, to: plain.mrp },
      { field: 'sizes', label: 'Sizes', kind: 'list', from: [], to: plain.sizes.map((s) => s.size) },
      ...rails,
    ], plain.isActive === false ? 'Added as hidden' : 'Added to the store')
    res.status(201).json({ data: row(plain) })
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
  for (const k of ['name', 'description', 'tagline', 'category', 'price', 'mrp', 'isLimited', 'isActive']) if (b[k] !== undefined) set[k] = b[k]
  if ((b.mrp ?? current.mrp) < (b.price ?? current.price)) throw fieldError('mrp', 'MRP can’t be lower than the price')
  const label = b.name ?? current.name
  if (b.sizeChart !== undefined) { await assertChart(b.sizeChart); set.sizeChart = b.sizeChart }
  if (b.customChart !== undefined) set.customChart = b.customChart ? tidyTable(b.customChart) : null // null = back to the shared chart
  if (b.fit !== undefined) set.fit = fitDoc(b.fit)
  if (b.colors) set.colors = cleanColors(b.colors, current.colors, current.images, label)
  if (b.images) set.images = cleanImages(b.images, current.images, label)
  // an older product keeps its front shot in images[0]; once its colours get their own heroes that picture is no longer a shared one
  else if (b.colors) { const { shared } = pictures(current); if (shared.length !== current.images.length) set.images = shared }

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
  await logChange(req.admin, updated, 'update', diffProduct(current, updated))
  res.json({ data: row(updated) })
}

// DELETE /api/admin/products/:slug
// Orders keep their own copy of the name, price and picture, so past orders, packing slips and tracking pages are unaffected.
// The pictures stay in Cloudinary for the same reason.
export async function deleteProduct(req, res) {
  const gone = await Product.findOneAndDelete({ slug: req.valid.params.slug }).lean()
  if (!gone) throw ApiError.notFound('Product not found')
  await logChange(req.admin, gone, 'delete', [], `Deleted “${gone.name}” (₹${Math.round(gone.price / 100).toLocaleString('en-IN')})`)
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
  if (updated) {
    if (from !== to) await logChange(req.admin, updated, 'stock', [{ field: `stock.${size}`, label: `Stock · ${size}`, kind: 'number', from, to }])
    return res.json({ data: row(updated) })
  }

  const now = await load(slug)
  const s = now.sizes.find((x) => x.size === size)
  if (!s) throw ApiError.notFound(`This product has no size ${size}`)
  throw new ApiError(409, `Size ${size} now has ${s.stock} in stock (it changed while you were editing). Showing the latest.`, { current: row(now) })
}

// POST /api/admin/products/:slug/visibility  { isActive }
export async function setVisibility(req, res) {
  const { slug } = req.valid.params
  const { isActive } = req.valid.body
  // only a real change is applied (and logged): switching it to what it already is does nothing
  const updated = await Product.findOneAndUpdate({ slug, isActive: { $ne: isActive } }, { $set: { isActive } }, { new: true }).lean()
  if (!updated) return res.json({ data: row(await load(slug)) })
  await logChange(req.admin, updated, 'visibility', [{ field: 'isActive', label: 'On the store', kind: 'bool', from: !isActive, to: isActive }])
  res.json({ data: row(updated) })
}

// GET /api/admin/products/:slug/history?page=&limit=  -> { data: [change], meta }  (newest first; owner and staff)
export async function getHistory(req, res) {
  const { page, limit } = req.valid.query
  const product = await load(req.valid.params.slug)
  const [rows, total] = await Promise.all([
    ProductChange.find({ product: product._id }).sort({ at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ProductChange.countDocuments({ product: product._id }),
  ])
  res.json({ data: rows.map(serializeChange), meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } })
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

  // everything on this rail now, plus the products being put on it: needed to check they exist and to log who moved where
  const involved = await Product.find({ $or: [{ [field]: { $type: 'number' } }, ...(slugs.length ? [{ slug: { $in: slugs } }] : [])] }, `slug name ${field}`).lean()
  const have = new Set(involved.map((p) => p.slug))
  const unknown = slugs.filter((s) => !have.has(s))
  if (unknown.length) throw new ApiError(404, `Not found: ${unknown.join(', ')}`)

  await Product.bulkWrite([
    { updateMany: { filter: { [field]: { $type: 'number' }, slug: { $nin: slugs } }, update: { $set: { [field]: null, ...(flag ? { [flag]: false } : {}) } } } },
    ...slugs.map((slug, i) => ({ updateOne: { filter: { slug }, update: { $set: { [field]: i + 1, ...(flag ? { [flag]: true } : {}) } } } })),
  ])
  const target = new Map(slugs.map((slug, i) => [slug, i + 1]))
  await logMany(req.admin, involved
    .map((p) => ({ product: p, from: typeof p[field] === 'number' ? p[field] : null, to: target.get(p.slug) ?? null }))
    .filter((e) => e.from !== e.to)
    .map((e) => ({ product: e.product, action: 'placement', changes: [{ field: `placement.${name}`, label: RAILS[name], kind: 'position', from: e.from, to: e.to }] })))
  return getPlacements(req, res)
}

// ---- image uploads (owner) --------------------------------------------------------------------------------

// POST /api/admin/uploads/sign  { kind?: product | reel-poster | reel-video, slug? } -> { url, fields }: the browser posts the file plus `fields` straight to Cloudinary.
export async function signUpload(req, res) {
  if (!env.cloudinaryEnabled) throw new ApiError(503, 'Image uploads aren’t set up yet. Add the Cloudinary keys to the server’s .env.')
  const { kind, slug } = req.valid.body
  const suffix = randomBytes(4).toString('hex')
  if (kind === 'reel-poster') return res.json({ data: signReelPoster(`reel-${suffix}`) })
  if (kind === 'reel-video') return res.json({ data: signReelVideo(`reel-${suffix}`) })
  res.json({ data: signProductUpload(`${slug ?? 'new'}-${suffix}`) })
}
