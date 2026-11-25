import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { startDb, stopDb, resetDb, makeAdmin, as } from '../support/db.js'
import { createApp } from '../../src/app.js'

const app = createApp()
let owner, staff
before(startDb)
after(stopDb)
beforeEach(async () => { await resetDb(); owner = await makeAdmin({ role: 'owner' }); staff = await makeAdmin({ role: 'staff' }) })

const hero = (slug) => ({ url: `https://res.cloudinary.com/demo/image/upload/v9/isaa/products/${slug}-hero.webp`, publicId: `isaa/products/${slug}-hero` })
const newTee = (over = {}) => ({ name: 'Wander Far Oversized Tee', category: 't-shirts', price: 79900, mrp: 119900, colors: [{ name: 'Sand', hex: '#cdbfa6', hero: hero('wander-far') }], sizes: [{ size: 'S', stock: 5 }, { size: 'M', stock: 5 }, { size: 'L', stock: 5 }], ...over })
const table = (over = {}) => ({ columns: ['Chest', 'Length'], rows: [{ size: 'XL', values: [124, 76] }, { size: 'S', values: [112, 70] }, { size: 'M', values: [116, 72.04] }, { size: 'L', values: [120, 74] }], ...over })
const pub = async (slug) => (await request(app).get(`/api/products/${slug}`).expect(200)).body.data
const makeChart = async (over = {}) => (await as(app, owner).post('/size-charts', { name: 'Oversized Tee', category: 't-shirts', table: table(), ...over }).expect(201)).body.data

test('owner makes a chart: slug from the name, sizes in the usual order, values rounded to 1 decimal', async () => {
  const c = await makeChart()
  assert.equal(c.slug, 'oversized-tee')
  assert.deepEqual(c.rows.map((r) => r.size), ['S', 'M', 'L', 'XL'])
  assert.deepEqual(c.rows[1].values, [116, 72])
  assert.equal(c.usedBy, 0)
  assert.equal((await makeChart()).slug, 'oversized-tee-2', 'same name gets a free address')
})

test('bad tables are refused with a path the screen can show', async () => {
  const api = as(app, owner)
  const bad = async (t, path) => assert.equal((await api.post('/size-charts', { name: 'X chart', table: t }).expect(400)).body.error.details[0].path, path)
  await bad(table({ rows: [{ size: 'S', values: [112] }] }), 'table.rows') // a value missing
  await bad(table({ rows: [{ size: 'S', values: [1, 2] }, { size: 'S', values: [1, 2] }] }), 'table.rows') // same size twice
  await bad(table({ columns: ['Chest', 'chest'] }), 'table.columns')
  await bad(table({ rows: [{ size: 'S', values: [0, 2] }] }), 'table.rows.0.values.0')
  await bad(table({ columns: [], rows: [] }), 'table.columns')
  await bad(table({ columns: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], rows: [{ size: 'S', values: [1, 1, 1, 1, 1, 1, 1] }] }), 'table.columns')
})

test('only the owner changes charts; staff can read them', async () => {
  await makeChart()
  await as(app, staff).post('/size-charts', { name: 'Nope', table: table() }).expect(403)
  await as(app, staff).patch('/size-charts/oversized-tee', { name: 'Nope' }).expect(403)
  await as(app, staff).del('/size-charts/oversized-tee').expect(403)
  assert.equal((await as(app, staff).get('/size-charts').expect(200)).body.data.length, 1)
  assert.equal((await as(app, staff).get('/size-charts/oversized-tee').expect(200)).body.data.name, 'Oversized Tee')
  await as(app, owner).get('/size-charts/missing').expect(404)
})

test('a product uses a shared chart; shoppers see only the sizes it comes in, and a chart edit shows at once', async () => {
  await makeChart({ note: 'Garment measurements in cm.' })
  const slug = (await as(app, owner).post('/products', newTee({ sizeChart: 'oversized-tee', fit: { note: 'Oversized, drop shoulder', modelHeightCm: 178, modelSize: 'M' } })).expect(201)).body.data.slug
  let p = await pub(slug)
  assert.equal(p.sizeGuide.source, 'shared')
  assert.equal(p.sizeGuide.name, 'Oversized Tee')
  assert.equal(p.sizeGuide.note, 'Garment measurements in cm.')
  assert.deepEqual(p.sizeGuide.columns, ['Chest', 'Length'])
  assert.deepEqual(p.sizeGuide.rows.map((r) => r.size), ['S', 'M', 'L'], 'XL is not sold on this tee, so it is not listed')
  assert.deepEqual(p.fit, { note: 'Oversized, drop shoulder', modelHeightCm: 178, modelSize: 'M' })

  await as(app, owner).patch('/size-charts/oversized-tee', { table: table({ rows: [{ size: 'S', values: [110, 69] }, { size: 'M', values: [114, 71] }, { size: 'L', values: [118, 73] }] }) }).expect(200)
  p = await pub(slug)
  assert.deepEqual(p.sizeGuide.rows[0].values, [110, 69], 'a chart edit shows on the product')
})

test('a product with its own table ignores the shared chart; switching it off goes back', async () => {
  await makeChart()
  const slug = (await as(app, owner).post('/products', newTee({ sizeChart: 'oversized-tee' })).expect(201)).body.data.slug
  const own = { columns: ['Chest', 'Length'], rows: [{ size: 'M', values: [100, 68] }, { size: 'S', values: [96, 66] }] }
  const saved = (await as(app, owner).patch(`/products/${slug}`, { customChart: own }).expect(200)).body.data
  assert.equal(saved.sizeChart, 'oversized-tee', 'the shared choice is kept underneath')
  assert.deepEqual(saved.customChart.rows.map((r) => r.size), ['S', 'M'])
  let p = await pub(slug)
  assert.equal(p.sizeGuide.source, 'custom')
  assert.deepEqual(p.sizeGuide.rows.map((r) => r.values), [[96, 66], [100, 68]])
  await as(app, owner).patch(`/products/${slug}`, { customChart: null }).expect(200)
  p = await pub(slug)
  assert.equal(p.sizeGuide.source, 'shared')
  assert.equal((await as(app, owner).get(`/products/${slug}`).expect(200)).body.data.customChart, null)
})

test('a product with no chart and no fit has none; older products read the same', async () => {
  const slug = (await as(app, owner).post('/products', newTee()).expect(201)).body.data.slug
  const p = await pub(slug)
  assert.equal(p.sizeGuide, null)
  assert.equal(p.fit, null)
  const list = (await request(app).get('/api/products').expect(200)).body.data
  assert.ok(list.every((x) => !('sizeGuide' in x)), 'lists stay light')
})

test('a product cannot point at a chart that does not exist; fit is checked', async () => {
  const api = as(app, owner)
  const r = await api.post('/products', newTee({ sizeChart: 'ghost' })).expect(400)
  assert.equal(r.body.error.details[0].path, 'sizeChart')
  const slug = (await api.post('/products', newTee()).expect(201)).body.data.slug
  assert.equal((await api.patch(`/products/${slug}`, { fit: { note: '', modelHeightCm: 50, modelSize: '' } }).expect(400)).body.error.details[0].path, 'fit.modelHeightCm')
  assert.equal((await api.patch(`/products/${slug}`, { fit: { note: 'x'.repeat(161), modelHeightCm: null, modelSize: '' } }).expect(400)).body.error.details[0].path, 'fit.note')
  await api.patch(`/products/${slug}`, { fit: { note: '', modelHeightCm: null, modelSize: '' } }).expect(200)
  assert.equal((await pub(slug)).fit, null, 'an empty fit is the same as none')
})

test('a chart in use cannot be deleted; an unused one can; usedBy counts products', async () => {
  await makeChart()
  const api = as(app, owner)
  const slug = (await api.post('/products', newTee({ sizeChart: 'oversized-tee' })).expect(201)).body.data.slug
  assert.equal((await api.get('/size-charts').expect(200)).body.data[0].usedBy, 1)
  const refused = await api.del('/size-charts/oversized-tee').expect(409)
  assert.match(refused.body.error.message, /1 product uses this chart/)
  await api.patch(`/products/${slug}`, { sizeChart: '' }).expect(200)
  await api.del('/size-charts/oversized-tee').expect(200)
  await api.get('/size-charts/oversized-tee').expect(404)
})

test('size chart and fit changes are in the product change log', async () => {
  await makeChart()
  const api = as(app, owner)
  const slug = (await api.post('/products', newTee()).expect(201)).body.data.slug
  await api.patch(`/products/${slug}`, { sizeChart: 'oversized-tee', fit: { note: 'Boxy', modelHeightCm: 180, modelSize: 'L' }, customChart: { columns: ['Chest'], rows: [{ size: 'M', values: [100] }] } }).expect(200)
  const log = (await as(app, staff).get(`/products/${slug}/history`).expect(200)).body.data
  const changes = Object.fromEntries(log.filter((e) => e.action === 'update').flatMap((e) => e.changes).map((c) => [c.field, c]))
  assert.equal(changes.sizeChart.to, 'oversized-tee')
  assert.equal(changes.customChart.to, 'added')
  assert.equal(changes['fit.note'].to, 'Boxy')
  assert.equal(changes['fit.model'].to, '180 cm, size L')
})

test('"size-charts" cannot be a product address (it is a back-office page)', async () => {
  const slug = (await as(app, owner).post('/products', newTee({ name: 'Size Charts' })).expect(201)).body.data.slug
  assert.equal(slug, 'size-charts-2')
})
