import { z } from 'zod'
import { Order, newOrderNumber } from '../models/Order.js'
import { Product } from '../models/Product.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeOrder } from '../utils/serialize.js'
import { reserveStock, releaseStock } from '../utils/stock.js'
import { sendOrderEmails } from '../utils/orderEmails.js'
import { normaliseOrderNumber } from '../utils/orderNumber.js'
import { store, STATES, shippingFor, paymentFee } from '../config/store.js'

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120)
const lower = (v) => v.toLowerCase()

// Indian mobile: 10 digits starting 6-9. +91 / 91 / 0 prefixes and spaces/dashes are accepted and stripped.
const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()-]/g, '').replace(/^(?:\+91|91|0)(?=\d{10}$)/, ''))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'))

const optional = (max) => z.string().trim().max(max).optional().or(z.literal('').transform(() => undefined))

export const orderBody = z.object({
  items: z
    .array(z.object({ slug, size: z.string().trim().min(1).max(10), color: z.string().trim().max(40).default(''), qty: z.number().int().min(1).max(store.maxQty) }))
    .min(1, 'Your bag is empty')
    .max(20),
  customer: z.object({
    name: z.string().trim().min(2, 'Please enter your full name').max(80),
    phone,
    email: z.email('Please enter a valid email').max(254).transform(lower),
  }),
  address: z.object({
    line1: z.string().trim().min(5, 'Please enter your house / street address').max(120),
    line2: optional(120),
    landmark: optional(80),
    city: z.string().trim().min(2, 'Please enter your city').max(60),
    state: z.enum(STATES, { error: 'Please choose your state' }),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode'),
  }),
  notes: optional(300),
  paymentMethod: z.enum(['cod', 'online']).default('cod'),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  website: z.string().max(200).optional(), // honeypot
})

export const trackBody = z.object({
  orderNumber: z.string().trim().transform((v) => normaliseOrderNumber(v) ?? '').pipe(z.string().min(1, 'That doesn’t look like an order number (ISA-241121-7K3M9Q)')),
  email: z.email('Please enter a valid email').transform(lower),
})

const conflict = (details) => new ApiError(409, 'Some items in your bag are no longer available in that quantity', details)

// GET /api/store-config: the numbers and options checkout needs, from one source of truth.
export function getStoreConfig(_req, res) {
  res.json({
    data: {
      currency: store.currency,
      maxQty: store.maxQty,
      freeShippingMin: store.freeShippingMin,
      shippingFee: store.shippingFee,
      codFee: store.codFee,
      payments: store.payments,
      states: STATES,
    },
  })
}

// POST /api/orders: guest checkout. Prices come from the database, never from the browser.
export async function createOrder(req, res) {
  const body = req.valid.body
  if (body.website) throw new ApiError(400, 'Invalid request')

  const method = store.payments[body.paymentMethod]
  if (!method?.enabled) throw new ApiError(400, 'That payment method isn’t available yet. Please choose cash on delivery.')

  // a double-click or retry with the same key gets the order already placed
  const existing = await Order.findOne({ idempotencyKey: body.idempotencyKey }).lean()
  if (existing) return res.status(200).json({ data: serializeOrder(existing) })

  // the same piece in the same size and colour on two lines counts once
  const merged = new Map()
  for (const i of body.items) {
    const key = `${i.slug}|${i.size}|${i.color.toLowerCase()}`
    merged.set(key, merged.has(key) ? { ...i, qty: merged.get(key).qty + i.qty } : i)
  }
  const wanted = [...merged.values()]
  if (wanted.some((i) => i.qty > store.maxQty)) throw new ApiError(400, `You can order up to ${store.maxQty} of a piece`)

  const docs = await Product.find({ slug: { $in: [...new Set(wanted.map((i) => i.slug))] }, isActive: true }).lean()
  const bySlug = new Map(docs.map((d) => [d.slug, d]))

  const lines = []
  const problems = []
  for (const w of wanted) {
    const p = bySlug.get(w.slug)
    const size = p?.sizes.find((s) => s.size === w.size)
    if (!p || !size) { problems.push({ slug: w.slug, size: w.size, reason: 'unavailable', requested: w.qty, available: 0 }); continue }
    if (size.stock < w.qty) { problems.push({ slug: w.slug, size: w.size, reason: 'out_of_stock', requested: w.qty, available: size.stock }); continue }
    const color = p.colors.find((c) => c.name.toLowerCase() === w.color.toLowerCase())?.name ?? (p.colors.length === 1 || !w.color ? p.colors[0]?.name ?? '' : null)
    if (color === null) { problems.push({ slug: w.slug, size: w.size, reason: 'unavailable', requested: w.qty, available: 0 }); continue }
    lines.push({ product: p._id, slug: p.slug, name: p.name, image: p.images[0]?.url ?? '', color, size: w.size, qty: w.qty, price: p.price, mrp: p.mrp })
  }
  if (problems.length) throw conflict(problems)

  // take the stock atomically; if someone bought the last piece a moment ago, say so
  const reserved = await reserveStock(lines)
  if (!reserved.ok) {
    const bad = reserved.failed[0]
    const fresh = await Product.findOne({ _id: bad.product }).lean()
    throw conflict([{ slug: bad.slug, size: bad.size, reason: 'out_of_stock', requested: bad.qty, available: fresh?.sizes.find((s) => s.size === bad.size)?.stock ?? 0 }])
  }

  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0)
  const shipping = shippingFor(subtotal)
  const codFee = paymentFee(body.paymentMethod)
  const now = new Date()

  let order
  try {
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      try {
        order = await Order.create({
          orderNumber: newOrderNumber(),
          idempotencyKey: body.idempotencyKey,
          status: 'placed',
          statusHistory: [{ status: 'placed', at: now }],
          items: lines,
          customer: body.customer,
          address: body.address,
          notes: body.notes ?? '',
          totals: { subtotal, shipping, codFee, total: subtotal + shipping + codFee },
          payment: { method: body.paymentMethod, status: 'pending' },
          ip: req.ip,
          userAgent: req.get('user-agent')?.slice(0, 300),
        })
      } catch (err) {
        if (err?.code !== 11000) throw err
        if (err.keyPattern?.idempotencyKey) { // two identical submits raced; keep the first, give the stock back
          await releaseStock(lines)
          const first = await Order.findOne({ idempotencyKey: body.idempotencyKey }).lean()
          return res.status(200).json({ data: serializeOrder(first) })
        }
        // order-number collision: loop and draw a new one
      }
    }
    if (!order) throw new ApiError(500, 'Could not place your order. Please try again.')
  } catch (err) {
    if (!res.headersSent) await releaseStock(lines)
    throw err
  }

  const plain = typeof order.toObject === 'function' ? order.toObject() : order
  // the order is saved: emails are a best-effort follow-up that never blocks or fails the response
  sendOrderEmails(plain)
    .then((sent) => (sent.customer || sent.owner ? Order.updateOne({ _id: plain._id }, { emails: sent }) : null))
    .catch((err) => console.error('Order email bookkeeping failed:', err.message))

  res.status(201).json({ data: serializeOrder(plain) })
}

// POST /api/orders/track: the order number alone isn't enough, the email must match too.
export async function trackOrder(req, res) {
  const { orderNumber, email } = req.valid.body
  const order = await Order.findOne({ orderNumber, 'customer.email': email }).lean()
  if (!order) throw ApiError.notFound('We couldn’t find an order with those details. Check the order number and email, then try again.')
  res.json({ data: serializeOrder(order, { mask: true }) })
}
