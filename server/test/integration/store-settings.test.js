import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { startDb, stopDb, resetDb, makeAdmin, as, seedProduct } from '../support/db.js'
import { createApp } from '../../src/app.js'
import { store, storeDefaults, paymentFee, applyStoreSettings } from '../../src/config/store.js'

const app = createApp()
let owner, staff
before(startDb)
after(stopDb)
beforeEach(async () => { await resetDb(); applyStoreSettings(null); owner = await makeAdmin({ role: 'owner' }); staff = await makeAdmin({ role: 'staff' }) })

const rules = (over = {}) => ({ freeShippingMin: 1499, shippingFee: 60, codFee: 50, codFreeMin: 1999, ...over })
const config = async () => (await request(app).get('/api/store-config').expect(200)).body.data
const order = (over = {}) => ({
  idempotencyKey: `key-${Math.random().toString(36).slice(2)}-abcdefgh`,
  items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 1 }],
  customer: { name: 'Asha Raman', phone: '9876543210', email: 'asha@example.com' },
  address: { line1: '12 Lake View Road', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001' },
  paymentMethod: 'cod', ...over,
})

test('only the owner can read or change the settings', async () => {
  await as(app, staff).get('/settings').expect(403)
  await as(app, staff).put('/settings', rules()).expect(403)
  await as(app, staff).del('/settings').expect(403)
  const got = (await as(app, owner).get('/settings').expect(200)).body.data
  assert.equal(got.customised, false)
  assert.equal(got.codFreeMin, storeDefaults.codFreeMin / 100)
})

test('saving takes effect straight away on the storefront, in paise', async () => {
  const saved = (await as(app, owner).put('/settings', rules()).expect(200)).body.data
  assert.deepEqual([saved.codFee, saved.codFreeMin, saved.customised, saved.updatedBy], [50, 1999, true, 'Leo'])
  const c = await config()
  assert.deepEqual([c.freeShippingMin, c.shippingFee, c.codFee, c.codFreeMin], [149900, 6000, 5000, 199900])
})

test('bad numbers are refused', async () => {
  const api = as(app, owner)
  for (const bad of [{ codFee: -1 }, { codFree: 5 }, { codFreeMin: 1.5 }, { codFee: '50' }, { shippingFee: 99999 }]) await api.put('/settings', rules(bad)).expect(400)
  await api.put('/settings', { codFee: 10 }).expect(400) // all four are needed
})

test('COD fee is waived at or above the threshold, charged below it, and never charged for online', async () => {
  await as(app, owner).put('/settings', rules({ codFee: 50, codFreeMin: 1000 })).expect(200)
  assert.equal(paymentFee('cod', 99999), 5000)
  assert.equal(paymentFee('cod', 100000), 0)
  assert.equal(paymentFee('cod', 150000), 0)
  assert.equal(paymentFee('online', 1), 0)
  await as(app, owner).put('/settings', rules({ codFee: 50, codFreeMin: 0 })).expect(200)
  assert.equal(paymentFee('cod', 9_999_999), 5000, '0 means the fee is never waived')
})

test('checkout charges the saved COD fee below the threshold and waives it above', async () => {
  await seedProduct({ price: 84900 }) // ₹849
  await as(app, owner).put('/settings', rules({ shippingFee: 0, codFee: 50, codFreeMin: 1000 })).expect(200)
  const low = (await request(app).post('/api/orders').send(order()).expect(201)).body.data
  assert.equal(low.totals.codFee, 5000)
  assert.equal(low.totals.total, 84900 + 5000)
  const high = (await request(app).post('/api/orders').send(order({ items: [{ slug: 'racing', size: 'M', color: 'Olive', qty: 2 }] })).expect(201)).body.data
  assert.equal(high.totals.subtotal, 169800)
  assert.equal(high.totals.codFee, 0)
  assert.equal(high.totals.total, 169800)
})

test('reset goes back to the .env defaults', async () => {
  await as(app, owner).put('/settings', rules()).expect(200)
  const back = (await as(app, owner).del('/settings').expect(200)).body.data
  assert.equal(back.customised, false)
  assert.equal(back.codFee, storeDefaults.codFee / 100)
  assert.equal(store.codFee, storeDefaults.codFee)
  assert.equal((await config()).codFreeMin, storeDefaults.codFreeMin)
})
