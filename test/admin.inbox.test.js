// Back-office inbox without a database: ContactMessage / Subscriber / Admin / AdminSession are in-memory fakes.
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { Admin } from '../src/models/Admin.js'
import { AdminSession } from '../src/models/AdminSession.js'
import { ContactMessage } from '../src/models/ContactMessage.js'
import { Subscriber } from '../src/models/Subscriber.js'
import { createApp } from '../src/app.js'
import { hashToken } from '../src/middleware/adminAuth.js'
import { csvCell, csvRow } from '../src/utils/csv.js'

const app = createApp()
const ORIGIN = 'http://localhost:5173'
const get = (v, path) => path.split('.').reduce((o, k) => o?.[k], v)
const matches = (doc, f) => Object.entries(f).every(([k, cond]) => {
  if (k === '$or') return cond.some((c) => matches(doc, c))
  const v = get(doc, k)
  if (cond instanceof RegExp) return cond.test(v ?? '')
  if (cond && typeof cond === 'object' && '$gte' in cond) return v >= cond.$gte
  return v === cond
})

let messages, subscribers, admins, sessions
const ID = (n) => String(n).padStart(24, 'a') // a valid 24-character id
const mkMessage = (n, over = {}) => ({
  _id: ID(n), name: `Asha ${n}`, email: `asha${n}@example.com`, phone: '9876543210', topic: 'order', message: `Where is my parcel number ${n}? It has been a week.`,
  status: 'new', emailed: true, ip: '203.0.113.9', userAgent: 'Mozilla/5.0', createdAt: new Date(2026, 10, 21, 10, n), ...over,
})
const mkSub = (n, over = {}) => ({ _id: ID(100 + n), email: `fan${n}@example.com`, source: 'footer', ip: '203.0.113.9', createdAt: new Date(Date.now() - n * 86_400_000), ...over })

// Mongoose queries are chainable and awaitable; these fakes are just enough of that.
const query = (rows) => {
  let out = rows
  const lean = () => Object.assign(Promise.resolve(out), { cursor: () => (async function* () { yield* out })() })
  const chain = {
    sort: () => { out = [...out].sort((a, b) => b.createdAt - a.createdAt); return chain },
    skip: (n) => { out = out.slice(n); return chain },
    limit: (n) => { out = out.slice(0, n); return chain },
    lean,
  }
  return chain
}

beforeEach(() => {
  messages = [mkMessage(1), mkMessage(2, { status: 'read' }), mkMessage(3, { status: 'replied', handledBy: { id: 'a2', name: 'Sam' }, handledAt: new Date() }), mkMessage(4, { name: 'Ravi Kumar', email: 'ravi@shop.in', message: 'Do you make a 3XL? I need sizing help.', topic: 'sizing' })]
  subscribers = [mkSub(1), mkSub(2), mkSub(9, { email: '=HYPERLINK("http://evil.example")@x.in' }), mkSub(20)]
  admins = [{ _id: 'a1', email: 'leo@isaa.in', name: 'Leo', role: 'owner', isActive: true }, { _id: 'a2', email: 'sam@isaa.in', name: 'Sam', role: 'staff', isActive: true }]
  sessions = [{ tokenHash: hashToken('owner-tok'), admin: 'a1', expiresAt: new Date(Date.now() + 1e6) }, { tokenHash: hashToken('staff-tok'), admin: 'a2', expiresAt: new Date(Date.now() + 1e6) }]
  mock.method(AdminSession, 'findOne', (f) => ({ lean: async () => sessions.find((s) => s.tokenHash === f.tokenHash) ?? null }))
  mock.method(Admin, 'findById', (id) => ({ lean: async () => admins.find((a) => a._id === id) ?? null }))

  mock.method(ContactMessage, 'find', (f) => query(messages.filter((m) => matches(m, f))))
  mock.method(ContactMessage, 'countDocuments', async (f) => messages.filter((m) => matches(m, f)).length)
  mock.method(ContactMessage, 'aggregate', async () => Object.entries(messages.reduce((acc, m) => ({ ...acc, [m.status]: (acc[m.status] ?? 0) + 1 }), {})).map(([_id, n]) => ({ _id, n })))
  mock.method(ContactMessage, 'findOneAndUpdate', (f, u) => ({
    lean: async () => {
      const m = messages.find((x) => x._id === f._id)
      if (!m) return null
      Object.assign(m, u.$set)
      for (const k of Object.keys(u.$unset ?? {})) delete m[k]
      return { ...m }
    },
  }))
  mock.method(ContactMessage, 'findOneAndDelete', (f) => ({ lean: async () => { const m = messages.find((x) => x._id === f._id); messages = messages.filter((x) => x !== m); return m ?? null } }))

  mock.method(Subscriber, 'find', (f) => query(subscribers.filter((s) => matches(s, f))))
  mock.method(Subscriber, 'countDocuments', async (f) => subscribers.filter((s) => matches(s, f)).length)
})
afterEach(() => mock.restoreAll())

const as = (tok = 'owner-tok') => ({
  get: (p) => request(app).get(`/api/admin${p}`).set('Cookie', `isaa_admin=${tok}`),
  post: (p, body = {}) => request(app).post(`/api/admin${p}`).set('Cookie', `isaa_admin=${tok}`).set('Origin', ORIGIN).send(body),
  del: (p) => request(app).delete(`/api/admin${p}`).set('Cookie', `isaa_admin=${tok}`).set('Origin', ORIGIN).set('Content-Type', 'application/json').send({}),
})

test('every inbox endpoint needs a signed-in admin', async () => {
  for (const path of ['/messages', '/inbox/unread', '/subscribers', '/subscribers/export']) await request(app).get(`/api/admin${path}`).expect(401)
  await request(app).post(`/api/admin/messages/${ID(1)}/status`).set('Origin', ORIGIN).send({ status: 'read' }).expect(401)
  await request(app).delete(`/api/admin/messages/${ID(1)}`).set('Origin', ORIGIN).set('Content-Type', 'application/json').send({}).expect(401)
})

test('messages: tabs, counts, search and paging; sender IP and browser never leave the server', async () => {
  const all = await as().get('/messages').expect(200)
  assert.equal(all.body.data.length, 4)
  assert.deepEqual(all.body.counts, { new: 2, read: 1, replied: 1, all: 4 })
  assert.equal(all.body.data[0].id, ID(4), 'newest first')
  assert.ok(all.body.data.every((m) => !('ip' in m) && !('userAgent' in m)))
  assert.equal(all.headers['cache-control'], 'no-store')

  assert.equal((await as().get('/messages?status=new').expect(200)).body.data.length, 2)
  assert.equal((await as().get('/messages?status=replied').expect(200)).body.data[0].handledBy, 'Sam')
  assert.equal((await as().get('/messages?q=ravi').expect(200)).body.data.length, 1, 'by name')
  assert.equal((await as().get('/messages?q=asha2@example').expect(200)).body.data.length, 1, 'by email')
  assert.equal((await as().get('/messages?q=3XL').expect(200)).body.data.length, 1, 'by message text')
  assert.equal((await as().get('/messages?q=(.*').expect(200)).body.data.length, 0, 'regex characters are literal')
  const page = await as().get('/messages?limit=3&page=2').expect(200)
  assert.deepEqual([page.body.data.length, page.body.meta.pages, page.body.meta.total], [1, 2, 4])
  await as().get('/messages?status=bogus').expect(400)
})

test('staff can read the inbox too', async () => {
  await as('staff-tok').get('/messages').expect(200)
  await as('staff-tok').get('/subscribers').expect(200)
  await as('staff-tok').get('/inbox/unread').expect(200)
})

test('unread badge count is the number of new messages', async () => {
  assert.equal((await as().get('/inbox/unread').expect(200)).body.data.unread, 2)
  await as().post(`/messages/${ID(1)}/status`, { status: 'read' }).expect(200)
  assert.equal((await as().get('/inbox/unread').expect(200)).body.data.unread, 1)
})

test('marking a message read / replied records who did it; "new" puts it back and clears that', async () => {
  const read = await as('staff-tok').post(`/messages/${ID(1)}/status`, { status: 'read' }).expect(200)
  assert.equal(read.body.data.status, 'read')
  assert.equal(read.body.data.handledBy, 'Sam')
  assert.ok(read.body.data.handledAt)

  const replied = await as().post(`/messages/${ID(1)}/status`, { status: 'replied' }).expect(200)
  assert.equal(replied.body.data.handledBy, 'Leo')

  const back = await as().post(`/messages/${ID(1)}/status`, { status: 'new' }).expect(200)
  assert.equal(back.body.data.status, 'new')
  assert.equal(back.body.data.handledBy, '')
  assert.equal(back.body.data.handledAt, null)
})

test('status changes reject bad input and unknown messages', async () => {
  await as().post(`/messages/${ID(1)}/status`, { status: 'archived' }).expect(400)
  await as().post(`/messages/${ID(1)}/status`, {}).expect(400)
  await as().post('/messages/not-an-id/status', { status: 'read' }).expect(400)
  await as().post(`/messages/${ID(99)}/status`, { status: 'read' }).expect(404)
  await request(app).post(`/api/admin/messages/${ID(1)}/status`).set('Cookie', 'isaa_admin=owner-tok').set('Origin', 'https://evil.example').send({ status: 'read' }).expect(403) // CSRF guard
})

test('deleting a message is owner-only', async () => {
  await as('staff-tok').del(`/messages/${ID(1)}`).expect(403)
  assert.equal(messages.length, 4)
  await as().del(`/messages/${ID(1)}`).expect(200)
  assert.equal(messages.length, 3)
  await as().del(`/messages/${ID(1)}`).expect(404)
  await as().del('/messages/zzz').expect(400)
})

test('subscribers: newest first, search, paging, totals', async () => {
  const res = await as().get('/subscribers').expect(200)
  assert.equal(res.body.data.length, 4)
  assert.deepEqual(res.body.counts, { total: 4, last7Days: 2 }) // 1 and 2 days old; the others are 9 and 20 days old
  assert.equal(res.body.data[0].email, 'fan1@example.com')
  assert.ok(res.body.data.every((s) => !('ip' in s)))
  assert.equal((await as().get('/subscribers?q=fan2@').expect(200)).body.data.length, 1)
  assert.equal((await as().get('/subscribers?q=(.*').expect(200)).body.data.length, 0)
  const page = await as().get('/subscribers?limit=3&page=2').expect(200)
  assert.deepEqual([page.body.data.length, page.body.meta.pages], [1, 2])
})

test('CSV export: owner only, UTF-8 file with a header, one row per subscriber, formulas defused', async () => {
  await as('staff-tok').get('/subscribers/export').expect(403)
  const res = await as().get('/subscribers/export').expect(200)
  assert.match(res.headers['content-type'], /text\/csv/)
  assert.match(res.headers['content-disposition'], /attachment; filename="isaa-subscribers-\d{4}-\d\d-\d\d\.csv"/)
  const text = res.text
  assert.ok(text.startsWith('\uFEFFemail,source,subscribed_at\r\n'))
  const lines = text.trim().split('\r\n')
  assert.equal(lines.length, 5, 'header + 4 subscribers')
  assert.ok(lines.some((l) => l.startsWith('fan1@example.com,footer,2026') || l.startsWith('fan1@example.com,footer,')))
  assert.ok(lines.every((l) => !l.startsWith('=')), 'no line starts with a formula')
  assert.ok(text.includes(`"'=HYPERLINK(""http://evil.example"")@x.in"`), 'the hostile address is quoted and prefixed with an apostrophe')
})

test('csv cells: quoting and formula guard', () => {
  assert.equal(csvCell('a@b.in'), 'a@b.in')
  assert.equal(csvCell('a,b'), '"a,b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  assert.equal(csvCell('two\nlines'), '"two\nlines"')
  assert.equal(csvCell('=1+1'), "'=1+1")
  assert.equal(csvCell('+91 98765'), "'+91 98765")
  assert.equal(csvCell('-5'), "'-5")
  assert.equal(csvCell('@sum'), "'@sum")
  assert.equal(csvCell(null), '')
  assert.equal(csvRow(['a', 'b,c', undefined]), 'a,"b,c",')
})
