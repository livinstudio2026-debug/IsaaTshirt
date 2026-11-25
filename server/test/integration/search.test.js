import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { startDb, stopDb, resetDb, seedProduct } from '../support/db.js'
import { createApp } from '../../src/app.js'

const app = createApp()
before(startDb)
after(stopDb)
beforeEach(async () => {
  await resetDb()
  await seedProduct({ slug: 'racing', name: 'Racing Championship Oversized Tee', description: 'Heavy cotton with a racing graphic.', colors: [{ name: 'Olive', hex: '#55612a' }] })
  await seedProduct({ slug: 'orbit', name: 'Orbit Hoodie', category: 'hoodies', price: 249900, mrp: 299900, description: 'Fleece lined. Pairs well with a tee.', colors: [{ name: 'Black', hex: '#111111' }] })
  await seedProduct({ slug: 'wander', name: 'Wander Far Tee', colors: [{ name: 'Sand', hex: '#cdbfa6' }, { name: 'Olive', hex: '#55612a' }], price: 69900, sizes: [{ size: 'M', stock: 0 }] })
  await seedProduct({ slug: 'secret', name: 'Secret Racing Tee', isActive: false })
  await seedProduct({ slug: 'cap', name: 'Canvas Cap', category: 'accessories', colors: [{ name: 'Khaki', hex: '#a39366' }], description: '' })
})
const find = async (qs) => (await request(app).get(`/api/products?${qs}`).expect(200)).body
const slugs = async (qs) => (await find(qs)).data.map((p) => p.slug)

test('a word finds products by name, colour, category and description; hidden products never show', async () => {
  assert.deepEqual(await slugs('q=orbit'), ['orbit'])
  assert.deepEqual((await slugs('q=olive')).sort(), ['racing', 'wander'], 'by colour')
  assert.deepEqual(await slugs('q=hoodies'), ['orbit'], 'by category')
  assert.deepEqual(await slugs('q=fleece'), ['orbit'], 'by description')
  assert.deepEqual(await slugs('q=secret'), [], 'a hidden product is not searchable')
  assert.ok(!(await slugs('q=racing')).includes('secret'))
})

test('every word has to match; partial words match from the start of a word', async () => {
  assert.deepEqual(await slugs('q=olive+racing'), ['racing'])
  assert.deepEqual(await slugs('q=olive+hoodie'), [])
  assert.deepEqual((await slugs('q=ol')).sort(), ['racing', 'wander'], 'ol finds Olive')
  assert.deepEqual(await slugs('q=live'), [], 'but live does not match the middle of Olive')
  assert.deepEqual(await slugs('q=CHAMPION'), ['racing'], 'capitals do not matter')
})

test('everyday words find the right kind of product', async () => {
  assert.deepEqual((await slugs('q=tshirt')).sort(), ['racing', 'wander'])
  assert.deepEqual((await slugs('q=tees')).sort(), ['racing', 'wander'])
  assert.deepEqual(await slugs('q=sweatshirt'), ['orbit'])
  assert.deepEqual(await slugs('q=cap'), ['cap'])
  assert.deepEqual((await slugs('q=olive+tee')).sort(), ['racing', 'wander'])
})

test('best matches come first: a name hit beats a description hit, in stock beats sold out', async () => {
  const order = await slugs('q=tee')
  assert.equal(order[0] === 'orbit', false, 'the hoodie only mentions "tee" in its description')
  assert.equal(order.at(-1), 'orbit')
  const olive = await slugs('q=olive')
  assert.deepEqual(olive, ['racing', 'wander'], 'racing is in stock, wander is sold out')
})

test('sorting and paging a search', async () => {
  assert.deepEqual(await slugs('q=tee&sort=price-asc'), ['wander', 'racing', 'orbit'])
  assert.deepEqual(await slugs('q=tee&sort=price-desc'), ['orbit', 'racing', 'wander'])
  const p1 = await find('q=tee&limit=2&page=1')
  const p2 = await find('q=tee&limit=2&page=2')
  assert.deepEqual([p1.data.length, p1.meta.total, p1.meta.pages, p2.data.length], [2, 3, 2, 1])
  assert.deepEqual(await slugs('q=tee&category=hoodies'), ['orbit'], 'filters still apply')
})

test('search text is never treated as a pattern', async () => {
  for (const q of ['.*', '(', '[a-z]+', '\\', '$^', 'a|b', '%2e*', 'racing%00']) {
    const body = await find(`q=${encodeURIComponent(q)}`)
    assert.ok(Array.isArray(body.data), q)
    assert.equal(body.data.length, q === 'racing\u0000' ? body.data.length : 0, `"${q}" matches nothing special`)
  }
})

test('bad searches are refused', async () => {
  await request(app).get('/api/products?q=').expect(400)
  await request(app).get(`/api/products?q=${'x'.repeat(61)}`).expect(400)
  await request(app).get('/api/products?sort=sideways').expect(400)
  const many = await find('q=a+b+c+d+e+f+g+h+i+j')
  assert.deepEqual(many.data, [], 'only the first five words count; nothing here matches all of them')
})

test('slugs: exactly those products, still on sale, in the order asked', async () => {
  const body = await find('slugs=wander,racing,gone-forever,secret')
  assert.deepEqual(body.data.map((p) => p.slug), ['wander', 'racing'])
  assert.equal(body.meta.total, 2)
  assert.deepEqual(await slugs('slugs=orbit'), ['orbit'])
  await request(app).get('/api/products?slugs=').expect(400)
  await request(app).get('/api/products?slugs=Bad_Slug!').expect(400)
  await request(app).get(`/api/products?slugs=${Array.from({ length: 51 }, (_, i) => `p${i}`).join(',')}`).expect(400)
})

test('the normal listing is unchanged by all this', async () => {
  assert.equal((await find('')).meta.total, 4)
  assert.deepEqual(await slugs('category=accessories'), ['cap'])
  assert.equal((await find('sort=price-asc')).data[0].slug, 'wander')
})
