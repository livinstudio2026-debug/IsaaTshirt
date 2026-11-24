import { ProductChange } from '../models/ProductChange.js'
import { pictures } from './serialize.js'

// Everything about writing the product change log: what counts as a change, how it is described, and how it is saved.

export const RAILS = { hero: 'Hero carousel', featured: 'Featured drop', bestsellers: 'Best sellers', newarrivals: 'New arrivals' }
export const RAIL_FIELD = { hero: 'heroOrder', featured: 'featuredOrder', bestsellers: 'bestSellerOrder', newarrivals: 'newArrivalOrder' }

const SHORT = 140
const clip = (s) => { const t = String(s ?? '').trim(); return t.length > SHORT ? `${t.slice(0, SHORT - 1)}…` : t }
const sizeNames = (sizes = []) => sizes.map((s) => s.size)
const colourNames = (colors = []) => colors.map((c) => c.name)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const change = (field, label, kind, from, to) => ({ field, label, kind, from, to })

// What changed between two versions of a product, as a list of { field, label, kind, from, to }.
// Stock numbers are deliberately not compared: orders change them all day, and manual stock edits are logged by setStock.
export function diffProduct(before, after) {
  const out = []
  const simple = [['name', 'Name', 'text'], ['tagline', 'Tagline', 'text'], ['category', 'Category', 'text'], ['price', 'Price', 'money'], ['mrp', 'MRP', 'money'], ['isLimited', 'Limited run', 'bool'], ['isActive', 'On the store', 'bool']]
  for (const [key, label, kind] of simple) {
    const a = key === 'isActive' ? before.isActive !== false : before[key]
    const b = key === 'isActive' ? after.isActive !== false : after[key]
    if (kind === 'bool' ? Boolean(a) !== Boolean(b) : a !== b) out.push(change(key, label, kind, kind === 'text' ? clip(a) : a ?? null, kind === 'text' ? clip(b) : b ?? null))
  }
  if ((before.description ?? '') !== (after.description ?? '')) out.push(change('description', 'Description', 'text', clip(before.description), clip(after.description)))
  if (!same(colourNames(before.colors), colourNames(after.colors))) out.push(change('colors', 'Colours', 'list', colourNames(before.colors), colourNames(after.colors)))
  else if (!same((before.colors ?? []).map((c) => c.hex?.toLowerCase()), (after.colors ?? []).map((c) => c.hex?.toLowerCase()))) out.push(change('colorHex', 'Colour shade', 'event', null, 'changed'))
  if (!same(sizeNames(before.sizes), sizeNames(after.sizes))) {
    const gone = sizeNames(before.sizes).filter((s) => !sizeNames(after.sizes).includes(s))
    const lost = gone.map((s) => `${s} (${before.sizes.find((x) => x.size === s).stock} left)`)
    out.push(change('sizes', 'Sizes', 'list', sizeNames(before.sizes), sizeNames(after.sizes)))
    if (lost.length) out[out.length - 1].note = `Removed ${lost.join(', ')}`
  }
  // hero pictures, colour by colour (a colour that is new or gone is already covered by the Colours line above)
  const bh = pictures(before).heroes, ah = pictures(after).heroes
  const beforeAt = new Map((before.colors ?? []).map((c, i) => [c.name, bh[i]?.url ?? null]))
  ;(after.colors ?? []).forEach((c, i) => {
    if (beforeAt.has(c.name) && beforeAt.get(c.name) !== (ah[i]?.url ?? null)) out.push(change(`hero.${c.name}`, `Hero picture · ${c.name}`, 'event', null, 'replaced'))
  })
  // the pictures every colour shares: the back shot first, then details
  const bi = pictures(before).shared, ai = pictures(after).shared
  if (bi[0]?.url !== ai[0]?.url) out.push(change('backImage', 'Back picture', 'event', null, ai[0] ? (bi[0] ? 'replaced' : 'added') : 'removed'))
  if (bi.length !== ai.length) out.push(change('imageCount', 'Extra pictures', 'number', bi.length, ai.length))
  for (const [name, field] of Object.entries(RAIL_FIELD)) {
    const a = typeof before[field] === 'number' ? before[field] : null
    const b = typeof after[field] === 'number' ? after[field] : null
    if (a !== b) out.push(change(`placement.${name}`, RAILS[name], 'position', a, b))
  }
  return out
}

const by = (admin) => ({ id: String(admin._id), name: admin.name })

// Saves one log row. Best effort by design: the change itself already happened, and a logging hiccup must not turn it into an error screen.
export async function logChange(admin, product, action, changes = [], note = '') {
  if (!changes.length && !note && action === 'update') return null
  try {
    return await ProductChange.create({ product: product._id, slug: product.slug, name: product.name ?? '', by: by(admin), action, changes, note })
  } catch (err) {
    console.error(`Product log for ${product.slug} failed:`, err.message)
    return null
  }
}

// Many rows at once (a rail re-order touches several products).
export async function logMany(admin, entries) {
  if (!entries.length) return
  try {
    await ProductChange.insertMany(entries.map((e) => ({ product: e.product._id, slug: e.product.slug, name: e.product.name ?? '', by: by(admin), action: e.action, changes: e.changes ?? [], note: e.note ?? '' })))
  } catch (err) {
    console.error('Product log failed:', err.message)
  }
}

export const serializeChange = (c) => ({
  id: String(c._id),
  at: c.at,
  by: c.by?.name ?? 'Team',
  action: c.action,
  note: c.note ?? '',
  changes: (c.changes ?? []).map((x) => ({ field: x.field, label: x.label, kind: x.kind, from: x.from ?? null, to: x.to ?? null, ...(x.note ? { note: x.note } : {}) })),
})
