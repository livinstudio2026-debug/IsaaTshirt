import { z } from 'zod'
import { SizeChart } from '../models/SizeChart.js'
import { Product, CATEGORIES } from '../models/Product.js'
import { ApiError } from '../utils/ApiError.js'
import { chartTable, tidyTable } from '../utils/sizeChart.js'
import { slugify } from './admin.products.controller.js'

// Shared size charts. Owner and staff can read them; adding, editing and deleting are owner-only (enforced in routes/admin.js).
// A chart is { name, category?, note?, columns, rows } in centimetres: see utils/sizeChart.js. Editing one updates every product that uses it.

export const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60) })

const fields = z.object({
  name: z.string('Enter a name').trim().min(2, 'Enter a name').max(40, 'Keep the name to 40 characters'),
  category: z.enum([...CATEGORIES, '']),
  note: z.string().trim().max(200, 'Keep the note to 200 characters'),
})
const withTable = fields.extend({ table: chartTable })

export const createBody = fields.partial({ category: true, note: true }).extend({ table: chartTable }).strict()
export const updateBody = withTable.partial().strict()

const serialize = (c, usedBy = 0) => ({
  slug: c.slug,
  name: c.name,
  category: c.category ?? '',
  note: c.note ?? '',
  columns: [...c.columns],
  rows: c.rows.map((r) => ({ size: r.size, values: [...r.values] })),
  usedBy,
  updatedAt: c.updatedAt,
})

const RESERVED = new Set(['new'])
async function freeSlug(name) {
  const base = slugify(name) || 'size-chart'
  for (let n = 1; n <= 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    if (!RESERVED.has(slug) && !(await SizeChart.exists({ slug }))) return slug
  }
  throw new ApiError(409, 'Pick a more distinctive name; that one is already used.')
}

const usage = (slug) => Product.countDocuments({ sizeChart: slug })

async function load(slug) {
  const doc = await SizeChart.findOne({ slug }).lean()
  if (!doc) throw ApiError.notFound('Size chart not found')
  return doc
}

// GET /api/admin/size-charts -> { data: [chart] }  (each with `usedBy`: how many products use it)
export async function listCharts(_req, res) {
  const docs = await SizeChart.find({}).sort({ name: 1, _id: 1 }).lean()
  const counts = await Promise.all(docs.map((d) => usage(d.slug)))
  res.json({ data: docs.map((d, i) => serialize(d, counts[i])) })
}

// GET /api/admin/size-charts/:slug
export async function getChart(req, res) {
  const doc = await load(req.valid.params.slug)
  res.json({ data: serialize(doc, await usage(doc.slug)) })
}

// POST /api/admin/size-charts
export async function createChart(req, res) {
  const b = req.valid.body
  const created = await SizeChart.create({ slug: await freeSlug(b.name), name: b.name, category: b.category ?? '', note: b.note ?? '', ...tidyTable(b.table) })
  res.status(201).json({ data: serialize(created.toObject(), 0) })
}

// PATCH /api/admin/size-charts/:slug  (the slug never changes; sending `table` replaces all measurements and sizes)
export async function updateChart(req, res) {
  const { slug } = req.valid.params
  const b = req.valid.body
  const set = {}
  for (const k of ['name', 'category', 'note']) if (b[k] !== undefined) set[k] = b[k]
  if (b.table) Object.assign(set, tidyTable(b.table))
  const updated = Object.keys(set).length ? await SizeChart.findOneAndUpdate({ slug }, { $set: set }, { new: true, runValidators: true }).lean() : await load(slug)
  if (!updated) throw ApiError.notFound('Size chart not found')
  res.json({ data: serialize(updated, await usage(slug)) })
}

// DELETE /api/admin/size-charts/:slug  (refused while a product still uses it, so no product is left pointing at nothing)
export async function deleteChart(req, res) {
  const { slug } = req.valid.params
  await load(slug)
  const n = await usage(slug)
  if (n) throw new ApiError(409, `${n} ${n === 1 ? 'product uses' : 'products use'} this chart. Pick another chart for ${n === 1 ? 'it' : 'them'} first, then delete this one.`)
  await SizeChart.deleteOne({ slug })
  res.json({ data: { slug, deleted: true } })
}
