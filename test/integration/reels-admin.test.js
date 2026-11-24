import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { startDb, stopDb, resetDb, makeAdmin, as } from '../support/db.js'
import { createApp } from '../../src/app.js'
import { Reel } from '../../src/models/Reel.js'

const app = createApp()
let owner, staff
before(startDb)
after(stopDb)
beforeEach(async () => { await resetDb(); owner = await makeAdmin({ role: 'owner' }); staff = await makeAdmin({ role: 'staff' }) })

const poster = (id = 'aa11bb22') => ({ url: `https://res.cloudinary.com/demo/image/upload/v9/isaa/reels/reel-${id}.webp`, publicId: `isaa/reels/reel-${id}` })
const video = (id = 'cc33dd44') => ({ url: `https://res.cloudinary.com/demo/video/upload/v9/isaa/reels/reel-${id}.mp4`, publicId: `isaa/reels/reel-${id}` })
const reel = (over = {}) => ({ url: 'https://www.instagram.com/reel/ABC123xyz/', poster: poster(), caption: 'Drop 04 behind the scenes', tag: 'New drop', accent: '#6b6a22', ...over })
const add = async (over) => (await as(app, owner).post('/reels', reel(over)).expect(201)).body.data

test('reels need a sign-in; staff can look and hide / show but nothing else', async () => {
  await request(app).get('/api/admin/reels').expect(401)
  const r = await add()
  await as(app, staff).get('/reels').expect(200)
  await as(app, staff).post('/reels', reel()).expect(403)
  await as(app, staff).patch(`/reels/${r.id}`, { caption: 'x' }).expect(403)
  await as(app, staff).del(`/reels/${r.id}`).expect(403)
  await as(app, staff).post('/reels/order', { ids: [r.id] }).expect(403)
  await as(app, staff).post('/uploads/sign', { kind: 'reel-poster' }).expect(403)
  const hidden = await as(app, staff).post(`/reels/${r.id}/visibility`, { isActive: false }).expect(200)
  assert.equal(hidden.body.data.isActive, false)
})

test('add: goes to the end, defaults are sensible, a public wall only shows visible ones', async () => {
  const a = await add()
  const b = await add({ url: 'https://www.instagram.com/reel/DEF456/', video: video(), isActive: false, caption: '', tag: '', accent: null })
  assert.deepEqual([a.order, b.order], [1, 2])
  assert.equal(a.poster.thumb.includes('/upload/f_auto,q_auto,w_360/'), true)
  assert.deepEqual([b.video.url.endsWith('.mp4'), b.accent, b.isActive], [true, null, false])
  const list = (await as(app, owner).get('/reels').expect(200)).body
  assert.deepEqual([list.data.map((r) => r.id), list.meta.total, list.meta.wallShows], [[a.id, b.id], 2, 8])
  const pub = (await request(app).get('/api/reels').expect(200)).body.data
  assert.deepEqual(pub.map((r) => r.id), [a.id], 'the hidden reel is not public')
})

test('add: only real Instagram links and our own Cloudinary uploads are accepted', async () => {
  const bad = (over) => as(app, owner).post('/reels', reel(over))
  await bad({ url: 'https://evil.example/reel/ABC/' }).expect(400)
  await bad({ url: 'https://www.instagram.com/someone/' }).expect(400)
  await bad({ poster: { url: 'https://evil.example/p.webp', publicId: 'isaa/reels/x' } }).expect(400)
  await bad({ poster: { url: 'https://res.cloudinary.com/demo/image/upload/v1/isaa/products/x.webp', publicId: 'isaa/products/x' } }).expect(400) // wrong folder
  await bad({ poster: { url: 'https://res.cloudinary.com/demo/video/upload/v1/isaa/reels/x.mp4', publicId: 'isaa/reels/x' } }).expect(400) // a video where a picture goes
  const v = await bad({ video: poster() }).expect(400) // a picture where a video goes
  assert.equal(v.body.error.details[0].path, 'video')
  await bad({ tag: 'x'.repeat(31) }).expect(400)
  await bad({ accent: 'green' }).expect(400)
  await bad({ poster: undefined }).expect(400)
  assert.equal(await Reel.countDocuments(), 0)
})

test('edit: only what is sent changes; pictures, video and colour can be replaced or removed', async () => {
  const r = await add({ video: video() })
  const e1 = (await as(app, owner).patch(`/reels/${r.id}`, { caption: 'New caption', tag: '' }).expect(200)).body.data
  assert.deepEqual([e1.caption, e1.tag, e1.poster.url, e1.video.url], ['New caption', '', r.poster.url, r.video.url])
  const e2 = (await as(app, owner).patch(`/reels/${r.id}`, { poster: poster('ee55ff66'), video: null, accent: null }).expect(200)).body.data
  assert.deepEqual([e2.poster.url.includes('ee55ff66'), e2.video, e2.accent], [true, null, null])
  const stored = await Reel.findById(r.id).lean()
  assert.ok(!('videoUrl' in stored) && !('accent' in stored))
  await as(app, owner).patch(`/reels/${r.id}`, { poster: { url: 'https://evil.example/x.webp', publicId: 'isaa/reels/x' } }).expect(400)
  assert.equal((await as(app, owner).patch(`/reels/${r.id}`, { poster: e2.poster }).expect(200)).body.data.poster.url, e2.poster.url, 'sending the picture it already has is fine')
  await as(app, owner).patch(`/reels/${r.id}`, {}).expect(400)
  await as(app, owner).patch(`/reels/${'a'.repeat(24)}`, { caption: 'x' }).expect(404)
})

test('reorder: the list is the new order; reels left out go after it; bad lists are refused', async () => {
  const [a, b, c, d] = [await add(), await add(), await add(), await add()]
  const res = (await as(app, owner).post('/reels/order', { ids: [c.id, a.id] }).expect(200)).body.data
  assert.deepEqual(res.map((r) => r.id), [c.id, a.id, b.id, d.id])
  assert.deepEqual(res.map((r) => r.order), [1, 2, 3, 4])
  assert.deepEqual((await request(app).get('/api/reels').expect(200)).body.data.map((r) => r.id), [c.id, a.id, b.id, d.id], 'the public wall follows')
  await as(app, owner).post('/reels/order', { ids: [a.id, a.id] }).expect(400)
  await as(app, owner).post('/reels/order', { ids: [a.id, 'b'.repeat(24)] }).expect(404)
  await as(app, owner).post('/reels/order', { ids: [] }).expect(400)
})

test('delete removes it; the wall holds at most 24', async () => {
  const r = await add()
  await as(app, owner).del(`/reels/${r.id}`).expect(200)
  await as(app, owner).del(`/reels/${r.id}`).expect(404)
  for (let i = 0; i < 24; i++) await Reel.create({ url: `https://www.instagram.com/reel/R${i}xyz/`, poster: poster(String(i).padStart(8, '0')), order: i + 1 })
  const full = await as(app, owner).post('/reels', reel()).expect(409)
  assert.match(full.body.error.message, /up to 24/)
})

test('signing: reel pictures and videos get their own folder and kind (needs Cloudinary keys)', async () => {
  const { env } = await import('../../src/config/env.js')
  Object.assign(env, { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'secret', cloudinaryEnabled: true })
  const p = (await as(app, owner).post('/uploads/sign', { kind: 'reel-poster' }).expect(200)).body.data
  assert.match(p.url, /\/demo\/image\/upload$/)
  assert.equal(p.fields.folder, 'isaa/reels')
  assert.match(p.fields.public_id, /^reel-[0-9a-f]{8}$/)
  const v = (await as(app, owner).post('/uploads/sign', { kind: 'reel-video' }).expect(200)).body.data
  assert.match(v.url, /\/demo\/video\/upload$/)
  assert.equal(v.fields.allowed_formats, 'mp4,webm,mov')
  const prod = (await as(app, owner).post('/uploads/sign', { slug: 'racing' }).expect(200)).body.data
  assert.equal(prod.fields.folder, 'isaa/products')
  assert.ok(prod.fields.signature)
  await as(app, owner).post('/uploads/sign', { kind: 'nope' }).expect(400)
})
