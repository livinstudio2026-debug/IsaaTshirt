import { z } from 'zod'
import { ContactMessage } from '../models/ContactMessage.js'
import { Subscriber } from '../models/Subscriber.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeMessage, serializeSubscriber } from '../utils/serialize.js'
import { istKey } from '../utils/istDates.js'
import { csvRow } from '../utils/csv.js'

// Who can do what (enforced in routes/admin.js):
//   owner + staff: read messages and subscribers, mark a message new / read / replied
//   owner only:    delete a message (spam), download the subscriber list as CSV (it is a list of customers' emails)

const STATUSES = ['new', 'read', 'replied']
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const by = (admin) => ({ id: String(admin._id), name: admin.name })
const pages = (total, limit) => Math.max(1, Math.ceil(total / limit))

export const idParam = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'Not a message id') })

export const messagesQuery = z.object({
  status: z.enum(['all', ...STATUSES]).default('all'),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})
export const messageStatusBody = z.object({ status: z.enum(STATUSES) })

export const subscribersQuery = z.object({
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

// GET /api/admin/messages?status=new&q=&page=1  -> { data, meta, counts: { new, read, replied, all } }
export async function listMessages(req, res) {
  const { status, q, page, limit } = req.valid.query
  const filter = {}
  if (status !== 'all') filter.status = status
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { email: rx }, { message: rx }]
  }
  const [rows, total, grouped] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
  ])
  const g = Object.fromEntries(grouped.map((x) => [x._id, x.n]))
  const counts = { new: g.new ?? 0, read: g.read ?? 0, replied: g.replied ?? 0 }
  counts.all = counts.new + counts.read + counts.replied
  res.json({ data: rows.map(serializeMessage), meta: { page, limit, total, pages: pages(total, limit) }, counts })
}

// POST /api/admin/messages/:id/status  { status }
export async function setMessageStatus(req, res) {
  const { status } = req.valid.body
  const update = status === 'new'
    ? { $set: { status }, $unset: { handledBy: 1, handledAt: 1 } } // back in the "to do" pile
    : { $set: { status, handledBy: by(req.admin), handledAt: new Date() } }
  const doc = await ContactMessage.findOneAndUpdate({ _id: req.valid.params.id }, update, { new: true }).lean()
  if (!doc) throw ApiError.notFound('Message not found')
  res.json({ data: serializeMessage(doc) })
}

// DELETE /api/admin/messages/:id  (owner)
export async function deleteMessage(req, res) {
  const gone = await ContactMessage.findOneAndDelete({ _id: req.valid.params.id }).lean()
  if (!gone) throw ApiError.notFound('Message not found')
  res.json({ data: { id: String(gone._id), deleted: true } })
}

// GET /api/admin/inbox/unread  -> { data: { unread } }   (small and cheap: the navigation badge asks for it every minute)
export async function inboxUnread(_req, res) {
  res.json({ data: { unread: await ContactMessage.countDocuments({ status: 'new' }) } })
}

// GET /api/admin/subscribers?q=&page=  -> { data, meta, counts: { total, last7Days } }
export async function listSubscribers(req, res) {
  const { q, page, limit } = req.valid.query
  const filter = q ? { email: new RegExp(escapeRegex(q), 'i') } : {}
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const [rows, total, all, recent] = await Promise.all([
    Subscriber.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Subscriber.countDocuments(filter),
    Subscriber.countDocuments({}),
    Subscriber.countDocuments({ createdAt: { $gte: weekAgo } }),
  ])
  res.json({ data: rows.map(serializeSubscriber), meta: { page, limit, total, pages: pages(total, limit) }, counts: { total: all, last7Days: recent } })
}

// GET /api/admin/subscribers/export  (owner) -> a CSV file, streamed so a big list never sits in memory
export async function exportSubscribers(_req, res) {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="isaa-subscribers-${istKey(new Date())}.csv"`,
  })
  res.write('\uFEFF' + csvRow(['email', 'source', 'subscribed_at']) + '\r\n') // the BOM makes Excel read the file as UTF-8
  try {
    for await (const s of Subscriber.find({}).sort({ createdAt: -1, _id: -1 }).lean().cursor()) {
      res.write(csvRow([s.email, s.source ?? 'footer', s.createdAt ? new Date(s.createdAt).toISOString() : '']) + '\r\n')
    }
    res.end()
  } catch (err) {
    console.error('Subscriber export failed:', err.message)
    res.destroy(err) // the file is already half-sent: cut the connection so the browser shows a failed download rather than a short list
  }
}
