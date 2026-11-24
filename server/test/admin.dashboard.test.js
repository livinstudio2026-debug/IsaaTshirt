// Back-office dashboard without a database: the models are in-memory fakes, the date and sales maths are tested directly.
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { Admin } from '../src/models/Admin.js'
import { AdminSession } from '../src/models/AdminSession.js'
import { Order } from '../src/models/Order.js'
import { Product } from '../src/models/Product.js'
import { ContactMessage } from '../src/models/ContactMessage.js'
import { Subscriber } from '../src/models/Subscriber.js'
import { createApp } from '../src/app.js'
import { hashToken } from '../src/middleware/adminAuth.js'
import { istDayStart, istKey, istDayKeys } from '../src/utils/istDates.js'
import { summarise } from '../src/utils/dashboard.js'

const app = createApp()

// ---- "today" means today in India ------------------------------------------------------------------------------

test('a day starts at midnight in India, not in UTC', () => {
  const justAfterMidnightIST = new Date('2026-11-20T18:40:00Z') // 00:10 on the 21st in India
  assert.equal(istKey(justAfterMidnightIST), '2026-11-21')
  assert.equal(istDayStart(justAfterMidnightIST).toISOString(), '2026-11-20T18:30:00.000Z')
  const justBefore = new Date('2026-11-20T18:29:00Z') // 23:59 on the 20th in India
  assert.equal(istKey(justBefore), '2026-11-20')
  assert.deepEqual(istDayKeys(3, justAfterMidnightIST), ['2026-11-19', '2026-11-20', '2026-11-21'])
  assert.equal(istDayKeys(60).length, 60)
})

test('day keys cross month and year ends', () => {
  assert.deepEqual(istDayKeys(3, new Date('2027-01-01T05:00:00Z')), ['2026-12-30', '2026-12-31', '2027-01-01'])
})

// ---- the sales numbers -----------------------------------------------------------------------------------------

const NOW = new Date('2026-11-20T18:40:00Z') // 21 Nov 2026, 00:10 in India
const rows = [
  { _id: '2026-11-21', orders: 2, revenue: 200_00, pieces: 3 }, // today
  { _id: '2026-11-20', orders: 1, revenue: 50_00, pieces: 1 }, // yesterday
  { _id: '2026-11-17', orders: 3, revenue: 300_00, pieces: 4 }, // this week
  { _id: '2026-11-10', orders: 4, revenue: 400_00, pieces: 5 }, // the week before
  { _id: '2026-10-25', orders: 5, revenue: 500_00, pieces: 6 }, // in the 30 days, before the 7
  { _id: '2026-09-30', orders: 6, revenue: 600_00, pieces: 7 }, // the 30 days before that
]

test('today, 7 days and 30 days each come with the period before them', () => {
  const s = summarise(rows, NOW)
  assert.deepEqual([s.today.orders, s.today.revenue, s.today.pieces, s.today.avgOrder], [2, 200_00, 3, 100_00])
  assert.deepEqual([s.today.prev.orders, s.today.prev.revenue], [1, 50_00], 'today is compared with yesterday')
  assert.deepEqual([s.week.orders, s.week.revenue], [6, 550_00], 'last 7 days: 15–21 Nov')
  assert.deepEqual([s.week.prev.orders, s.week.prev.revenue], [4, 400_00], 'the 7 days before: 8–14 Nov')
  assert.deepEqual([s.month.orders, s.month.revenue], [15, 1450_00], 'last 30 days: 23 Oct – 21 Nov')
  assert.deepEqual([s.month.prev.orders, s.month.prev.revenue], [6, 600_00], '30 days before: 24 Sep – 22 Oct')
})

test('the chart series is the last 30 days, oldest first, with quiet days as zero', () => {
  const s = summarise(rows, NOW)
  assert.equal(s.series.length, 30)
  assert.equal(s.series[0].date, '2026-10-23')
  assert.equal(s.series.at(-1).date, '2026-11-21')
  assert.deepEqual(s.series.at(-1), { date: '2026-11-21', orders: 2, revenue: 200_00, pieces: 3 })
  assert.deepEqual(s.series.find((d) => d.date === '2026-11-19'), { date: '2026-11-19', orders: 0, revenue: 0, pieces: 0 })
})

test('no orders at all: zeros, and no division by zero', () => {
  const s = summarise([], NOW)
  assert.deepEqual([s.today.revenue, s.today.avgOrder, s.month.orders, s.month.prev.revenue], [0, 0, 0, 0])
})

// ---- the endpoint ----------------------------------------------------------------------------------------------

const ago = (ms) => new Date(Date.now() - ms)
const HOUR = 3_600_000
const mkOrder = (n, status, createdAt, over = {}) => ({
  _id: `o${n}`, orderNumber: `ISA-241121-ABCD0${n}`, status, createdAt,
  items: [{ product: 'p1', slug: 'racing', name: 'Racing Tee', image: '', color: 'Olive', size: 'M', qty: 2, price: 84900, mrp: 124900 }],
  customer: { name: `Asha ${n}`, phone: '9876543210', email: `asha${n}@example.com` },
  address: { city: 'Coimbatore', state: 'Tamil Nadu' }, totals: { total: 169800 }, payment: { method: 'cod', status: 'pending' }, ...over,
})
const mkProduct = (slug, sizes) => ({ _id: slug, slug, name: slug.toUpperCase(), images: [{ url: `https://res.cloudinary.com/demo/image/upload/v1/isaa/products/${slug}.webp` }], sizes: sizes.map(([size, stock]) => ({ size, stock })), isActive: true })

let orders, products, sessions, admins
beforeEach(() => {
  orders = [
    mkOrder(1, 'placed', ago(30 * HOUR)), mkOrder(2, 'confirmed', ago(2 * HOUR)), mkOrder(3, 'packed', ago(5 * HOUR)), mkOrder(4, 'shipped', ago(9 * 86_400_000), { shippedAt: ago(8 * 86_400_000) }),
    mkOrder(5, 'delivered', ago(10 * 86_400_000), { payment: { method: 'cod', status: 'pending' } }), mkOrder(6, 'cancelled', ago(HOUR)),
  ]
  products = [
    mkProduct('healthy', [['S', 20], ['M', 20]]), // not in the list: the real query filters it out
    mkProduct('compass', [['S', 20], ['M', 3], ['L', 0]]), // low
    mkProduct('orbit', [['S', 0], ['M', 0]]), // sold out
    mkProduct('racing', [['S', 4], ['M', 1]]), // low, but no size is completely gone
  ]
  admins = [{ _id: 'a1', email: 'leo@isaa.in', name: 'Leo', role: 'owner', isActive: true }, { _id: 'a2', email: 'sam@isaa.in', name: 'Sam', role: 'staff', isActive: true }]
  sessions = [{ tokenHash: hashToken('owner-tok'), admin: 'a1', expiresAt: new Date(Date.now() + 1e6) }, { tokenHash: hashToken('staff-tok'), admin: 'a2', expiresAt: new Date(Date.now() + 1e6) }]
  mock.method(AdminSession, 'findOne', (f) => ({ lean: async () => sessions.find((s) => s.tokenHash === f.tokenHash) ?? null }))
  mock.method(Admin, 'findById', (id) => ({ lean: async () => admins.find((a) => a._id === id) ?? null }))

  mock.method(Order, 'aggregate', async (pipeline) => {
    const group = pipeline.find((s) => s.$group).$group
    if (typeof group._id === 'object' && group._id?.$dateToString) {
      assert.equal(group._id.$dateToString.timezone, 'Asia/Kolkata', 'days are grouped in Indian time')
      assert.deepEqual(pipeline[0].$match.status, { $ne: 'cancelled' }, 'cancelled orders are not revenue')
      return [{ _id: istKey(new Date()), orders: 2, revenue: 339600, pieces: 4 }]
    }
    if (group._id === '$status') return Object.entries(orders.reduce((m, o) => ({ ...m, [o.status]: (m[o.status] ?? 0) + 1 }), {})).map(([_id, n]) => ({ _id, n }))
    const cod = orders.filter((o) => o.status === 'delivered' && o.payment.method === 'cod' && o.payment.status === 'pending')
    return cod.length ? [{ _id: null, count: cod.length, amount: cod.reduce((s, o) => s + o.totals.total, 0) }] : []
  })
  mock.method(Order, 'find', (f) => {
    let rows = orders.filter((o) => (f.status.$in ? f.status.$in.includes(o.status) : o.status === f.status))
    const chain = { sort: () => { rows = [...rows].sort((a, b) => a.createdAt - b.createdAt); return chain }, limit: (n) => { rows = rows.slice(0, n); return chain }, lean: async () => rows }
    return chain
  })
  mock.method(Order, 'countDocuments', async (f) => orders.filter((o) => o.status === f.status && o.shippedAt <= f.shippedAt.$lte).length)
  mock.method(Product, 'find', () => ({ lean: async () => products.filter((p) => p.sizes.some((s) => s.stock <= 5)) }))
  mock.method(ContactMessage, 'countDocuments', async () => 3)
  mock.method(Subscriber, 'countDocuments', async (f) => (f.createdAt ? 2 : 40))
})
afterEach(() => mock.restoreAll())

const dash = (tok = 'owner-tok') => request(app).get('/api/admin/dashboard').set('Cookie', `isaa_admin=${tok}`)

test('the dashboard needs a signed-in admin and is never cached', async () => {
  await request(app).get('/api/admin/dashboard').expect(401)
  const res = await dash().expect(200)
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('staff can see the dashboard', async () => {
  await dash('staff-tok').expect(200)
})

test('dashboard: sales, action counts, queue, stock and inbox', async () => {
  const { data } = (await dash().expect(200)).body

  assert.equal(data.sales.today.orders, 2)
  assert.equal(data.sales.today.revenue, 339600)
  assert.equal(data.sales.series.length, 30)
  assert.equal(data.sales.series.at(-1).date, istKey(new Date()))

  assert.equal(data.actions.new.count, 2, 'placed + confirmed')
  assert.equal(data.actions.packed.count, 1)
  assert.equal(data.actions.stuck.count, 1, 'shipped 8 days ago and not delivered')
  assert.equal(data.actions.stuck.days, 7)
  assert.deepEqual(data.actions.codToCollect, { count: 1, amount: 169800 })
  assert.ok(data.actions.new.oldest, 'the age of the longest-waiting order')

  // the oldest new order comes first (30 hours old), then the other new one, then packed orders
  assert.deepEqual(data.queue.map((o) => [o.orderNumber.slice(-1), o.next]), [['1', 'pack'], ['2', 'pack'], ['3', 'ship']])
  assert.equal(data.queue[0].customer.name, 'Asha 1')
  assert.equal(data.queue[0].total, 169800)
  assert.ok(data.queue.every((o) => o.status !== 'cancelled'))

  assert.deepEqual(data.inbox, { unread: 3, subscribers: 40, newSubscribers7d: 2 })
})

test('dashboard stock list: sold-out products first, then the product whose scarcest size is lowest; only the sizes at risk are named', async () => {
  const { stock } = (await dash().expect(200)).body.data
  assert.deepEqual(stock.items.map((p) => p.slug), ['orbit', 'compass', 'racing'], 'compass has a size gone completely (0), racing\'s lowest is 1')
  assert.deepEqual([stock.out, stock.low, stock.lowAt], [1, 2, 5])
  assert.equal(stock.items[0].state, 'out')
  assert.deepEqual(stock.items[1].sizes, [{ size: 'M', stock: 3 }, { size: 'L', stock: 0 }], 'compass: M is low, L is gone, S is fine so it is left out')
  assert.match(stock.items[0].thumb, /w_360/)
})

test('a quiet shop gets a clean dashboard', async () => {
  orders = []; products = []
  const { data } = (await dash().expect(200)).body
  assert.deepEqual([data.actions.new.count, data.actions.stuck.count, data.actions.codToCollect.count], [0, 0, 0])
  assert.equal(data.actions.new.oldest, null)
  assert.deepEqual(data.queue, [])
  assert.deepEqual(data.stock.items, [])
})
