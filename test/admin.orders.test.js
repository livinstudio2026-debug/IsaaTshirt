// Back-office orders without a database: Order / Product / Admin / AdminSession are in-memory fakes.
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { Admin } from '../src/models/Admin.js'
import { AdminSession } from '../src/models/AdminSession.js'
import { Order } from '../src/models/Order.js'
import { Product } from '../src/models/Product.js'
import { createApp } from '../src/app.js'
import { hashToken, requireRole } from '../src/middleware/adminAuth.js'
import { newOrderNumber, normaliseOrderNumber, dateStamp } from '../src/utils/orderNumber.js'
import { shippedMail } from '../src/utils/orderEmails.js'

const app = createApp()
const ORIGIN = 'http://localhost:5173'
const get = (v, path) => path.split('.').reduce((o, k) => o?.[k], v)
const matches = (doc, f) => Object.entries(f).every(([k, cond]) => {
  if (k === '$or') return cond.some((c) => matches(doc, c))
  const v = get(doc, k)
  if (cond instanceof RegExp) return cond.test(v ?? '')
  if (cond && typeof cond === 'object') {
    if ('$in' in cond) return cond.$in.includes(v)
    if ('$ne' in cond) return v !== cond.$ne
  }
  return v === cond
})

let orders, products, sessions, admins, released
const mkOrder = (n, over = {}) => ({
  _id: `o${n}`, orderNumber: `ISA-241121-ABCD0${n}`, status: 'placed', createdAt: new Date(2026, 10, 21, 10, n),
  statusHistory: [{ status: 'placed', at: new Date() }], history: [], stockReleased: false,
  items: [{ product: 'p1', slug: 'racing', name: 'Racing Oversized Tee', image: '', color: 'Olive', size: 'M', qty: 2, price: 84900, mrp: 124900 }],
  customer: { name: `Asha ${n}`, phone: '9876543210', email: `asha${n}@example.com` },
  address: { line1: '12 Lake View Road', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001' },
  totals: { subtotal: 169800, shipping: 0, codFee: 0, total: 169800 }, payment: { method: 'cod', status: 'pending' }, emails: {}, ...over,
})

beforeEach(() => {
  orders = [mkOrder(1), mkOrder(2, { status: 'packed' }), mkOrder(3, { status: 'shipped', tracking: { carrier: 'DTDC', number: 'D1', url: 'https://t.example/D1' } })]
  products = [{ _id: 'p1', sizes: [{ size: 'M', stock: 0 }] }]
  admins = [{ _id: 'a1', email: 'leo@isaa.in', name: 'Leo', role: 'owner', isActive: true }, { _id: 'a2', email: 'sam@isaa.in', name: 'Sam', role: 'staff', isActive: true }]
  sessions = [{ tokenHash: hashToken('owner-tok'), admin: 'a1', expiresAt: new Date(Date.now() + 1e6) }, { tokenHash: hashToken('staff-tok'), admin: 'a2', expiresAt: new Date(Date.now() + 1e6) }]
  released = 0
  mock.method(AdminSession, 'findOne', (f) => ({ lean: async () => sessions.find((s) => s.tokenHash === f.tokenHash) ?? null }))
  mock.method(Admin, 'findById', (id) => ({ lean: async () => admins.find((a) => a._id === id) ?? null }))
  mock.method(Order, 'find', (f) => {
    let rows = orders.filter((o) => matches(o, f))
    const chain = { sort: () => { rows = [...rows].sort((a, b) => b.createdAt - a.createdAt); return chain }, skip: (n) => { rows = rows.slice(n); return chain }, limit: (n) => { rows = rows.slice(0, n); return chain }, lean: async () => rows }
    return chain
  })
  mock.method(Order, 'countDocuments', async (f) => orders.filter((o) => matches(o, f)).length)
  mock.method(Order, 'aggregate', async () => Object.entries(orders.reduce((m, o) => ({ ...m, [o.status]: (m[o.status] ?? 0) + 1 }), {})).map(([_id, n]) => ({ _id, n })))
  mock.method(Order, 'findOne', (f) => ({ lean: async () => orders.find((o) => matches(o, f)) ?? null }))
  mock.method(Order, 'findOneAndUpdate', (f, u) => ({
    lean: async () => {
      const o = orders.find((x) => matches(x, f))
      if (!o) return null
      for (const [k, v] of Object.entries(u.$set ?? {})) { const parts = k.split('.'); const last = parts.pop(); parts.reduce((t, p) => (t[p] ??= {}), o)[last] = v }
      for (const [k, v] of Object.entries(u.$push ?? {})) o[k] = [...(o[k] ?? []), v]
      return JSON.parse(JSON.stringify(o), (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) ? new Date(v) : v))
    },
  }))
  mock.method(Order, 'updateOne', async (f, u) => { const o = orders.find((x) => x._id === f._id); if (o) Object.assign(o, u); return {} })
  mock.method(Product, 'updateOne', async (f, u) => { products.find((p) => p._id === f._id).sizes.find((s) => s.size === f['sizes.size']).stock += u.$inc['sizes.$.stock']; released++; return {} })
})
afterEach(() => mock.restoreAll())

const as = (tok = 'owner-tok') => ({
  get: (p) => request(app).get(`/api/admin${p}`).set('Cookie', `isaa_admin=${tok}`),
  post: (p, body = {}) => request(app).post(`/api/admin${p}`).set('Cookie', `isaa_admin=${tok}`).set('Origin', ORIGIN).send(body),
})
const N = (n) => `ISA-241121-ABCD0${n}`

test('every orders endpoint needs a signed-in admin', async () => {
  await request(app).get('/api/admin/orders').expect(401)
  await request(app).get(`/api/admin/orders/${N(1)}`).expect(401)
  await request(app).post(`/api/admin/orders/${N(1)}/cancel`).set('Origin', ORIGIN).send({}).expect(401)
})

test('list: tabs, counts, search and paging', async () => {
  const all = await as().get('/orders').expect(200)
  assert.equal(all.body.data.length, 3)
  assert.deepEqual(all.body.counts, { new: 1, packed: 1, shipped: 1, delivered: 0, cancelled: 0, all: 3 })
  assert.equal(all.body.meta.total, 3)
  assert.equal((await as().get('/orders?status=new').expect(200)).body.data[0].orderNumber, N(1))
  assert.equal((await as().get('/orders?q=asha%202').expect(200)).body.data.length, 1, 'by name')
  assert.equal((await as().get('/orders?q=ABCD03').expect(200)).body.data[0].orderNumber, N(3), 'by order number')
  assert.equal((await as().get('/orders?q=98765').expect(200)).body.data.length, 3, 'by phone digits')
  assert.equal((await as().get('/orders?q=asha1@example').expect(200)).body.data.length, 1, 'by email')
  assert.equal((await as().get('/orders?q=(.*').expect(200)).body.data.length, 0, 'regex characters are literal')
  const page = await as().get('/orders?limit=2&page=2').expect(200)
  assert.deepEqual([page.body.data.length, page.body.meta.pages], [1, 2])
  await as().get('/orders?status=bogus').expect(400)
})

test('one order: full details, full phone, audit trail; not-found is 404', async () => {
  const res = await as().get(`/orders/${N(1).toLowerCase()}`).expect(200)
  assert.equal(res.body.data.customer.phone, '9876543210')
  assert.ok(Array.isArray(res.body.data.history))
  assert.ok(!('ip' in res.body.data) && !('userAgent' in res.body.data))
  await as().get('/orders/ISA-241121-ZZZZZZ').expect(404)
  await as().get('/orders/nonsense').expect(400)
})

test('status moves one step at a time: no skips, no going back', async () => {
  await as().post(`/orders/${N(1)}/status`, { status: 'shipped', tracking: { carrier: 'DTDC', number: 'X', url: 'https://t.example/X' } }).expect(409) // placed -> shipped
  await as().post(`/orders/${N(1)}/status`, { status: 'delivered' }).expect(409)
  const packed = await as().post(`/orders/${N(1)}/status`, { status: 'packed' }).expect(200) // placed -> packed is allowed (confirmed is optional)
  assert.equal(packed.body.data.status, 'packed')
  await as().post(`/orders/${N(1)}/status`, { status: 'confirmed' }).expect(409) // backwards
  await as().post(`/orders/${N(1)}/status`, { status: 'placed' }).expect(400)
  await as().post(`/orders/${N(3)}/status`, { status: 'delivered' }).expect(200)
  await as().post(`/orders/${N(3)}/status`, { status: 'delivered' }).expect(409) // already delivered
})

test('shipping needs courier, number and a real link; it logs who did it and emails the customer', async () => {
  const bad = await as().post(`/orders/${N(2)}/status`, { status: 'shipped' }).expect(400)
  assert.ok(bad.body.error.details.some((d) => d.path === 'tracking.carrier'))
  const badLink = await as().post(`/orders/${N(2)}/status`, { status: 'shipped', tracking: { carrier: 'DTDC', number: 'D9', url: 'javascript:alert(1)' } }).expect(400)
  assert.ok(badLink.body.error.details.some((d) => d.path === 'tracking.url'))
  const ok = await as('staff-tok').post(`/orders/${N(2)}/status`, { status: 'shipped', tracking: { carrier: ' DTDC ', number: 'D9', url: 'https://t.example/D9' }, note: 'Left with courier at 5pm' }).expect(200)
  assert.equal(ok.body.data.status, 'shipped')
  assert.deepEqual(ok.body.data.tracking, { carrier: 'DTDC', number: 'D9', url: 'https://t.example/D9' })
  assert.equal(ok.body.data.history[0].by, 'Sam')
  assert.equal(ok.body.data.history[0].action, 'ship')
  assert.match(ok.body.data.history[0].note, /DTDC · D9 — Left with courier/)
  assert.ok(ok.body.data.shippedAt)
  const mail = shippedMail(orders[1])
  assert.ok(mail.subject.includes('has shipped') && mail.text.includes('D9') && mail.html.includes('https://t.example/D9'))
})

test('cancelling puts the stock back, works for staff too, and only before shipping', async () => {
  const res = await as('staff-tok').post(`/orders/${N(1)}/cancel`, { reason: 'Customer asked' }).expect(200)
  assert.equal(res.body.data.status, 'cancelled')
  assert.equal(res.body.data.stockReleased, true)
  assert.equal(res.body.data.cancelReason, 'Customer asked')
  assert.equal(products[0].sizes[0].stock, 2, 'two pieces back on the shelf')
  await as().post(`/orders/${N(1)}/cancel`).expect(409) // second cancel never restocks twice
  assert.equal(products[0].sizes[0].stock, 2)
  await as().post(`/orders/${N(3)}/cancel`).expect(409) // shipped
  assert.equal(released, 1)
})

test('a cancelled order can’t be moved on', async () => {
  await as().post(`/orders/${N(1)}/cancel`).expect(200)
  const res = await as().post(`/orders/${N(1)}/status`, { status: 'packed' }).expect(409)
  assert.match(res.body.error.message, /cancelled/)
})

test('mark paid: COD only, once shipped, once', async () => {
  await as().post(`/orders/${N(1)}/mark-paid`).expect(409) // not shipped yet
  const ok = await as().post(`/orders/${N(3)}/mark-paid`).expect(200)
  assert.equal(ok.body.data.payment.status, 'paid')
  assert.ok(ok.body.data.payment.paidAt)
  assert.equal(ok.body.data.history[0].action, 'paid')
  await as().post(`/orders/${N(3)}/mark-paid`).expect(409)
  orders[1].payment.method = 'online'
  orders[1].status = 'shipped'
  await as().post(`/orders/${N(2)}/mark-paid`).expect(409)
})

test('writes must be JSON from an allowed origin', async () => {
  await request(app).post(`/api/admin/orders/${N(1)}/cancel`).set('Cookie', 'isaa_admin=owner-tok').set('Origin', 'https://evil.example').send({}).expect(403)
  await request(app).post(`/api/admin/orders/${N(1)}/cancel`).set('Cookie', 'isaa_admin=owner-tok').set('Origin', ORIGIN).type('form').send('a=1').expect(415)
})

test('customers never see the audit trail, and tracking shows carrier and link', async () => {
  await as().post(`/orders/${N(1)}/note`, { note: 'Packed with a free sticker' }).expect(200)
  orders[2].customer.email = 'asha3@example.com'
  const res = await request(app).post('/api/orders/track').send({ orderNumber: N(3), email: 'asha3@example.com' }).expect(200)
  assert.deepEqual(res.body.data.tracking, { carrier: 'DTDC', number: 'D1', url: 'https://t.example/D1' })
  assert.ok(!('history' in res.body.data))
})

test('requireRole lets the right roles through', () => {
  const run = (role, ...roles) => { let err; requireRole(...roles)({ admin: { role } }, {}, (e) => { err = e }); return err }
  assert.equal(run('owner', 'owner'), undefined)
  assert.equal(run('staff', 'owner', 'staff'), undefined)
  assert.equal(run('staff', 'owner').status, 403)
})

test('order numbers: date + 6 characters, unique, forgiving to type, old format still works', () => {
  const when = new Date('2026-11-21T20:00:00Z') // 01:30 on the 22nd in India
  assert.equal(dateStamp(when), '261122')
  assert.match(newOrderNumber(when), /^ISA-261122-[0-9A-HJKMNP-TV-Z]{6}$/)
  assert.equal(new Set(Array.from({ length: 5000 }, () => newOrderNumber())).size, 5000)
  for (const typed of ['ISA-241121-7K3M9Q', 'isa 241121 7k3m9q', 'ISA2411217K3M9Q', ' isa-241121-7k3m9q ']) assert.equal(normaliseOrderNumber(typed), 'ISA-241121-7K3M9Q')
  assert.equal(normaliseOrderNumber('isa-24l121-7kom9q'), 'ISA-241121-7K0M9Q', 'O and I/L are read as 0 and 1')
  assert.equal(normaliseOrderNumber('isa 7k3m9qx2'), 'ISA-7K3M9QX2', 'orders placed before the date was added')
  for (const bad of ['', 'nonsense', 'ISA-1234', 'ISA-241121-7K3M9QX2']) assert.equal(normaliseOrderNumber(bad), null)
})
