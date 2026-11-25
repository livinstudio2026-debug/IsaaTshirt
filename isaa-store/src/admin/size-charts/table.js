import { SIZE_ORDER } from '../products/catalog'

// The editable size table lives in screens as strings (so half-typed numbers are fine); these turn it into what the API wants and back.
// A table here is { columns: ['Chest', ...], rows: [{ size: 'M', values: ['116', ...] }] }.

export const EMPTY_TABLE = { columns: ['Chest', 'Length'], rows: [] }

export const tableFromApi = (t) => ({ columns: [...t.columns], rows: t.rows.map((r) => ({ size: r.size, values: r.values.map(String) })) })

export const bySizeOrder = (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)

const num = (v) => Number(String(v).trim())
export const validNumber = (v) => String(v).trim() !== '' && Number.isFinite(num(v)) && num(v) > 0 && num(v) <= 300

// A message when the table can't be saved yet, or '' when it can.
export function tableProblem(t) {
  if (!t.columns.length) return 'Add at least one measurement.'
  if (t.columns.some((c) => !c.trim())) return 'Give every measurement a name, like Chest.'
  if (new Set(t.columns.map((c) => c.trim().toLowerCase())).size !== t.columns.length) return 'Each measurement can only be listed once.'
  if (!t.rows.length) return 'Add at least one size.'
  if (t.rows.some((r) => r.values.length !== t.columns.length || r.values.some((v) => !validNumber(v)))) return 'Fill in every box with a number above 0 (up to 300).'
  return ''
}

export const tableToApi = (t) => ({
  columns: t.columns.map((c) => c.trim()),
  rows: [...t.rows].sort(bySizeOrder).map((r) => ({ size: r.size, values: r.values.map(num) })),
})
