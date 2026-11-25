// Order flow without a database: Product / Order are replaced by an in-memory fake that behaves like
// the real atomic updates (stock can't go below zero, duplicate idempotency keys are unique).
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { Product } from '../src/models/Product.js'
import { Order } from '../src/models/Order.js'
import { createApp } from '../src/app.js'
import { store, shippingFor } from '../src/config/store.js'
import { customerMail, ownerMail } from '../src/utils/orderEmails.js'

const app = createApp()
const IMG = 'https://res.cloudinary.com/demo/image/upload/v1/isaa/products/racing.webp'

let products, orders, raceFail
const fresh = () => {
  products = [
    { _id: 'p1', slug: 'racing', name: 'Racing Championship Oversized Tee', price: 84900, mrp: 124900, isActive: true, colors: [{ name: 'Olive', hex: '#5a6330' }], sizes: [{ size: 'M', stock: 3 }, { size: 'L', stock: 0 }], images: [{ url: IMG, alt: '' }] },
    { _id: 'p2', slug: 'orbit-club', name: 'Orbit Club Oversized Tee', price: 79900, mrp: 119900, isActive: true, colors: [{ name: 'Off White', hex: '#efece6' }], sizes: [{ size: 'M', stock: 1 }], images: [{ url: IMG, alt: '' }] },
  ]
  orders = []
  raceFail = null
}
const stockOf = (slug, size) => products.find((p) => p.slug === slug).sizes.find((s) => s.size === size).stock
const snapshot = () => JSON.parse(JSON.stringify(products))

beforeEach(() => {
  fresh()
  mock.method(Product, 'find', (f) => ({ lean: async () => snapshot().filter((p) => f.isActive === p.isActive && f.slug.$in.includes(p.slug)) }))
  mock.method(Product, 'findOne', (f) => ({ lean: async () => snapshot().find((p) => p._id === f._id) ?? null }))
  mock.method(Product, 'updateOne', async (f, u) => {
    const p = products.find((x) => x._id === f._id)
    if (f.sizes?.$elemMatch) { // reserve
      const { size, stock } = f.sizes.$elemMatch
      const entry = p.sizes.find((s) => s.size === size)
      if (raceFail === p._id || entry.stock < stock.$gte) return { modifiedCount: 0 }
      entry.stock += u.$inc['sizes.$.stock']
      return { modifiedCount: 1 }
    }
    p.sizes.find((s) => s.size === f['sizes.size']).stock += u.$inc['sizes.$.stock'] // release
    return { modifiedCount: 1 }
  })
  mock.method(Order, 'findOne', (f) => ({
    lean: async () => orders.find((o) => (f.idempotencyKey ? o.idempotencyKey === f.idempotencyKey : o.orderNumber === f.orderNumber && o.customer.email === f['customer.email'])) ?? null,
  }))
  mock.method(Order, 'create', async (doc) => { const o = { ...doc, _id: `o${orders.length + 1}`, createdAt: new Date() }; orders.push(o); return o })
  mock.method(Order, 'updateOne', async () => ({}))
})
afterEach(() => mock.restoreAll())

let n = 0
const body = (over = {}) => ({
  items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 2 }],
  customer: { name: 'Asha Raman', phone: '+91 98765 43210', email: 'Asha@Example.com' },
  address: { line1: '12 Lake View Road', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001' },
  paymentMethod: 'cod',
  idempotencyKey: `test-key-${++n}-abcdefgh`,
  ...over,
})
const place = (over) => request(app).post('/api/orders').send(body(over))

test('store-config exposes the checkout rules and gates online payment', async () => {
  const res = await request(app).get('/api/store-config').expect(200)
  assert.equal(res.body.data.freeShippingMin, store.freeShippingMin)
  assert.equal(res.body.data.payments.cod.enabled, true)
  assert.equal(res.body.data.payments.online.enabled, false)
  assert.ok(res.body.data.states.includes('Tamil Nadu'))
})

test('invalid orders are rejected with field-level messages', async () => {
  const res = await place({ customer: { name: 'A', phone: '12345', email: 'nope' }, address: { line1: 'x', city: '', state: 'Narnia', pincode: '12' } }).expect(400)
  const paths = res.body.error.details.map((d) => d.path)
  for (const p of ['customer.name', 'customer.phone', 'customer.email', 'address.line1', 'address.city', 'address.state', 'address.pincode']) assert.ok(paths.includes(p), p)
})

test('empty bag and silly quantities are rejected', async () => {
  await place({ items: [] }).expect(400)
  await place({ items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 99 }] }).expect(400)
})

test('online payment is not available yet', async () => {
  const res = await place({ paymentMethod: 'online' }).expect(400)
  assert.match(res.body.error.message, /isn’t available yet/)
  assert.equal(stockOf('racing', 'M'), 3)
})

test('honeypot submissions are refused and take no stock', async () => {
  await place({ website: 'http://spam' }).expect(400)
  assert.equal(stockOf('racing', 'M'), 3)
})

test('happy path: price from the database, totals computed on the server, stock reduced, phone normalised', async () => {
  const res = await place().expect(201)
  const o = res.body.data
  assert.match(o.orderNumber, /^ISA-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/)
  assert.equal(o.totals.subtotal, 2 * 84900)
  assert.equal(o.totals.shipping, 0) // 169800 is above the free-shipping minimum
  assert.equal(o.totals.total, 169800 + store.codFee)
  assert.equal(o.payment.method, 'cod')
  assert.equal(o.status, 'placed')
  assert.equal(o.customer.phone, '9876543210')
  assert.equal(o.customer.email, 'asha@example.com')
  assert.equal(o.items[0].color, 'Olive')
  assert.equal(o.items[0].image, 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good/v1/isaa/products/racing.webp')
  assert.equal(stockOf('racing', 'M'), 1)
  assert.equal('ip' in o, false)
})

test('shipping fee applies below the free-shipping minimum', async () => {
  const o = (await place({ items: [{ slug: 'orbit-club', size: 'M', color: 'Off White', qty: 1 }] }).expect(201)).body.data
  assert.equal(o.totals.shipping, shippingFor(79900))
  assert.equal(o.totals.total, 79900 + shippingFor(79900) + store.codFee)
})

test('the same line twice is merged into one', async () => {
  const o = (await place({ items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 1 }, { slug: 'racing', size: 'M', color: 'olive', qty: 1 }] }).expect(201)).body.data
  assert.equal(o.items.length, 1)
  assert.equal(o.items[0].qty, 2)
  assert.equal(stockOf('racing', 'M'), 1)
})

test('a double-clicked submit (same key) returns the same order and takes stock once', async () => {
  const b = body()
  const first = await request(app).post('/api/orders').send(b).expect(201)
  const again = await request(app).post('/api/orders').send(b).expect(200)
  assert.equal(again.body.data.orderNumber, first.body.data.orderNumber)
  assert.equal(orders.length, 1)
  assert.equal(stockOf('racing', 'M'), 1)
})

test('sold-out and over-stock lines return 409 with what is available; nothing is taken', async () => {
  const res = await place({ items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 1 }, { slug: 'racing', size: 'L', color: 'Olive', qty: 1 }, { slug: 'orbit-club', size: 'M', color: 'Off White', qty: 4 }] }).expect(409)
  const d = res.body.error.details
  assert.deepEqual(d.map((x) => [x.slug, x.size, x.reason, x.available]).sort(), [['orbit-club', 'M', 'out_of_stock', 1], ['racing', 'L', 'out_of_stock', 0]])
  assert.equal(stockOf('racing', 'M'), 3)
  assert.equal(orders.length, 0)
})

test('unknown products and sizes are "unavailable"', async () => {
  const res = await place({ items: [{ slug: 'ghost-tee', size: 'M', color: '', qty: 1 }, { slug: 'racing', size: 'XXL', color: 'Olive', qty: 1 }] }).expect(409)
  assert.deepEqual(res.body.error.details.map((x) => x.reason), ['unavailable', 'unavailable'])
})

test('if someone buys the last piece mid-checkout, earlier reservations are put back', async () => {
  raceFail = 'p2' // passes the read check, loses the atomic reserve
  const res = await place({ items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 2 }, { slug: 'orbit-club', size: 'M', color: 'Off White', qty: 1 }] }).expect(409)
  assert.equal(res.body.error.details[0].slug, 'orbit-club')
  assert.equal(stockOf('racing', 'M'), 3) // restored
  assert.equal(orders.length, 0)
})

test('if saving the order fails, stock is put back', async () => {
  Order.create.mock.mockImplementation(async () => { throw new Error('db exploded') })
  await place().expect(500)
  assert.equal(stockOf('racing', 'M'), 3)
})

test('tracking needs the order number AND the email; failures look identical', async () => {
  const o = (await place().expect(201)).body.data
  const wrongEmail = await request(app).post('/api/orders/track').send({ orderNumber: o.orderNumber, email: 'someone@else.com' }).expect(404)
  const wrongNumber = await request(app).post('/api/orders/track').send({ orderNumber: 'ISA-ZZZZZZZZ', email: 'asha@example.com' }).expect(404)
  assert.equal(wrongEmail.body.error.message, wrongNumber.body.error.message)
  const ok = await request(app).post('/api/orders/track').send({ orderNumber: ` ${o.orderNumber.toLowerCase().replace('-', ' - ')} `.replace(/ - /, '-'), email: 'ASHA@example.com' }).expect(200)
  assert.equal(ok.body.data.orderNumber, o.orderNumber)
  assert.equal(ok.body.data.customer.phone, '••••••3210') // masked when tracking
  for (const typed of [o.orderNumber.replace('-', ' ').toLowerCase(), o.orderNumber.replace('-', '')]) {
    await request(app).post('/api/orders/track').send({ orderNumber: typed, email: 'asha@example.com' }).expect(200)
  }
  await request(app).post('/api/orders/track').send({ orderNumber: 'nonsense', email: 'asha@example.com' }).expect(400)
})

test('emails escape customer-supplied text', () => {
  const o = { orderNumber: 'ISA-ABCDEFGH', customer: { name: '<script>alert(1)</script> Asha', email: 'a@b.co', phone: '9876543210' }, address: { line1: '<img src=x onerror=1>', city: 'C', state: 'Tamil Nadu', pincode: '641001' }, items: [{ name: 'Tee <b>', color: 'Olive', size: 'M', qty: 1, price: 100, mrp: 200 }], totals: { subtotal: 100, shipping: 0, codFee: 0, total: 100 }, payment: { method: 'cod' } }
  const { html, subject } = customerMail(o)
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x'))
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(subject.includes('ISA-ABCDEFGH'))
  assert.ok(ownerMail(o).subject.includes('COD'))
})
