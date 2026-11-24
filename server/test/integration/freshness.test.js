import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import express from 'express'
import { startDb, stopDb, resetDb, makeAdmin, as, seedProduct, useMailbox, ORIGIN } from '../support/db.js'
import { createApp } from '../../src/app.js'
import { Reel } from '../../src/models/Reel.js'
import { setMemoryCache, memoryCache, purgeCatalog } from '../../src/middleware/cache.js'

const app = createApp()
let owner, staff, mail
before(async () => { await startDb(); mail = useMailbox(); setMemoryCache(true) })
after(async () => { setMemoryCache(false); mail.stop(); await stopDb() })
beforeEach(async () => { await resetDb(); purgeCatalog(); owner = await makeAdmin({ role: 'owner' }); staff = await makeAdmin({ role: 'staff' }) })

const list = () => request(app).get('/api/products')
const slugs = async () => (await list().expect(200)).body.data.map((p) => p.slug)
const order = (over = {}) => request(app).post('/api/orders').send({
  items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 1 }], customer: { name: 'Asha Raman', phone: '9876543210', email: 'asha@example.com' },
  address: { line1: '12 Lake View Road', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001' }, paymentMethod: 'cod', idempotencyKey: `key-${Math.random().toString(36).slice(2)}-abcdefgh`, ...over,
})

test('headers: browsers revalidate, the edge keeps it only a few seconds, errors are never cached', async () => {
  await seedProduct()
  const ok = await list().expect(200)
  assert.equal(ok.headers['cache-control'], 'public, max-age=0, s-maxage=10, must-revalidate')
  assert.ok(ok.headers.etag)
  await request(app).get('/api/products').set('If-None-Match', ok.headers.etag).expect(304)
  const miss = await request(app).get('/api/products/nope').expect(404)
  assert.equal(miss.headers['cache-control'], 'no-store')
})

test('the server copy is used until something is written', async () => {
  await seedProduct()
  assert.equal((await list().expect(200)).headers['x-cache'], 'MISS')
  assert.equal((await list().expect(200)).headers['x-cache'], 'HIT')
  assert.equal((await request(app).get('/api/products/racing').expect(200)).headers['x-cache'], 'MISS')
  await as(app, staff).post('/products/racing/stock', { size: 'S', from: 10, to: 9 }).expect(200)
  assert.equal((await list().expect(200)).headers['x-cache'], 'MISS', 'a back-office write threw the copy away')
})

test('a product you hide is gone from the shop at once, and back when you show it', async () => {
  await seedProduct()
  await seedProduct({ slug: 'orbit', name: 'Orbit' })
  assert.deepEqual((await slugs()).sort(), ['orbit', 'racing'])
  await request(app).get('/api/products/racing').expect(200)
  await as(app, staff).post('/products/racing/visibility', { isActive: false }).expect(200)
  assert.deepEqual(await slugs(), ['orbit'])
  await request(app).get('/api/products/racing').expect(404)
  await as(app, staff).post('/products/racing/visibility', { isActive: true }).expect(200)
  await request(app).get('/api/products/racing').expect(200) // the earlier 404 was not kept
  assert.equal((await slugs()).length, 2)
})

test('sold-out and price changes show immediately; a placed order takes stock off the page at once', async () => {
  await seedProduct({ sizes: [{ size: 'M', stock: 2 }] })
  const stock = async () => (await request(app).get('/api/products/racing').expect(200)).body.data
  assert.equal((await stock()).inStock, true)
  await order({ items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 2 }] }).expect(201)
  const after = await stock()
  assert.deepEqual([after.inStock, after.sizes[0].stock], [false, 0], 'nobody is shown a size that just sold out')
  await as(app, owner).post('/products/racing/stock', { size: 'M', from: 0, to: 5 }).expect(200)
  assert.equal((await stock()).sizes[0].stock, 5)
  await as(app, owner).patch('/products/racing', { price: 70000 }).expect(200)
  assert.equal((await stock()).price, 70000)
})

test('cancelling an order puts the pieces back on the page at once', async () => {
  await seedProduct({ sizes: [{ size: 'M', stock: 1 }] })
  const placed = (await order().expect(201)).body.data
  assert.equal((await request(app).get('/api/products/racing').expect(200)).body.data.inStock, false)
  await as(app, staff).post(`/orders/${placed.orderNumber}/cancel`, {}).expect(200)
  assert.equal((await request(app).get('/api/products/racing').expect(200)).body.data.inStock, true)
})

test('reels: hiding one updates the public wall at once; order look-ups and failed writes do not wipe the copy', async () => {
  const mk = (n) => Reel.create({ url: `https://www.instagram.com/reel/R${n}xyz/`, poster: { url: `https://res.cloudinary.com/demo/image/upload/v1/isaa/reels/r${n}.webp`, publicId: `isaa/reels/r${n}` }, order: n })
  const [a] = [await mk(1), await mk(2)]
  assert.equal((await request(app).get('/api/reels').expect(200)).body.data.length, 2)
  await as(app, staff).post(`/reels/${a._id}/visibility`, { isActive: false }).expect(200)
  assert.equal((await request(app).get('/api/reels').expect(200)).body.data.length, 1)
  await request(app).get('/api/reels')
  await request(app).post('/api/orders/track').send({ orderNumber: 'ISA-261122-ABCDEF', email: 'x@example.com' }).expect(404)
  await request(app).post('/api/admin/team').set('Origin', ORIGIN).send({}).expect(401)
  assert.equal((await request(app).get('/api/reels')).headers['x-cache'], 'HIT')
})

test('a read that started before a write cannot save its old answer afterwards', async () => {
  let release
  const gate = new Promise((r) => { release = r })
  const mini = express()
  let value = 'old'
  mini.get('/x', memoryCache(60), async (_req, res) => { const seen = value; await gate; res.json({ seen }) })
  const slow = request(mini).get('/x').then((r) => r.body)
  await new Promise((r) => setTimeout(r, 30))
  value = 'new'
  purgeCatalog() // a write happens while the slow read is still running
  release()
  assert.deepEqual(await slow, { seen: 'old' })
  gate.then(() => {})
  const next = await request(mini).get('/x')
  assert.equal(next.headers['x-cache'], 'MISS', 'the stale answer was not stored')
  assert.deepEqual(next.body, { seen: 'new' })
})
