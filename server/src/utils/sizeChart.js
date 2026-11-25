import { z } from 'zod'
import { SIZES } from '../models/Product.js'

// Everything about the shape of a size table: how it is checked, tidied, and shown to shoppers.
// A table is { columns: ['Chest', 'Length'], rows: [{ size: 'M', values: [116, 72] }] }, in centimetres.

export const MAX_COLUMNS = 6
export const MAX_ROWS = 12

const measurement = z.number('Enter a number').min(1, 'Must be more than 0').max(300, 'That looks too high').transform((n) => Math.round(n * 10) / 10)

export const chartTable = z.object({
  columns: z.array(z.string('Name this measurement').trim().min(1, 'Name this measurement').max(24, 'Keep it to 24 characters')).min(1, 'Add at least one measurement').max(MAX_COLUMNS, `Up to ${MAX_COLUMNS} measurements`),
  rows: z.array(z.object({ size: z.enum(SIZES), values: z.array(measurement) })).min(1, 'Add at least one size').max(MAX_ROWS),
}).superRefine((t, ctx) => {
  if (t.rows.some((r) => r.values.length !== t.columns.length)) ctx.addIssue({ code: 'custom', path: ['rows'], message: 'Every size needs a value for every measurement' })
  if (new Set(t.rows.map((r) => r.size)).size !== t.rows.length) ctx.addIssue({ code: 'custom', path: ['rows'], message: 'Each size can only be listed once' })
  if (new Set(t.columns.map((c) => c.toLowerCase())).size !== t.columns.length) ctx.addIssue({ code: 'custom', path: ['columns'], message: 'Each measurement can only be listed once' })
})

const order = (size) => SIZES.indexOf(size)

// Rows always read in the usual size order (XS → XXL, 28 → 36), whatever order they were typed in.
export const tidyTable = (t) => ({ columns: t.columns, rows: [...t.rows].sort((a, b) => order(a.size) - order(b.size)).map((r) => ({ size: r.size, values: r.values })) })

export const hasRows = (t) => Boolean(t?.rows?.length && t?.columns?.length)

// What a shopper sees for one product: the product's own (custom) table if it has one, else the shared chart it points to.
// Only the sizes the product actually comes in are listed (a chart for XS–XXL shows S–XL for a product made in S–XL);
// when none of them match, the whole table is shown rather than nothing. Returns null when the product has no usable table.
export function sizeGuideOf(product, chart) {
  const custom = hasRows(product.customChart) ? product.customChart : null
  const source = custom ?? (hasRows(chart) ? chart : null)
  if (!source) return null
  const have = new Set((product.sizes ?? []).map((s) => s.size))
  const mine = source.rows.filter((r) => have.has(r.size))
  const rows = (mine.length ? mine : source.rows).map((r) => ({ size: r.size, values: r.values }))
  return { name: custom ? 'This piece' : chart.name, source: custom ? 'custom' : 'shared', unit: 'cm', columns: [...source.columns], rows, note: custom ? '' : chart.note ?? '' }
}

// The "how it fits" line and the model details, or null when none was filled in.
export function fitOf(product) {
  const note = product.fit?.note?.trim() ?? ''
  const height = Number.isFinite(product.fit?.modelHeightCm) ? product.fit.modelHeightCm : null
  const size = product.fit?.modelSize?.trim() ?? ''
  if (!note && !height && !size) return null
  return { note, modelHeightCm: height, modelSize: size }
}
