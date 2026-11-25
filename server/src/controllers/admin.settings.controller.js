import { z } from 'zod'
import { Setting, STORE_KEY } from '../models/Setting.js'
import { store, storeDefaults, MONEY_KEYS, refreshStoreSettings } from '../config/store.js'

// Store settings: the money rules checkout uses. The owner edits them (routes/admin.js); everything here talks in whole rupees,
// the database and checkout in paise. A value that was never saved falls back to .env (see config/store.js).

const rupees = (max, what) => z.number(`Enter ${what}`).int('Use whole rupees').min(0, 'Can’t be below ₹0').max(max, `Keep it at ₹${max.toLocaleString('en-IN')} or less`)

export const updateBody = z.object({
  freeShippingMin: rupees(100000, 'the free-shipping minimum'),
  shippingFee: rupees(5000, 'the shipping fee'),
  codFee: rupees(5000, 'the COD fee'),
  codFreeMin: rupees(100000, 'the COD-free minimum'),
}).strict()

const toRupees = (paise) => Math.round(paise / 100)

async function view() {
  const doc = await Setting.findOne({ key: STORE_KEY }).lean()
  const current = {}
  const defaults = {}
  for (const k of MONEY_KEYS) { current[k] = toRupees(store[k]); defaults[k] = toRupees(storeDefaults[k]) }
  return { ...current, defaults, customised: Boolean(doc), updatedAt: doc?.updatedAt ?? null, updatedBy: doc?.updatedBy ?? '' }
}

// GET /api/admin/settings -> { data: { freeShippingMin, shippingFee, codFee, codFreeMin (rupees), defaults, customised, updatedAt, updatedBy } }
export async function getSettings(_req, res) {
  await refreshStoreSettings({ force: true })
  res.json({ data: await view() })
}

// PUT /api/admin/settings: saves all four (rupees). Takes effect on the next checkout, with no restart.
export async function updateSettings(req, res) {
  const b = req.valid.body
  const set = { updatedBy: req.admin?.name ?? '' }
  for (const k of MONEY_KEYS) set[k] = b[k] * 100
  await Setting.findOneAndUpdate({ key: STORE_KEY }, { $set: set, $setOnInsert: { key: STORE_KEY } }, { upsert: true, runValidators: true })
  await refreshStoreSettings({ force: true })
  res.json({ data: await view() })
}

// DELETE /api/admin/settings: forget what was saved and go back to the .env defaults.
export async function resetSettings(_req, res) {
  await Setting.deleteOne({ key: STORE_KEY })
  await refreshStoreSettings({ force: true })
  res.json({ data: await view() })
}
