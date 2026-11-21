// Runs without MongoDB: covers validation, routing, security behaviour and the "database down" path.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { products, allProducts } from '../src/seed/products.js'
import { Product } from '../src/models/Product.js'
import { existsSync } from 'node:fs'
import { IMAGE_DIR } from '../src/seed/images.js'
// seed-images/ is only needed to (re)upload product images; skip these checks once it's been removed
const haveSeedImages = existsSync(IMAGE_DIR)

const app = createApp()

test('health reports db state', async () => {
  const res = await request(app).get('/api/health').expect(200)
  assert.equal(res.body.status, 'ok')
  assert.equal(res.body.db, 'disconnected')
})

test('unknown routes return a JSON 404', async () => {
  const res = await request(app).get('/api/nope').expect(404)
  assert.ok(res.body.error.message)
})

test('invalid product queries are rejected with 400 and field details', async () => {
  const res = await request(app).get('/api/products?category=shoes&limit=999&bestSeller=maybe').expect(400)
  const paths = res.body.error.details.map((d) => d.path)
  assert.deepEqual(paths.sort(), ['bestSeller', 'category', 'limit'])
})

test('invalid slug is rejected', async () => {
  await request(app).get('/api/products/Not%20A%20Slug!').expect(400)
})

test('valid query with the database down returns 503, not a crash', async () => {
  const res = await request(app).get('/api/products?placement=hero').expect(503)
  assert.equal(res.body.error.message, 'Service temporarily unavailable')
})

test('contact: invalid payload → 400 with messages', async () => {
  const res = await request(app).post('/api/contact').send({ name: 'A', email: 'nope', message: 'short' }).expect(400)
  assert.equal(res.body.error.details.length, 3)
})

test('contact: unknown topic is rejected', async () => {
  const res = await request(app).post('/api/contact').send({ name: 'Real Person', email: 'a@b.co', message: 'a long enough message', topic: 'spam' }).expect(400)
  assert.equal(res.body.error.details[0].path, 'topic')
})

test('contact: honeypot is accepted silently and nothing is stored', async () => {
  const res = await request(app).post('/api/contact').send({ name: 'Bot Bot', email: 'bot@example.com', message: 'buy cheap pills now please', website: 'http://spam' }).expect(201)
  assert.deepEqual(res.body, { ok: true })
})

test('newsletter: invalid email → 400', async () => {
  const res = await request(app).post('/api/newsletter').send({ email: 'nope' }).expect(400)
  assert.equal(res.body.error.details[0].path, 'email')
})

test('newsletter: honeypot is accepted silently and nothing is stored', async () => {
  const res = await request(app).post('/api/newsletter').send({ email: 'bot@example.com', website: 'http://spam' }).expect(201)
  assert.equal(res.body.ok, true)
})

test('malformed JSON → 400', async () => {
  await request(app).post('/api/contact').set('content-type', 'application/json').send('{bad').expect(400)
})

test('CORS only allows configured origins', async () => {
  const ok = await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
  assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173')
  const bad = await request(app).get('/api/health').set('Origin', 'http://evil.example')
  assert.equal(bad.headers['access-control-allow-origin'], undefined)
})

test('seed data is valid, unique and consistent', async () => {
  const slugs = new Set(allProducts.map((p) => p.slug))
  assert.equal(slugs.size, allProducts.length)
  for (const p of allProducts) await new Product(p).validate()
  assert.deepEqual(allProducts.filter((p) => p.heroOrder).map((p) => p.heroOrder), [1, 2, 3, 4, 5])
  assert.deepEqual(allProducts.filter((p) => p.featuredOrder).map((p) => p.featuredOrder), [1, 2, 3, 4, 5, 6, 7, 8])
  // the shelves: every flagged tee has a position, positions are 1…n with no gaps, and unflagged tees have none
  const ranks = (field) => allProducts.filter((p) => p[field]).map((p) => p[field]).sort((a, b) => a - b)
  assert.deepEqual(ranks('bestSellerOrder'), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(ranks('newArrivalOrder'), [1, 2, 3, 4, 5])
  assert.ok(allProducts.filter((p) => p.isBestSeller).every((p) => p.bestSellerOrder))
  assert.ok(allProducts.filter((p) => p.isNewArrival).every((p) => p.newArrivalOrder))
})

test('every product has its own description of a sensible length', async () => {
  const { descriptions } = await import('../src/seed/descriptions.js')
  assert.deepEqual(descriptions.map((d) => d.slug).sort(), allProducts.map((p) => p.slug).sort())
  for (const p of allProducts) {
    assert.ok(p.description.length > 200 && p.description.length <= 2000, `${p.slug} description length`)
  }
  assert.equal(new Set(allProducts.map((p) => p.description)).size, allProducts.length)
})

// ---- query building, with the database stubbed ----
import { mock } from 'node:test'

function stubFind(docs) {
  const calls = { filter: null, sort: null, skip: null, limit: null }
  const chain = {
    sort(s) { calls.sort = s; return chain },
    skip(n) { calls.skip = n; return chain },
    limit(n) { calls.limit = n; return chain },
    lean() { return Promise.resolve(docs) },
  }
  mock.method(Product, 'find', (f) => { calls.filter = f; return chain })
  mock.method(Product, 'countDocuments', async () => docs.length)
  return calls
}
const asDoc = (p, i) => ({ _id: `id${i}`, ...p })

test('GET /products?placement=hero filters + sorts by heroOrder and returns prices in paise', async () => {
  const heroes = allProducts.filter((p) => p.heroOrder).sort((a, b) => a.heroOrder - b.heroOrder).map(asDoc)
  const calls = stubFind(heroes)
  const res = await request(app).get('/api/products?placement=hero').expect(200)
  assert.deepEqual(calls.filter, { isActive: true, heroOrder: { $type: 'number' } })
  assert.deepEqual(calls.sort, { heroOrder: 1, _id: 1 })
  assert.equal(calls.limit, 50)
  assert.equal(res.body.data.length, 5)
  assert.equal(res.body.data[0].slug, 'break-rules')
  assert.equal(res.body.data[0].price, 89900)
  assert.equal(res.body.data[0].discountPercent, 31)
  assert.equal(res.body.data[0].inStock, true)
  assert.equal(res.headers['cache-control'], 'public, max-age=60, stale-while-revalidate=300')
  mock.restoreAll()
})

test('GET /products?placement=bestsellers|newarrivals sorts by the shelf order and honours limit', async () => {
  for (const [placement, field] of [['bestsellers', 'bestSellerOrder'], ['newarrivals', 'newArrivalOrder']]) {
    const calls = stubFind(allProducts.filter((p) => p[field]).sort((a, b) => a[field] - b[field]).slice(0, 5).map(asDoc))
    const res = await request(app).get(`/api/products?placement=${placement}&limit=5`).expect(200)
    assert.deepEqual(calls.filter, { isActive: true, [field]: { $type: 'number' } })
    assert.deepEqual(calls.sort, { [field]: 1, _id: 1 })
    assert.equal(calls.limit, 5)
    assert.equal(res.body.data.length, 5)
    assert.equal(res.body.data[0][field], 1)
    mock.restoreAll()
  }
})

test('GET /products combines filters, sorting and pagination', async () => {
  const calls = stubFind([])
  const res = await request(app).get('/api/products?category=t-shirts&bestSeller=true&sort=price-asc&page=3&limit=4').expect(200)
  assert.deepEqual(calls.filter, { isActive: true, category: 't-shirts', isBestSeller: true })
  assert.deepEqual(calls.sort, { price: 1, _id: 1 })
  assert.equal(calls.skip, 8)
  assert.equal(calls.limit, 4)
  assert.deepEqual(res.body.meta, { page: 3, limit: 4, total: 0, pages: 1 })
  mock.restoreAll()
})

test('GET /products/:slug → 404 for unknown, 200 for known', async () => {
  mock.method(Product, 'findOne', () => ({ lean: async () => null }))
  await request(app).get('/api/products/nope').expect(404)
  mock.restoreAll()
  mock.method(Product, 'findOne', (f) => ({ lean: async () => (f.slug === 'racing' && f.isActive ? asDoc(allProducts.find((p) => p.slug === 'racing'), 1) : null) }))
  const res = await request(app).get('/api/products/racing').expect(200)
  assert.equal(res.body.data.name, 'Racing Championship Oversized Tee')
  mock.restoreAll()
})

// ---- images: Cloudinary upload flow (uploader injected) ----
import { attachImages, missingImages, imageFile } from '../src/seed/images.js'
import { serializeProduct } from '../src/utils/serialize.js'

test('every seeded product has its image file in seed-images/', { skip: !haveSeedImages && 'seed-images/ not present' }, () => {
  assert.deepEqual(missingImages(products), [])
})

test('attachImages uploads each file under its slug and swaps in the hosted URL', { skip: !haveSeedImages && 'seed-images/ not present' }, async () => {
  const seen = []
  const fake = async (file, slug) => { seen.push([file, slug]); return { url: `https://res.cloudinary.com/demo/image/upload/v1/isaa/products/${slug}.webp`, publicId: `isaa/products/${slug}` } }
  const out = await attachImages(products, fake, 3)
  assert.equal(out.length, products.length)
  assert.deepEqual(seen.map(([, s]) => s).sort(), products.map((p) => p.slug).sort())
  assert.equal(seen.find(([, s]) => s === 'racing')[0], imageFile('racing'))
  const racing = out.find((p) => p.slug === 'racing')
  assert.equal(racing.images[0].publicId, 'isaa/products/racing')
  assert.match(racing.images[0].url, /^https:\/\/res\.cloudinary\.com\//)
  assert.equal(racing.images[0].alt, products.find((p) => p.slug === 'racing').images[0].alt)
  await new Product(racing).validate()
})

test('Cloudinary URLs are served with auto format/quality; other URLs and publicIds are untouched/hidden', () => {
  const base = products[0]
  const hosted = { ...base, _id: 'x', images: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/isaa/products/a.webp', publicId: 'isaa/products/a', alt: 'a' }] }
  const out = serializeProduct(hosted)
  assert.equal(out.images[0].url, 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good/v1/isaa/products/a.webp')
  assert.equal('publicId' in out.images[0], false)
  assert.equal(serializeProduct({ ...base, _id: 'y' }).images[0].url, base.images[0].url)
})

import { Reel } from '../src/models/Reel.js'
import { serializeReel } from '../src/utils/serialize.js'

const reelDoc = (over = {}) => ({
  _id: 'r1',
  url: 'https://www.instagram.com/reel/Cabc123_-x/',
  poster: { url: 'https://res.cloudinary.com/demo/image/upload/v1/isaa/reels/r1.webp', publicId: 'isaa/reels/r1' },
  caption: 'Drop 04',
  tag: 'New drop',
  accent: '#6b6a22',
  order: 1,
  isActive: true,
  ...over,
})

function stubReels(docs) {
  const calls = { filter: null, sort: null, limit: null }
  const chain = {
    sort(s) { calls.sort = s; return chain },
    limit(n) { calls.limit = n; return chain },
    lean() { return Promise.resolve(docs) },
  }
  mock.method(Reel, 'find', (f) => { calls.filter = f; return chain })
  return calls
}

test('reels: invalid limit is rejected', async () => {
  const res = await request(app).get('/api/reels?limit=99').expect(400)
  assert.equal(res.body.error.details[0].path, 'limit')
})

test('reels: database down returns 503', async () => {
  await request(app).get('/api/reels').expect(503)
})

test('reels: empty collection returns an empty list', async () => {
  const calls = stubReels([])
  const res = await request(app).get('/api/reels').expect(200)
  assert.deepEqual(res.body, { data: [], meta: { count: 0, limit: 8 } })
  assert.deepEqual(calls.filter, { isActive: true })
  assert.deepEqual(calls.sort, { order: 1, createdAt: -1, _id: 1 })
  mock.restoreAll()
})

test('reels: public shape, optimised poster, cache header, limit honoured', async () => {
  const calls = stubReels([reelDoc(), reelDoc({ _id: 'r2', videoUrl: 'https://cdn.example.com/r2.mp4', accent: undefined })])
  const res = await request(app).get('/api/reels?limit=2').expect(200)
  assert.equal(calls.limit, 2)
  assert.equal(res.body.data.length, 2)
  assert.deepEqual(res.body.data[0], {
    id: 'r1',
    url: 'https://www.instagram.com/reel/Cabc123_-x/',
    poster: { url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto:good/v1/isaa/reels/r1.webp' },
    videoUrl: null,
    caption: 'Drop 04',
    tag: 'New drop',
    accent: '#6b6a22',
    order: 1,
  })
  assert.equal(res.body.data[1].videoUrl, 'https://cdn.example.com/r2.mp4')
  assert.equal(res.body.data[1].accent, null)
  assert.equal(res.headers['cache-control'], 'public, max-age=60, stale-while-revalidate=300')
  mock.restoreAll()
})

test('reel model accepts valid data and rejects bad links, posters and colours', async () => {
  await new Reel(reelDoc({ _id: undefined })).validate()
  const bad = new Reel({ url: 'https://example.com/reel/x', poster: { url: 'http://insecure.example/a.webp' }, accent: 'red', videoUrl: 'ftp://x' })
  await assert.rejects(bad.validate(), (err) => ['url', 'poster.url', 'accent', 'videoUrl'].every((k) => k in err.errors))
  await assert.rejects(new Reel({ url: 'https://www.instagram.com/reel/abc/' }).validate(), (err) => 'poster' in err.errors || 'poster.url' in err.errors)
})

test('serializeReel tolerates missing optional fields', () => {
  const out = serializeReel({ _id: 'z', url: 'https://www.instagram.com/p/abc/', poster: { url: 'https://img.example.com/a.webp' }, order: 0 })
  assert.equal(out.videoUrl, null)
  assert.equal(out.caption, '')
  assert.equal(out.tag, '')
  assert.equal(out.accent, null)
  assert.equal(out.poster.url, 'https://img.example.com/a.webp')
})
