import { Order } from '../models/Order.js'
import { Product } from '../models/Product.js'
import { ContactMessage } from '../models/ContactMessage.js'
import { Subscriber } from '../models/Subscriber.js'
import { store } from '../config/store.js'
import { serializeOrderRow, serializeStockAlert } from '../utils/serialize.js'
import { DAY_MS, IST_ZONE, istDayStart } from '../utils/istDates.js'
import { summarise } from '../utils/dashboard.js'

const LOW = store.lowStockAt
const STUCK_DAYS = 7 // shipped this long ago and still not delivered
const QUEUE_EACH = 5 // oldest orders to show per queue
const STOCK_ROWS = 8
const ROW_FIELDS = 'orderNumber status createdAt customer items totals payment address.city address.state'

// GET /api/admin/dashboard
// Everything the Overview screen shows, in one round trip. Money is paise. "Today" is today in India.
// Revenue counts every order that wasn't cancelled (placed, not yet delivered or paid: cash on delivery is booked when ordered).
export async function getDashboard(_req, res) {
  const now = new Date()
  const since = new Date(istDayStart(now).getTime() - 59 * DAY_MS) // 60 days: 30 to show, 30 to compare with
  const stuckBefore = new Date(now.getTime() - STUCK_DAYS * DAY_MS)

  const [daily, grouped, oldestNew, oldestPacked, stuck, cod, stockDocs, unread, subscribers, newSubscribers] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $ne: 'cancelled' } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: IST_ZONE } },
        orders: { $sum: 1 },
        revenue: { $sum: '$totals.total' },
        pieces: { $sum: { $sum: '$items.qty' } },
      } },
    ]),
    Order.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    Order.find({ status: { $in: ['placed', 'confirmed'] } }, ROW_FIELDS).sort({ createdAt: 1 }).limit(QUEUE_EACH).lean(),
    Order.find({ status: 'packed' }, ROW_FIELDS).sort({ createdAt: 1 }).limit(QUEUE_EACH).lean(),
    Order.countDocuments({ status: 'shipped', shippedAt: { $lte: stuckBefore } }),
    Order.aggregate([
      { $match: { status: 'delivered', 'payment.method': 'cod', 'payment.status': 'pending' } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totals.total' } } },
    ]),
    Product.find({ isActive: true, sizes: { $elemMatch: { stock: { $lte: LOW } } } }, 'slug name images sizes').lean(),
    ContactMessage.countDocuments({ status: 'new' }),
    Subscriber.countDocuments({}),
    Subscriber.countDocuments({ createdAt: { $gte: new Date(now.getTime() - 7 * DAY_MS) } }),
  ])

  const n = Object.fromEntries(grouped.map((g) => [g._id, g.n]))
  // Most urgent first: nothing left to sell, then whichever product has a size down to the fewest pieces (a size that's gone counts as 0).
  const alerts = stockDocs
    .map((p) => serializeStockAlert(p, LOW))
    .sort((a, b) => (b.state === 'out') - (a.state === 'out') || Math.min(...a.sizes.map((s) => s.stock)) - Math.min(...b.sizes.map((s) => s.stock)) || a.name.localeCompare(b.name))

  res.json({
    data: {
      generatedAt: now.toISOString(),
      sales: summarise(daily, now),
      actions: {
        new: { count: (n.placed ?? 0) + (n.confirmed ?? 0), oldest: oldestNew[0]?.createdAt ?? null },
        packed: { count: n.packed ?? 0, oldest: oldestPacked[0]?.createdAt ?? null },
        stuck: { count: stuck, days: STUCK_DAYS },
        codToCollect: { count: cod[0]?.count ?? 0, amount: cod[0]?.amount ?? 0 },
      },
      queue: [
        ...oldestNew.map((o) => ({ ...serializeOrderRow(o), next: 'pack' })),
        ...oldestPacked.map((o) => ({ ...serializeOrderRow(o), next: 'ship' })),
      ],
      stock: {
        lowAt: LOW,
        out: alerts.filter((a) => a.state === 'out').length,
        low: alerts.filter((a) => a.state === 'low').length,
        items: alerts.slice(0, STOCK_ROWS),
      },
      inbox: { unread, subscribers, newSubscribers7d: newSubscribers },
    },
  })
}
