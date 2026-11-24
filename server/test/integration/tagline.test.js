import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { startDb, stopDb, resetDb, makeAdmin, as, seedProduct } from '../support/db.js'
import { createApp } from '../../src/app.js'
import { Product } from '../../src/models/Product.js'

const app = createApp()
let owner, staff
before(startDb)
after(stopDb)
beforeEach(async () => { await resetDb(); owner = await makeAdmin({ role: 'owner' }); staff = await makeAdmin({ role: 'staff' }) })

const hero = (slug) => ({ url: `https://res.cloudinary.com/demo/image/upload/v9/isaa/products/${slug}-hero.webp`, publicId: `isaa/products/${slug}-hero` })
const newTee = (over = {}) => ({ name: 'Wander Far Fit Tee', category: 't-shirts', price: 79900, mrp: 119900, colors: [{ name: 'Sand', hex: '#cdbfa6', hero: hero('wander-far-fit-tee') }], sizes: [{ size: 'M', stock: 5 }], ...over })
const pub = async (slug) => (await request(app).get(`/api/products/${slug}`).expect(200)).body.data

test('a product can carry its own tagline, and it is public', async () => {
  const created = (await as(app, owner).post('/products', newTee({ tagline: '  Cut close, worn easy  ' })).expect(201)).body.data
  assert.equal(created.tagline, 'Cut close, worn easy', 'trimmed')
  assert.equal((await pub('wander-far-fit-tee')).tagline, 'Cut close, worn easy')
})

test('no tagline is an empty string, so the storefront can fall back to its category default', async () => {
  await as(app, owner).post('/products', newTee()).expect(201)
  assert.equal((await pub('wander-far-fit-tee')).tagline, '')
  await seedProduct({ slug: 'old-one', name: 'Old One' }) // a product saved before taglines existed
  await Product.collection.updateOne({ slug: 'old-one' }, { $unset: { tagline: '' } })
  assert.equal((await pub('old-one')).tagline, '', 'older products without the field read as empty too')
  const list = (await request(app).get('/api/products').expect(200)).body.data
  assert.ok(list.every((p) => p.tagline === ''))
})

test('edit, change and clear it; each change is in the change log; staff cannot edit products', async () => {
  const slug = (await as(app, owner).post('/products', newTee()).expect(201)).body.data.slug
  assert.equal((await as(app, owner).patch(`/products/${slug}`, { tagline: 'Pick your fit' }).expect(200)).body.data.tagline, 'Pick your fit')
  assert.equal((await as(app, owner).patch(`/products/${slug}`, { tagline: 'Soft, sharp, yours' }).expect(200)).body.data.tagline, 'Soft, sharp, yours')
  assert.equal((await as(app, owner).patch(`/products/${slug}`, { tagline: '   ' }).expect(200)).body.data.tagline, '', 'blank clears it')
  assert.equal((await pub(slug)).tagline, '')
  const log = (await as(app, staff).get(`/products/${slug}/history`).expect(200)).body.data
  const changes = log.filter((e) => e.action === 'update').flatMap((e) => e.changes).filter((c) => c.field === 'tagline').map((c) => [c.from, c.to])
  assert.deepEqual(changes, [['Soft, sharp, yours', ''], ['Pick your fit', 'Soft, sharp, yours'], ['', 'Pick your fit']], 'newest first')
  await as(app, staff).patch(`/products/${slug}`, { tagline: 'nope' }).expect(403)
})

test('taglines are limited to 40 characters', async () => {
  const long = 'x'.repeat(41)
  const res = await as(app, owner).post('/products', newTee({ tagline: long })).expect(400)
  assert.equal(res.body.error.details[0].path, 'tagline')
  await as(app, owner).post('/products', newTee({ tagline: 'x'.repeat(40) })).expect(201)
})
