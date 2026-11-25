import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { startDb, stopDb, resetDb, makeAdmin, as, seedProduct } from '../support/db.js'
import { createApp } from '../../src/app.js'
import { Product } from '../../src/models/Product.js'
import { ProductChange } from '../../src/models/ProductChange.js'
import { diffProduct } from '../../src/utils/productLog.js'

const app = createApp()
let owner, staff
before(startDb)
after(stopDb)
beforeEach(async () => { await resetDb(); owner = await makeAdmin({ role: 'owner' }); staff = await makeAdmin({ role: 'staff' }) })

const upload = (slug, id = 'ab12cd34') => ({ url: `https://res.cloudinary.com/demo/image/upload/v9/isaa/products/${slug}-${id}.webp`, publicId: `isaa/products/${slug}-${id}` })
const newTee = (over = {}) => ({ name: 'Wander Far', description: 'Oversized tee.', category: 't-shirts', price: 79900, mrp: 119900, colors: [{ name: 'Sand', hex: '#cdbfa6', hero: upload('wander-far-sand') }], sizes: [{ size: 'S', stock: 10 }, { size: 'M', stock: 10 }], images: [upload('wander-far')], ...over })
const history = async (who, slug) => (await as(app, who).get(`/products/${slug}/history`).expect(200)).body

test('a new product is logged with who added it', async () => {
  await as(app, owner).post('/products', newTee({ placements: { hero: true } })).expect(201)
  const { data, meta } = await history(owner, 'wander-far')
  assert.equal(meta.total, 1)
  assert.equal(data[0].action, 'create')
  assert.equal(data[0].by, 'Leo')
  assert.equal(data[0].note, 'Added to the store')
  const f = (field) => data[0].changes.find((c) => c.field === field)
  assert.deepEqual([f('price').from, f('price').to, f('price').kind], [null, 79900, 'money'])
  assert.deepEqual(f('sizes').to, ['S', 'M'])
  assert.equal(f('placement.hero').to, 1)
})

test('"who changed this price?": the log answers with old and new value, who and when', async () => {
  const p = await seedProduct()
  await as(app, owner).patch('/products/racing', { price: 89900 }).expect(200)
  const second = await makeAdmin({ role: 'owner', name: 'Meera' })
  await as(app, second).patch('/products/racing', { price: 79900, mrp: 129900, name: 'Racing Championship Tee' }).expect(200)
  const { data } = await history(staff, 'racing') // staff can read it too
  assert.equal(data.length, 2)
  assert.equal(data[0].by, 'Meera', 'newest first')
  const price = data[0].changes.find((c) => c.field === 'price')
  assert.deepEqual([price.from, price.to], [89900, 79900])
  assert.deepEqual(data[0].changes.map((c) => c.field).sort(), ['mrp', 'name', 'price'])
  const first = data[1].changes.find((c) => c.field === 'price')
  assert.deepEqual([first.from, first.to, data[1].by], [84900, 89900, 'Leo'])
  assert.ok(new Date(data[0].at) >= new Date(data[1].at))
  assert.equal(String(p._id), String((await ProductChange.findOne().lean()).product))
})

test('saving without changing anything writes nothing; colours, sizes, pictures and rails are described', async () => {
  await seedProduct({ heroOrder: 1 })
  await as(app, owner).patch('/products/racing', { price: 84900, name: 'Racing Championship Oversized Tee' }).expect(200)
  assert.equal(await ProductChange.countDocuments(), 0)
  await as(app, owner).patch('/products/racing', {
    // the seeded product is an older one (front shot in images[0]); the front shot becomes Olive's hero, Black gets its own
    colors: [{ name: 'Olive', hex: '#55612a', hero: { url: 'https://res.cloudinary.com/demo/image/upload/v1/isaa/products/racing.webp' } }, { name: 'Black', hex: '#1b1b1b', hero: upload('racing-black') }],
    sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 0 }, { size: 'XL', stock: 4 }], // L removed (it had 10), XL added
    images: [upload('racing', 'ee55ff66')],
    placements: { hero: false, bestsellers: true },
  }).expect(200)
  const { data } = await history(owner, 'racing')
  const by = Object.fromEntries(data[0].changes.map((c) => [c.field, c]))
  assert.deepEqual(by.colors.to, ['Olive', 'Black'])
  assert.deepEqual(by.sizes.to, ['S', 'M', 'XL'])
  assert.match(by.sizes.note, /L \(10 left\)/, 'removing a size says how much stock went with it')
  assert.equal(by.backImage.to, 'added', 'a shared picture was added')
  assert.equal(by['hero.Olive'], undefined, 'the older front shot moving into the hero is not a change')
  assert.deepEqual([by['placement.hero'].from, by['placement.hero'].to], [1, null])
  assert.deepEqual([by['placement.bestsellers'].from, by['placement.bestsellers'].to], [null, 1])
})

test('stock edits by staff are logged with the number before and after; no-ops and refused edits are not', async () => {
  await seedProduct()
  await as(app, staff).post('/products/racing/stock', { size: 'M', from: 10, to: 3 }).expect(200)
  await as(app, staff).post('/products/racing/stock', { size: 'M', from: 10, to: 7 }).expect(409) // stale: nothing logged
  await as(app, staff).post('/products/racing/stock', { size: 'M', from: 3, to: 3 }).expect(200) // same number: nothing logged
  const { data } = await history(owner, 'racing')
  assert.equal(data.length, 1)
  assert.equal(data[0].action, 'stock')
  assert.equal(data[0].by, 'Sam')
  assert.deepEqual([data[0].changes[0].label, data[0].changes[0].from, data[0].changes[0].to], ['Stock · M', 10, 3])
})

test('hiding and showing are logged once per real change', async () => {
  await seedProduct()
  await as(app, staff).post('/products/racing/visibility', { isActive: false }).expect(200)
  await as(app, staff).post('/products/racing/visibility', { isActive: false }).expect(200) // already hidden
  await as(app, owner).post('/products/racing/visibility', { isActive: true }).expect(200)
  const { data } = await history(owner, 'racing')
  assert.deepEqual(data.map((d) => [d.action, d.changes[0].to, d.by]), [['visibility', true, 'Leo'], ['visibility', false, 'Sam']])
  assert.equal((await Product.findOne({ slug: 'racing' }).lean()).isActive, true)
})

test('home-page order changes are logged for the products that moved, not the ones that stayed', async () => {
  await seedProduct({ slug: 'a', name: 'A', featuredOrder: 1 })
  await seedProduct({ slug: 'b', name: 'B', featuredOrder: 2 })
  await seedProduct({ slug: 'c', name: 'C' })
  await as(app, owner).post('/placements/featured', { slugs: ['a', 'c'] }).expect(200) // a stays 1, c joins at 2, b leaves
  assert.equal((await history(owner, 'a')).meta.total, 0)
  const c = (await history(owner, 'c')).data[0]
  assert.deepEqual([c.action, c.changes[0].from, c.changes[0].to], ['placement', null, 2])
  const b = (await history(owner, 'b')).data[0]
  assert.deepEqual([b.changes[0].from, b.changes[0].to], [2, null])
  await as(app, owner).post('/placements/featured', { slugs: ['c', 'a'] }).expect(200) // swap
  assert.deepEqual((await history(owner, 'a')).data[0].changes[0], { field: 'placement.featured', label: 'Featured drop', kind: 'position', from: 1, to: 2 })
})

test('deleting leaves a log row behind; a new product that reuses the address does not inherit the old history', async () => {
  await seedProduct()
  await as(app, owner).patch('/products/racing', { price: 90000 }).expect(200)
  await as(app, owner).del('/products/racing').expect(200)
  const gone = await ProductChange.find({ slug: 'racing' }).sort({ at: -1, _id: -1 }).lean()
  assert.equal(gone[0].action, 'delete')
  assert.match(gone[0].note, /Deleted “Racing Championship Oversized Tee” \(₹900\)/)
  await as(app, owner).get('/products/racing/history').expect(404)
  await seedProduct()
  assert.equal((await history(owner, 'racing')).meta.total, 0)
})

test('history is paged, needs a sign-in, and unknown products are 404', async () => {
  await seedProduct()
  for (const to of [9, 8, 7, 6, 5]) await as(app, staff).post('/products/racing/stock', { size: 'S', from: to === 9 ? 10 : to + 1, to }).expect(200)
  const page1 = (await as(app, owner).get('/products/racing/history?limit=2&page=1').expect(200)).body
  const page3 = (await as(app, owner).get('/products/racing/history?limit=2&page=3').expect(200)).body
  assert.deepEqual([page1.data.length, page1.meta.total, page1.meta.pages, page3.data.length], [2, 5, 3, 1])
  assert.equal(page1.data[0].changes[0].to, 5)
  await request(app).get('/api/admin/products/racing/history').expect(401)
  await as(app, owner).get('/products/nope/history').expect(404)
  await as(app, owner).get('/products/racing/history?limit=500').expect(400)
})

test('a failing log write never turns a successful change into an error', async () => {
  await seedProduct()
  const real = ProductChange.create
  ProductChange.create = async () => { throw new Error('disk full') }
  try {
    const res = await as(app, staff).post('/products/racing/stock', { size: 'S', from: 10, to: 4 }).expect(200)
    assert.equal(res.body.data.sizes.find((s) => s.size === 'S').stock, 4)
  } finally { ProductChange.create = real }
})

test('diffProduct ignores stock numbers and shade-only edits read as an event', () => {
  const base = { name: 'A', category: 't-shirts', price: 1, mrp: 2, description: '', colors: [{ name: 'Olive', hex: '#55612a' }], sizes: [{ size: 'M', stock: 3 }], images: [{ url: 'u1' }], isLimited: false, isActive: true }
  assert.deepEqual(diffProduct(base, { ...base, sizes: [{ size: 'M', stock: 0 }] }), [])
  assert.deepEqual(diffProduct(base, { ...base, colors: [{ name: 'Olive', hex: '#000000' }] }).map((c) => c.field), ['colorHex'])
  assert.deepEqual(diffProduct(base, { ...base, isActive: false }).map((c) => [c.field, c.from, c.to]), [['isActive', true, false]])
  assert.equal(diffProduct(base, { ...base, description: 'x'.repeat(500) })[0].to.length, 140, 'long text is clipped')
})

test('diffProduct describes hero pictures colour by colour; moving an older product onto heroes is not a change', () => {
  const colors = [{ name: 'Olive', hex: '#55612a', hero: { url: 'h-olive' } }, { name: 'Black', hex: '#1b1b1b', hero: { url: 'h-black' } }]
  const base = { name: 'A', category: 't-shirts', price: 1, mrp: 2, description: '', colors, sizes: [{ size: 'M', stock: 3 }], images: [{ url: 'back' }], isLimited: false, isActive: true }
  const swapped = { ...base, colors: [colors[0], { ...colors[1], hero: { url: 'h-black-2' } }] }
  assert.deepEqual(diffProduct(base, swapped).map((c) => [c.field, c.label, c.to]), [['hero.Black', 'Hero picture · Black', 'replaced']])
  const older = { ...base, colors: [{ name: 'Olive', hex: '#55612a' }], images: [{ url: 'front' }, { url: 'back' }] }
  const moved = { ...base, colors: [{ name: 'Olive', hex: '#55612a', hero: { url: 'front' } }], images: [{ url: 'back' }] }
  assert.deepEqual(diffProduct(older, moved), [])
  assert.deepEqual(diffProduct(base, { ...base, images: [] }).map((c) => [c.field, c.to]), [['backImage', 'removed'], ['imageCount', 0]])
})
