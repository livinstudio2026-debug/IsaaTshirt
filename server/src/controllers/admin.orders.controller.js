import { z } from 'zod'
import { Order } from '../models/Order.js'
import { ApiError } from '../utils/ApiError.js'
import { releaseStock } from '../utils/stock.js'
import { serializeAdminOrder, serializeOrderRow } from '../utils/serialize.js'
import { normaliseOrderNumber } from '../utils/orderNumber.js'
import { EMAIL_KINDS, notifyCustomer } from '../utils/orderEmails.js'

// ---- the rules of an order's life --------------------------------------------------------------------------
// placed -> (confirmed) -> packed -> shipped -> delivered. One step forward at a time: no skips, no going back,
// so nothing can be marked delivered before it ships. "confirmed" is optional. Cancelling is only possible until it ships.
const NEXT = { placed: ['confirmed', 'packed'], confirmed: ['packed'], packed: ['shipped'], shipped: ['delivered'] }
const CANCELLABLE = ['placed', 'confirmed', 'packed']
const TAB_FILTER = { new: { $in: ['placed', 'confirmed'] }, packed: 'packed', shipped: 'shipped', delivered: 'delivered', cancelled: 'cancelled' }

const by = (admin) => ({ id: String(admin._id), name: admin.name })
const orderNumber = z.string().transform((v) => normaliseOrderNumber(v) ?? '').pipe(z.string().min(1, 'Not an order number'))

export const numberParam = z.object({ number: orderNumber })

export const listQuery = z.object({
  status: z.enum(['all', 'new', 'packed', 'shipped', 'delivered', 'cancelled']).default('all'),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const text = (max, label) => z.string().trim().min(1, `Enter ${label}`).max(max)
const trackingUrl = z.string().trim().max(500).refine((v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol) } catch { return false } }, 'Enter a full link starting with https://')

export const statusBody = z
  .object({
    status: z.enum(['confirmed', 'packed', 'shipped', 'delivered']),
    tracking: z.object({ carrier: text(40, 'the courier name'), number: text(60, 'the tracking number'), url: trackingUrl }).optional(),
    note: z.string().trim().max(200).optional(),
  })
  .superRefine((b, ctx) => {
    if (b.status === 'shipped' && !b.tracking) ctx.addIssue({ code: 'custom', path: ['tracking', 'carrier'], message: 'Add the courier, tracking number and link to ship this order' })
  })

export const resendBody = z.object({ kind: z.enum(Object.keys(EMAIL_KINDS)) })
export const cancelBody = z.object({ reason: z.string().trim().max(200).optional() })
export const noteBody = z.object({ note: z.string().trim().min(1, 'Write a note').max(300) })

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// GET /api/admin/orders?status=new&q=asha&page=1  -> { data: rows, meta: {page, limit, total, pages}, counts }
export async function listOrders(req, res) {
  const { status, q, page, limit } = req.valid.query
  const filter = {}
  if (status !== 'all') filter.status = TAB_FILTER[status]
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    const digits = q.replace(/\D/g, '')
    filter.$or = [
      { orderNumber: rx },
      { 'customer.name': rx },
      { 'customer.email': rx },
      ...(digits.length >= 3 ? [{ 'customer.phone': new RegExp(escapeRegex(digits)) }] : []),
    ]
  }

  const [rows, total, grouped] = await Promise.all([
    Order.find(filter, 'orderNumber status createdAt customer items totals payment address.city address.state').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])

  const by_ = Object.fromEntries(grouped.map((g) => [g._id, g.n]))
  const n = (s) => by_[s] ?? 0
  const counts = { new: n('placed') + n('confirmed'), packed: n('packed'), shipped: n('shipped'), delivered: n('delivered'), cancelled: n('cancelled') }
  counts.all = Object.values(counts).reduce((a, b) => a + b, 0)

  res.json({ data: rows.map(serializeOrderRow), meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) }, counts })
}

async function load(number) {
  const order = await Order.findOne({ orderNumber: number }).lean()
  if (!order) throw ApiError.notFound('Order not found')
  return order
}

// GET /api/admin/orders/:number
export async function getOrder(req, res) {
  res.json({ data: serializeAdminOrder(await load(req.valid.params.number)) })
}

const stale = () => new ApiError(409, 'Someone else just changed this order. Refresh to see the latest.')

// POST /api/admin/orders/:number/status
export async function changeStatus(req, res) {
  const { number } = req.valid.params
  const { status: to, tracking, note } = req.valid.body
  const order = await load(number)

  if (!(NEXT[order.status] ?? []).includes(to)) {
    const message = order.status === 'cancelled' ? 'This order is cancelled.' : order.status === 'delivered' ? 'This order is already delivered.' : `An order that is ${order.status} can’t be moved to ${to}.`
    throw new ApiError(409, message)
  }

  const now = new Date()
  const set = { status: to }
  if (to === 'shipped') Object.assign(set, { shippedAt: now, tracking })
  if (to === 'delivered') set.deliveredAt = now
  const logNote = to === 'shipped' ? [`${tracking.carrier} · ${tracking.number}`, note].filter(Boolean).join(' — ') : note ?? ''

  // the previous status is part of the filter: if two people act at once, only the first one wins
  const updated = await Order.findOneAndUpdate(
    { orderNumber: number, status: order.status },
    { $set: set, $push: { statusHistory: { status: to, at: now }, history: { at: now, by: by(req.admin), action: to === 'shipped' ? 'ship' : 'status', from: order.status, to, note: logNote } } },
    { new: true },
  ).lean()
  if (!updated) throw stale()

  // the order is saved either way: the customer email is a best-effort follow-up (it records itself on the order when it goes out)
  if (to === 'shipped' || to === 'delivered') notifyCustomer(to, updated)
  res.json({ data: serializeAdminOrder(updated) })
}

// POST /api/admin/orders/:number/cancel  (owner or staff)
export async function cancelOrder(req, res) {
  const { number } = req.valid.params
  const { reason = '' } = req.valid.body
  const order = await load(number)

  if (!CANCELLABLE.includes(order.status)) {
    throw new ApiError(409, order.status === 'cancelled' ? 'This order is already cancelled.' : 'Only orders that haven’t shipped can be cancelled.')
  }

  const now = new Date()
  const updated = await Order.findOneAndUpdate(
    { orderNumber: number, status: { $in: CANCELLABLE } },
    { $set: { status: 'cancelled', cancelledAt: now, cancelReason: reason }, $push: { statusHistory: { status: 'cancelled', at: now }, history: { at: now, by: by(req.admin), action: 'cancel', from: order.status, to: 'cancelled', note: reason } } },
    { new: true },
  ).lean()
  if (!updated) throw stale()

  // the status flip above is atomic, so only one request ever gets here: put the pieces back using the same stock logic as checkout
  let result = updated
  try {
    await releaseStock(updated.items)
    await Order.updateOne({ _id: updated._id }, { stockReleased: true })
    result = { ...updated, stockReleased: true }
  } catch (err) {
    console.error(`Order ${number}: cancelled but stock was not restored:`, err.message)
  }
  notifyCustomer('cancelled', updated) // after the stock is back, so the customer never hears "cancelled" about an order we still hold stock for
  res.json({ data: serializeAdminOrder(result) })
}

// POST /api/admin/orders/:number/mark-paid  (cash on delivery, once it is on its way)
export async function markPaid(req, res) {
  const { number } = req.valid.params
  const order = await load(number)
  if (order.payment.method !== 'cod') throw new ApiError(409, 'Only cash-on-delivery orders are marked paid by hand.')
  if (order.payment.status === 'paid') throw new ApiError(409, 'This order is already marked as paid.')
  if (!['shipped', 'delivered'].includes(order.status)) throw new ApiError(409, 'You can mark a COD order paid once it has shipped.')

  const now = new Date()
  const updated = await Order.findOneAndUpdate(
    { orderNumber: number, 'payment.method': 'cod', 'payment.status': { $ne: 'paid' }, status: { $in: ['shipped', 'delivered'] } },
    { $set: { 'payment.status': 'paid', 'payment.paidAt': now }, $push: { history: { at: now, by: by(req.admin), action: 'paid', note: `Cash collected: ₹${Math.round(order.totals.total / 100).toLocaleString('en-IN')}` } } },
    { new: true },
  ).lean()
  if (!updated) throw stale()
  res.json({ data: serializeAdminOrder(updated) })
}

// POST /api/admin/orders/:number/note  (an internal note on the order's history)
export async function addNote(req, res) {
  const { number } = req.valid.params
  const now = new Date()
  const updated = await Order.findOneAndUpdate({ orderNumber: number }, { $push: { history: { at: now, by: by(req.admin), action: 'note', note: req.valid.body.note } } }, { new: true }).lean()
  if (!updated) throw ApiError.notFound('Order not found')
  res.json({ data: serializeAdminOrder(updated) })
}

// POST /api/admin/orders/:number/resend-email  { kind: shipped | delivered | cancelled }
// For when an email didn't go out (mail server down, wrong address fixed later). Only the email that matches where the order is now.
export async function resendEmail(req, res) {
  const { number } = req.valid.params
  const { kind } = req.valid.body
  const order = await load(number)
  const spec = EMAIL_KINDS[kind]
  if (!spec.when.includes(order.status)) throw new ApiError(409, `The ${spec.label.toLowerCase()} email only applies to ${spec.when.join(' or ')} orders.`)
  if (!(await notifyCustomer(kind, order))) throw new ApiError(502, 'The email could not be sent. Check that email is set up on the server, then try again.')
  const now = new Date()
  const updated = await Order.findOneAndUpdate({ orderNumber: number }, { $push: { history: { at: now, by: by(req.admin), action: 'email', note: `${spec.label} email sent again to ${order.customer.email}` } } }, { new: true }).lean()
  res.json({ data: serializeAdminOrder(updated ?? order) })
}
