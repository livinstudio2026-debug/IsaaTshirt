import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { startDb, stopDb, resetDb, makeAdmin, as, seedOrder, seedProduct, useMailbox } from '../support/db.js'
import { createApp } from '../../src/app.js'
import { Order } from '../../src/models/Order.js'
import { Product } from '../../src/models/Product.js'

const app = createApp()
let owner, staff, mail
before(async () => { await startDb(); mail = useMailbox() })
after(async () => { mail.stop(); await stopDb() })
beforeEach(async () => { await resetDb(); mail.clear(); owner = await makeAdmin({ role: 'owner' }); staff = await makeAdmin({ role: 'staff' }) })

const tracking = { carrier: 'DTDC', number: 'D123', url: 'https://t.example/D123' }

test('cancelling emails the customer once, after the stock is back, and records it', async () => {
  const p = await seedProduct({ sizes: [{ size: 'M', stock: 3 }] })
  const o = await seedOrder({ status: 'packed', items: [{ product: p._id, slug: p.slug, name: p.name, color: 'Olive', size: 'M', qty: 2, price: 84900, mrp: 124900 }] })
  const res = await as(app, staff).post(`/orders/${o.orderNumber}/cancel`, { reason: 'Customer asked, wrong size' }).expect(200)
  assert.equal(res.body.data.status, 'cancelled')
  await mail.waitFor()
  assert.equal(mail.sent.length, 1)
  const [m] = mail.sent
  assert.equal(m.to, 'asha@example.com')
  assert.match(m.subject, /has been cancelled/)
  assert.match(m.text, /nothing to refund/)
  assert.ok(!m.text.includes('wrong size') && !m.html.includes('wrong size'), 'the internal reason is never shown to the customer')
  assert.equal((await Product.findById(p._id).lean()).sizes[0].stock, 5, 'stock is back')
  await mail.waitFor(async () => true)
  await new Promise((r) => setTimeout(r, 50))
  assert.equal((await Order.findById(o._id).lean()).emails.cancelled, true)

  mail.clear()
  await as(app, owner).post(`/orders/${o.orderNumber}/cancel`, {}).expect(409) // double click: no second email, no second restock
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(mail.sent.length, 0)
  assert.equal((await Product.findById(p._id).lean()).sizes[0].stock, 5)
})

test('a paid online order says a refund is coming', async () => {
  const o = await seedOrder({ status: 'placed', payment: { method: 'online', status: 'paid', paidAt: new Date() } })
  await as(app, owner).post(`/orders/${o.orderNumber}/cancel`, {}).expect(200)
  await mail.waitFor()
  assert.match(mail.sent[0].text, /refunding ₹1,698/)
})

test('delivering emails the customer; shipping still does too', async () => {
  const o = await seedOrder({ status: 'packed' })
  await as(app, staff).post(`/orders/${o.orderNumber}/status`, { status: 'shipped', tracking }).expect(200)
  await mail.waitFor()
  assert.match(mail.sent[0].subject, /has shipped/)
  mail.clear()
  const res = await as(app, staff).post(`/orders/${o.orderNumber}/status`, { status: 'delivered' }).expect(200)
  assert.equal(res.body.data.status, 'delivered')
  await mail.waitFor()
  assert.match(mail.sent[0].subject, /was delivered/)
  assert.match(mail.sent[0].text, /7 days/)
  await new Promise((r) => setTimeout(r, 50))
  const saved = await Order.findById(o._id).lean()
  assert.deepEqual([saved.emails.shipped, saved.emails.delivered], [true, true])
  mail.clear()
  await as(app, staff).post(`/orders/${o.orderNumber}/status`, { status: 'delivered' }).expect(409)
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(mail.sent.length, 0, 'a refused change sends nothing')
})

test('emails are HTML-escaped', async () => {
  const o = await seedOrder({ status: 'packed', customer: { name: '<b>Eve</b>', phone: '9876543210', email: 'eve@example.com' } })
  await as(app, owner).post(`/orders/${o.orderNumber}/cancel`, {}).expect(200)
  await mail.waitFor()
  assert.ok(!mail.sent[0].html.includes('<b>Eve</b>'))
})

test('resend: only the email that matches the order, and it is logged', async () => {
  const o = await seedOrder({ status: 'delivered', tracking, emails: { delivered: false } })
  await as(app, staff).post(`/orders/${o.orderNumber}/resend-email`, { kind: 'cancelled' }).expect(409)
  await as(app, staff).post(`/orders/${o.orderNumber}/resend-email`, { kind: 'bogus' }).expect(400)
  const res = await as(app, staff).post(`/orders/${o.orderNumber}/resend-email`, { kind: 'delivered' }).expect(200)
  assert.equal(mail.sent.length, 1)
  assert.equal(res.body.data.history[0].action, 'email')
  assert.equal((await Order.findById(o._id).lean()).emails.delivered, true)
  await as(app, staff).post(`/orders/${(await seedOrder({ status: 'placed' })).orderNumber}/resend-email`, { kind: 'shipped' }).expect(409)
})

test('resend reports a mail-server failure instead of pretending', async () => {
  mail.stop()
  const o = await seedOrder({ status: 'cancelled' })
  const res = await as(app, owner).post(`/orders/${o.orderNumber}/resend-email`, { kind: 'cancelled' }).expect(502) // SMTP isn't configured in tests
  assert.match(res.body.error.message, /could not be sent/)
  mail = useMailbox()
})
