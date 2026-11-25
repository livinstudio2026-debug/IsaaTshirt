import { env } from './env.js'
import { Setting, STORE_KEY } from '../models/Setting.js'

// Money rules for checkout, in one place. All amounts are paise (₹1 = 100).
// The values in .env are the DEFAULTS; whatever the owner saves in the back office (Settings) wins. See refreshStoreSettings below.
export const storeDefaults = {
  freeShippingMin: Math.round(env.FREE_SHIPPING_MIN_INR * 100),
  shippingFee: Math.round(env.SHIPPING_FEE_INR * 100),
  codFee: Math.round(env.COD_FEE_INR * 100),
  codFreeMin: Math.round(env.COD_FREE_MIN_INR * 100), // COD fee is waived at or above this subtotal; 0 = never waived
}

export const store = {
  currency: 'INR',
  maxQty: 10, // most of one piece per order line
  lowStockAt: env.LOW_STOCK_AT, // back office: a size at or below this is "low"
  ...storeDefaults,
  payments: {
    cod: { enabled: true, label: 'Cash on delivery', note: 'Pay when your order arrives' },
    online: { enabled: false, label: 'UPI, cards & net banking', note: 'Coming soon' },
  },
}

export const MONEY_KEYS = Object.keys(storeDefaults)

// Put saved settings (or nothing, meaning "back to .env") onto `store`. A field that is missing falls back to its default.
export function applyStoreSettings(doc) {
  for (const k of MONEY_KEYS) store[k] = Number.isInteger(doc?.[k]) ? doc[k] : storeDefaults[k]
}

// Re-read the saved settings, at most every few seconds, so a change made on one server reaches the others quickly
// and a checkout never waits on the database for this more than once in a while. Never throws: on a database hiccup the last known values stay.
const REFRESH_MS = env.NODE_ENV === 'test' ? 0 : 5000
let loadedAt = 0
export async function refreshStoreSettings({ force = false } = {}) {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return store
  try {
    applyStoreSettings(await Setting.findOne({ key: STORE_KEY }).lean())
    loadedAt = Date.now()
  } catch (err) {
    console.error('Could not read store settings:', err.message)
  }
  return store
}

export const shippingFor = (subtotal) => (subtotal >= store.freeShippingMin ? 0 : store.shippingFee)

// The cash-on-delivery fee for an order. Waived once the subtotal reaches codFreeMin (0 = never waived). Other payment methods have no fee.
export const codWaived = (subtotal) => store.codFreeMin > 0 && subtotal >= store.codFreeMin
export const paymentFee = (method, subtotal = 0) => (method === 'cod' && !codWaived(subtotal) ? store.codFee : 0)

export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
]
