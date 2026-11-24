import { env } from './env.js'

// Money rules for checkout, in one place. All amounts are paise (₹1 = 100). Change the values in .env.
export const store = {
  currency: 'INR',
  maxQty: 10, // most of one piece per order line
  lowStockAt: env.LOW_STOCK_AT, // back office: a size at or below this is "low"
  freeShippingMin: Math.round(env.FREE_SHIPPING_MIN_INR * 100),
  shippingFee: Math.round(env.SHIPPING_FEE_INR * 100),
  codFee: Math.round(env.COD_FEE_INR * 100),
  payments: {
    cod: { enabled: true, label: 'Cash on delivery', note: 'Pay when your order arrives' },
    online: { enabled: false, label: 'UPI, cards & net banking', note: 'Coming soon' },
  },
}

export const shippingFor = (subtotal) => (subtotal >= store.freeShippingMin ? 0 : store.shippingFee)
export const paymentFee = (method) => (method === 'cod' ? store.codFee : 0)

export const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
]
