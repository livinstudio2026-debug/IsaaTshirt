// Back-office products without a database: Product / Admin / AdminSession are in-memory fakes.
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { Admin } from '../src/models/Admin.js'
import { AdminSession } from '../src/models/AdminSession.js'
import { Product } from '../src/models/Product.js'
import { ProductChange } from '../src/models/ProductChange.js'
import { createApp } from '../src/app.js'
import { hashToken } from '../src/middleware/adminAuth.js'
import { slugify } from '../src/controllers/admin.products.controller.js'
import { stockState } from '../src/utils/serialize.js'

const app = createApp()
const ORIGIN = 'http://localhost:5173'
const get = (v, path) => path.split('.').reduce((o, k) => o?.[k], v)
const clone = (v) => JSON.parse(JSON.stringify(v), (k, val) => (typeof val === 'string' && /^\d{4}-\d\d-\d\dT/.test(val) ? new Date(val) : val))

// just enough of Mongo's query language for the filters the products controller builds
const matches = (doc, f) => Object.entries(f).every(([k, c]) => {
  if (k === '$or') return c.some((x) => matches(doc, x))
  if (k === '$and') return c.every((x) => matches(doc, x))
  const v = get(doc, k)
  if (c instanceof RegExp) return c.test(v ?? '')
  if (Array.isArray(c)) return JSON.stringify(v) === JSON.stringify(c)
  if (c && typeof c === 'object') {
    if ('$type' in c) return typeof v === 'number'
    if ('$elemMatch' in c) return (v ?? []).some((e) => matches(e, c.$elemMatch))
    if ('$not' in c) return !matches({ [k]: v }, { [k]: c.$not })
    if ('$gt' in c) return v > c.$gt
    if ('$lte' in c) return v <= c.$lte
    if ('$ne' in c) return v !== c.$ne
    if ('$nin' in c) return !c.$nin.includes(v)
    if ('$in' in c) return c.$in.includes(v)
  }
  return v === c
})
const applySet = (doc, set, filter) => {
  for (const [k, v] of Object.entries(set)) {
    if (k === 'sizes.$.stock') doc.sizes.find((s) => s.size === filter.sizes.$elemMatch.size).stock = v
    else doc[k] = v
  }
}

let products, sessions, admins, nextId, changeLog
const mkProduct = (slug, over = {}) => ({
  _id: `p${nextId++}`, slug, name: slug.toUpperCase(), description: '', category: 't-shirts', price: 84900, mrp: 124900,
  colors: [{ name: 'Olive', hex: '#55612a', hero: { url: `https://res.cloudinary.com/demo/image/upload/v1/isaa/products/${slug}-olive.webp`, publicId: `isaa/products/${slug}-olive`, alt: '' } }], sizes: ['S', 'M', 'L', 'XL'].map((size) => ({ size, stock: 20 })),
  images: [{ url: `https://res.cloudinary.com/demo/image/upload/v1/isaa/products/${slug}.webp`, publicId: `isaa/products/${slug}`, alt: '' }], // the shared pictures: the back shot
  isActive: true, isLimited: false, isBestSeller: false, isNewArrival: false, heroOrder: null, featuredOrder: null, bestSellerOrder: null, newArrivalOrder: null,
  createdAt: new Date(2026, 10, 1 + nextId), updatedAt: new Date(2026, 10, 1), ...over,
})

beforeEach(() => {
  nextId = 1
  changeLog = []
  products = [
    mkProduct('racing', { heroOrder: 1, isBestSeller: true, bestSellerOrder: 1 }),
    mkProduct('compass', { sizes: [{ size: 'S', stock: 20 }, { size: 'M', stock: 3 }, { size: 'L', stock: 0 }], heroOrder: 2 }), // low
    mkProduct('orbit', { sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 0 }] }), // out
    mkProduct('hidden-one', { isActive: false }),
  ]
  admins = [{ _id: 'a1', email: 'leo@isaa.in', name: 'Leo', role: 'owner', isActive: true }, { _id: 'a2', email: 'sam@isaa.in', name: 'Sam', role: 'staff', isActive: true }]
  sessions = [{ tokenHash: hashToken('owner-tok'), admin: 'a1', expiresAt: new Date(Date.now() + 1e6) }, { tokenHash: hashToken('staff-tok'), admin: 'a2', expiresAt: new Date(Date.now() + 1e6) }]
  mock.method(AdminSession, 'findOne', (f) => ({ lean: async () => sessions.find((s) => s.tokenHash === f.tokenHash) ?? null }))
  mock.method(Admin, 'findById', (id) => ({ lean: async () => admins.find((a) => a._id === id) ?? null }))

  mock.method(Product, 'find', (f) => {
    let rows = products.filter((p) => matches(p, f))
    const chain = {
      sort: (s) => { const [[k, d]] = Object.entries(s); rows = [...rows].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * d); return chain },
      skip: (n) => { rows = rows.slice(n); return chain }, limit: (n) => { rows = rows.slice(0, n); return chain }, lean: async () => clone(rows),
    }
    return chain
  })
  mock.method(ProductChange, 'create', async (doc) => { changeLog.push(doc); return doc }) // the change log has its own tests (integration/product-log)
  mock.method(ProductChange, 'insertMany', async (docs) => { changeLog.push(...docs); return docs })
  mock.method(Product, 'countDocuments', async (f) => products.filter((p) => matches(p, f)).length)
  mock.method(Product, 'exists', async (f) => products.find((p) => matches(p, f)) ?? null)
  mock.method(Product, 'findOne', (f) => {
    let rows = products.filter((p) => matches(p, f))
    const chain = { sort: (s) => { const [[k, d]] = Object.entries(s); rows = [...rows].sort((a, b) => ((a[k] ?? 0) - (b[k] ?? 0)) * d); return chain }, lean: async () => (rows[0] ? clone(rows[0]) : null) }
    return chain
  })
  mock.method(Product, 'findOneAndUpdate', (f, u) => ({
    lean: async () => {
      const p = products.find((x) => matches(x, f))
      if (!p) return null
      applySet(p, u.$set, f)
      return clone(p)
    },
  }))
  mock.method(Product, 'findOneAndDelete', (f) => ({ lean: async () => { const i = products.findIndex((x) => matches(x, f)); return i < 0 ? null : clone(products.splice(i, 1)[0]) } }))
  // (the real schema fills in the isBestSeller / placement defaults, so the fake does too)
  mock.method(Product, 'create', async (doc) => { const p = { _id: `p${nextId++}`, createdAt: new Date(), updatedAt: new Date(), isBestSeller: false, isNewArrival: false, heroOrder: null, featuredOrder: null, bestSellerOrder: null, newArrivalOrder: null, ...clone(doc) }; products.push(p); return { toObject: () => clone(p) } })
  mock.method(Product, 'bulkWrite', async (ops) => {
    for (const op of ops) {
      if (op.updateMany) products.filter((p) => matches(p, op.updateMany.filter)).forEach((p) => applySet(p, op.updateMany.update.$set, {}))
      if (op.updateOne) { const p = products.find((x) => matches(x, op.updateOne.filter)); if (p) applySet(p, op.updateOne.update.$set, {}) }
    }
    return {}
  })
})
afterEach(() => mock.restoreAll())

const as = (tok = 'owner-tok') => {
  const send = (method) => (p, body = {}) => request(app)[method](`/api/admin${p}`).set('Cookie', `isaa_admin=${tok}`).set('Origin', ORIGIN).send(body)
  return { get: (p) => request(app).get(`/api/admin${p}`).set('Cookie', `isaa_admin=${tok}`), post: send('post'), patch: send('patch'), del: send('delete') }
}
const upload = (slug, id = 'ab12cd34') => ({ url: `https://res.cloudinary.com/demo/image/upload/v9/isaa/products/${slug}-${id}.webp`, publicId: `isaa/products/${slug}-${id}` })
const newTee = (over = {}) => ({
  name: 'Wander Far', description: 'Oversized tee.', category: 't-shirts', price: 79900, mrp: 119900,
  colors: [{ name: 'Sand', hex: '#cdbfa6', hero: upload('wander-far-sand') }], sizes: [{ size: 'S', stock: 10 }, { size: 'M', stock: 10 }], images: [upload('wander-far')], ...over,
})

test('every products endpoint needs a signed-in admin', async () => {
  await request(app).get('/api/admin/products').expect(401)
  await request(app).get('/api/admin/placements').expect(401)
  await request(app).post('/api/admin/products').set('Origin', ORIGIN).send(newTee()).expect(401)
  await request(app).post('/api/admin/products/racing/stock').set('Origin', ORIGIN).send({ size: 'S', from: 20, to: 5 }).expect(401)
})

test('list: counts, search, status filters (low / out / hidden) and placement', async () => {
  const all = await as().get('/products').expect(200)
  assert.equal(all.body.data.length, 4)
  assert.deepEqual(all.body.counts, { all: 4, active: 3, hidden: 1, low: 1, out: 1 })
  assert.equal(all.body.meta.lowStockAt, 5)
  const compass = all.body.data.find((p) => p.slug === 'compass')
  assert.equal(compass.stockState, 'low')
  assert.equal(compass.sizes.find((s) => s.size === 'M').low, true)
  assert.equal(compass.sizes.find((s) => s.size === 'L').low, false, 'a sold-out size is not "low"')
  assert.equal(compass.totalStock, 23)
  assert.equal(all.body.data.find((p) => p.slug === 'orbit').stockState, 'out')
  assert.deepEqual(compass.placements, { hero: 2, featured: null, bestsellers: null, newarrivals: null })
  assert.equal((await as().get('/products?status=low').expect(200)).body.data[0].slug, 'compass')
  assert.equal((await as().get('/products?status=out').expect(200)).body.data[0].slug, 'orbit')
  assert.equal((await as().get('/products?status=hidden').expect(200)).body.data[0].slug, 'hidden-one')
  assert.equal((await as().get('/products?status=active').expect(200)).body.data.length, 3)
  assert.equal((await as().get('/products?q=COMP').expect(200)).body.data.length, 1, 'search is case-insensitive')
  assert.equal((await as().get('/products?q=(.*').expect(200)).body.data.length, 0, 'regex characters are literal')
  assert.deepEqual((await as().get('/products?placement=hero').expect(200)).body.data.map((p) => p.slug).sort(), ['compass', 'racing'])
  await as().get('/products?status=bogus').expect(400)
})

test('one product: hidden ones too; unknown is 404', async () => {
  assert.equal((await as().get('/products/hidden-one').expect(200)).body.data.isActive, false)
  await as().get('/products/nope').expect(404)
})

test('staff can see products, change stock and hide / show; everything else is owner-only', async () => {
  const staff = as('staff-tok')
  await staff.get('/products').expect(200)
  await staff.get('/placements').expect(200)
  await staff.post('/products/racing/stock', { size: 'S', from: 20, to: 12 }).expect(200)
  await staff.post('/products/racing/visibility', { isActive: false }).expect(200)
  for (const [call, p, body] of [['post', '/products', newTee()], ['patch', '/products/racing', { price: 1000 }], ['del', '/products/racing', {}], ['post', '/placements/hero', { slugs: [] }], ['post', '/uploads/sign', {}]]) {
    const res = await staff[call](p, body)
    assert.equal(res.status, 403, `${call} ${p}`)
  }
  assert.equal(products.length, 4, 'nothing was added or deleted')
  assert.equal(products[0].price, 84900, 'the price was not changed')
})

test('stock: sets the number if it is still what the screen showed; otherwise 409 with the real figure', async () => {
  const ok = await as().post('/products/racing/stock', { size: 'M', from: 20, to: 7 }).expect(200)
  assert.equal(ok.body.data.sizes.find((s) => s.size === 'M').stock, 7)
  assert.equal(products[0].sizes.find((s) => s.size === 'M').stock, 7)

  const stale = await as().post('/products/racing/stock', { size: 'M', from: 20, to: 1 }).expect(409) // an order took some meanwhile
  assert.match(stale.body.error.message, /now has 7/)
  assert.equal(stale.body.error.details.current.sizes.find((s) => s.size === 'M').stock, 7)
  assert.equal(products[0].sizes.find((s) => s.size === 'M').stock, 7, 'nothing was overwritten')

  await as().post('/products/racing/stock', { size: 'XXL', from: 0, to: 5 }).expect(404) // product has no such size
  await as().post('/products/racing/stock', { size: 'M', from: 7, to: -1 }).expect(400)
  await as().post('/products/racing/stock', { size: 'M', from: 7, to: 2.5 }).expect(400)
  await as().post('/products/racing/stock', { size: 'M', from: 7, to: 99999 }).expect(400)
  await as().post('/products/nope/stock', { size: 'M', from: 0, to: 1 }).expect(404)
})

test('hide and show without deleting', async () => {
  assert.equal((await as().post('/products/racing/visibility', { isActive: false }).expect(200)).body.data.isActive, false)
  assert.equal(products[0].isActive, false)
  assert.equal((await as().post('/products/racing/visibility', { isActive: true }).expect(200)).body.data.isActive, true)
  await as().post('/products/racing/visibility', { isActive: 'no' }).expect(400)
})

test('add: slug from the name, unique, images must be our own uploads, MRP not below price', async () => {
  const res = await as().post('/products', newTee()).expect(201)
  assert.equal(res.body.data.slug, 'wander-far')
  assert.equal(res.body.data.colors[0].hero.alt, 'Wander Far in Sand', 'the hero gets alt text from the product and colour')
  assert.equal(res.body.data.images[0].alt, 'Wander Far, back view', 'the first shared picture is the back shot')
  assert.equal(res.body.data.isActive, true)
  assert.equal(products.at(-1).heroOrder, null)

  const again = await as().post('/products', newTee({ images: [upload('wander-far', 'ee55ff66')], colors: [{ name: 'Sand', hex: '#cdbfa6', hero: upload('wander-far-sand', 'ee55ff67') }] })).expect(201)
  assert.equal(again.body.data.slug, 'wander-far-2', 'same name, new slug')

  assert.equal((await as().post('/products', newTee({ name: 'New' })).expect(201)).body.data.slug, 'new-2', 'reserved for the back office')
  const bad = (over) => as().post('/products', newTee(over))
  const priced = await bad({ price: 99900, mrp: 89900 }).expect(400)
  assert.ok(priced.body.error.details.some((d) => d.path === 'mrp'))
  await bad({ images: [{ url: 'https://evil.example/x.webp', publicId: 'isaa/products/x' }] }).expect(400) // not Cloudinary
  await bad({ images: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/other/x.webp', publicId: 'other/x' }] }).expect(400) // wrong folder
  await bad({ images: [upload('a'), upload('b'), upload('c'), upload('d'), upload('e'), upload('f')] }).expect(400) // at most 5 shared pictures
  // every colour needs its own hero, and it has to be one of our uploads
  const noHero = await bad({ colors: [{ name: 'Sand', hex: '#cdbfa6' }] }).expect(400)
  assert.ok(noHero.body.error.details.some((d) => d.path === 'colors.0.hero'))
  await bad({ colors: [{ name: 'Sand', hex: '#cdbfa6', hero: { url: 'https://evil.example/x.webp', publicId: 'isaa/products/x' } }] }).expect(400) // not Cloudinary
  await bad({ colors: [{ name: 'Sand', hex: '#cdbfa6', hero: { url: 'https://res.cloudinary.com/demo/image/upload/v1/other/x.webp', publicId: 'other/x' } }] }).expect(400) // wrong folder
  await bad({ colors: [{ name: 'Sand', hex: '#cdbfa6', hero: upload('w-sand') }, { name: 'Black', hex: '#1b1b1b' }] }).expect(400) // the second colour has no hero
  await bad({ sizes: [{ size: 'M', stock: 1 }, { size: 'M', stock: 2 }] }).expect(400) // duplicate size
  await bad({ colors: [{ name: 'Sand', hex: 'sand', hero: upload('w-sand') }] }).expect(400)
  await bad({ category: 'shoes' }).expect(400)
  await bad({ price: 12.5 }).expect(400)
  await bad({ name: undefined }).expect(400)
})

test('add with placements puts the product at the end of those rails', async () => {
  await as().post('/products', newTee({ placements: { hero: true, bestsellers: true } })).expect(201)
  const p = products.at(-1)
  assert.equal(p.heroOrder, 3, 'after the two already in the hero')
  assert.equal(p.bestSellerOrder, 2)
  assert.equal(p.isBestSeller, true, 'the shop filter flag follows the shelf')
  assert.equal(p.featuredOrder, null)
})

test('edit: price and details change, live stock is not touched', async () => {
  const res = await as().patch('/products/racing', { price: 79900, name: 'Racing Club', isLimited: true, sizes: products[0].sizes }).expect(200)
  assert.deepEqual([res.body.data.price, res.body.data.name, res.body.data.isLimited], [79900, 'Racing Club', true])
  assert.equal(res.body.data.slug, 'racing', 'the web address never changes')
  assert.equal(products[0].sizes[0].stock, 20)
  await as().patch('/products/racing', { mrp: 50000 }).expect(400) // below the (new) price
  await as().patch('/products/racing', { price: 200000 }).expect(400) // above the MRP
  await as().patch('/products/nope', { price: 1000 }).expect(404)
  await as().patch('/products/racing', { slug: 'other' }).expect(200) // unknown keys are ignored: the slug can't be changed
  assert.equal(products[0].slug, 'racing')
})

test('edit: sizes can be added or removed; a size already there keeps its live stock; shared pictures can be reordered and swapped', async () => {
  const sizes = [...products[0].sizes.map((x) => ({ ...x })), { size: 'XXL', stock: 4 }]
  sizes[0].stock = 15 // ignored: stock of an existing size changes only through /stock
  const res = await as().patch('/products/racing', { sizes }).expect(200)
  assert.deepEqual(res.body.data.sizes.map((s) => [s.size, s.stock]), [['S', 20], ['M', 20], ['L', 20], ['XL', 20], ['XXL', 4]])
  const dropped = await as().patch('/products/racing', { sizes: [{ size: 'M', stock: 0 }, { size: 'L', stock: 0 }] }).expect(200)
  assert.deepEqual(dropped.body.data.sizes.map((s) => [s.size, s.stock]), [['M', 20], ['L', 20]])

  const kept = products[0].images[0]
  const second = upload('racing', '99aa88bb')
  const two = await as().patch('/products/racing', { images: [{ url: kept.url }, second] }).expect(200)
  assert.equal(two.body.data.images.length, 2)
  assert.equal(two.body.data.images[1].alt, `${products[0].name}, view 3`)
  const swapped = await as().patch('/products/racing', { images: [second, { url: kept.url }] }).expect(200)
  assert.equal(swapped.body.data.images[0].url, second.url, 'the back shot is whichever comes first')
  await as().patch('/products/racing', { images: [{ url: 'https://evil.example/a.webp', publicId: 'isaa/products/a' }] }).expect(400)
  await as().patch('/products/racing', { images: [] }).expect(200) // the shared pictures are optional
})

test('edit: every colour keeps its own hero; a new colour needs one; swapping a hero is allowed', async () => {
  const olive = products[0].colors[0].hero
  const black = upload('racing-black', '11aa22bb')
  const two = await as().patch('/products/racing', { colors: [{ name: 'Olive', hex: '#55612a', hero: { url: olive.url } }, { name: 'Black', hex: '#1b1b1b', hero: black }] }).expect(200)
  assert.deepEqual(two.body.data.colors.map((c) => [c.name, c.hero.url]), [['Olive', olive.url], ['Black', black.url]])
  assert.equal(two.body.data.colors[1].hero.alt, 'RACING in Black')
  assert.equal(products[0].colors[0].hero.publicId, olive.publicId, 'a hero already on the product keeps its id')
  await as().patch('/products/racing', { colors: [{ name: 'Olive', hex: '#55612a', hero: { url: olive.url } }, { name: 'Black', hex: '#1b1b1b' }] }).expect(400) // new colour, no hero
  const swapped = upload('racing-olive', '33cc44dd')
  const re = await as().patch('/products/racing', { colors: [{ name: 'Olive', hex: '#55612a', hero: swapped }, { name: 'Black', hex: '#1b1b1b', hero: { url: black.url } }] }).expect(200)
  assert.equal(re.body.data.colors[0].hero.url, swapped.url)
})

test('an older product (front shot in images[0], no colour heroes) still opens, and its first save moves the front shot into the hero', async () => {
  const front = { url: 'https://res.cloudinary.com/demo/image/upload/v1/isaa/products/old-front.webp', publicId: 'isaa/products/old-front', alt: '' }
  const back = { url: 'https://res.cloudinary.com/demo/image/upload/v1/isaa/products/old-back.webp', publicId: 'isaa/products/old-back', alt: '' }
  products.push(mkProduct('old', { colors: [{ name: 'Olive', hex: '#55612a' }, { name: 'Sand', hex: '#cdbfa6' }], images: [front, back] }))
  const seen = await as().get('/products/old').expect(200)
  assert.equal(seen.body.data.colors[0].hero.url, front.url, 'the front shot stands in as the first colour’s hero')
  assert.equal(seen.body.data.colors[1].hero, null, 'the other colours still need one')
  assert.deepEqual(seen.body.data.images.map((i) => i.url), [back.url], 'only the back shot is left as a shared picture')
  const sand = upload('old-sand', '55ee66ff')
  const saved = await as().patch('/products/old', { colors: [{ name: 'Olive', hex: '#55612a', hero: { url: front.url } }, { name: 'Sand', hex: '#cdbfa6', hero: sand }] }).expect(200)
  assert.deepEqual(saved.body.data.images.map((i) => i.url), [back.url], 'the front shot is no longer a shared picture')
  assert.deepEqual(products.at(-1).images.map((i) => i.url), [back.url])
})

test('edit: placements add to the end or remove', async () => {
  await as().patch('/products/orbit', { placements: { featured: true, newarrivals: true } }).expect(200)
  assert.deepEqual([products[2].featuredOrder, products[2].newArrivalOrder, products[2].isNewArrival], [1, 1, true])
  await as().patch('/products/racing', { placements: { hero: true } }).expect(200)
  assert.equal(products[0].heroOrder, 1, 'already on the hero: keeps its place')
  await as().patch('/products/racing', { placements: { hero: false, bestsellers: false } }).expect(200)
  assert.deepEqual([products[0].heroOrder, products[0].bestSellerOrder, products[0].isBestSeller], [null, null, false])
})

test('delete removes the product (owner only)', async () => {
  const res = await as().del('/products/hidden-one').expect(200)
  assert.deepEqual(res.body.data, { slug: 'hidden-one', deleted: true })
  assert.equal(products.length, 3)
  await as().del('/products/hidden-one').expect(404)
})

test('placements: read the rails in order; saving a list sets positions 1…n and removes the rest', async () => {
  const before = (await as().get('/placements').expect(200)).body
  assert.deepEqual(before.data.hero.map((r) => [r.slug, r.position]), [['racing', 1], ['compass', 2]])
  assert.equal(before.meta.homeShows.bestsellers, 5)

  const after = await as().post('/placements/hero', { slugs: ['compass', 'orbit'] }).expect(200)
  assert.deepEqual(after.body.data.hero.map((r) => [r.slug, r.position]), [['compass', 1], ['orbit', 2]])
  assert.equal(products[0].heroOrder, null, 'racing came off')

  await as().post('/placements/bestsellers', { slugs: ['orbit', 'compass'] }).expect(200)
  assert.deepEqual([products[2].bestSellerOrder, products[2].isBestSeller, products[1].bestSellerOrder], [1, true, 2])
  assert.equal(products[0].isBestSeller, false, 'taken off the shelf: the flag follows')

  await as().post('/placements/hero', { slugs: ['compass', 'compass'] }).expect(400)
  await as().post('/placements/hero', { slugs: ['nope'] }).expect(404)
  await as().post('/placements/sidebar', { slugs: [] }).expect(400)
})

test('image uploads are signed by the server, and say so plainly when Cloudinary is not set up', async () => {
  const res = await as().post('/uploads/sign', { slug: 'wander-far' })
  assert.equal(res.status, 503)
  assert.match(res.body.error.message, /Cloudinary/)
})

test('helpers: slugs and stock state', () => {
  assert.equal(slugify('Racing Championship'), 'racing-championship')
  assert.equal(slugify("  Rock & Roll — Café '99!  "), 'rock-and-roll-cafe-99')
  assert.equal(slugify('!!!'), '')
  assert.equal(slugify('New'), 'new', '…and the controller never uses it as an address: see the add test')
  const sizes = (...n) => n.map((stock, i) => ({ size: ['S', 'M', 'L'][i], stock }))
  assert.equal(stockState(sizes(0, 0, 0), 5), 'out')
  assert.equal(stockState(sizes(20, 20, 20), 5), 'ok')
  assert.equal(stockState(sizes(20, 5, 20), 5), 'low')
  assert.equal(stockState(sizes(20, 20, 0), 5), 'low', 'one size sold out while others sell')
})
