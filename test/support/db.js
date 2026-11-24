// Integration-test toolkit: a REAL MongoDB (in memory), real models, the real Express app.
// The first run downloads a MongoDB binary (about 100 MB, cached afterwards). Set MONGOMS_SYSTEM_BINARY to use one you already have.
import mongoose from 'mongoose'
import request from 'supertest'
import { randomBytes } from 'node:crypto'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Admin } from '../../src/models/Admin.js'
import { AdminSession } from '../../src/models/AdminSession.js'
import { Product } from '../../src/models/Product.js'
import { Order } from '../../src/models/Order.js'
import { hashToken } from '../../src/middleware/adminAuth.js'
import { hashPassword } from '../../src/utils/password.js'
import { setMailOverride } from '../../src/utils/mailer.js'

export const ORIGIN = 'http://localhost:5173'
let server

export async function startDb() {
  server = await MongoMemoryServer.create()
  await mongoose.connect(server.getUri('isaa-test'))
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())) // build the unique indexes the app relies on
}
export async function stopDb() {
  await mongoose.disconnect()
  await server?.stop()
}
export async function resetDb() {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})))
}

// A signed-in admin: returns their document and a ready-to-use cookie.
export async function makeAdmin({ role = 'owner', name = role === 'owner' ? 'Leo' : 'Sam', email = `${name.toLowerCase()}@isaa.in`, password = 'correct horse battery' } = {}) {
  const admin = await Admin.create({ email, name, role, passwordHash: await hashPassword(password), passwordChangedAt: new Date() })
  const token = randomBytes(24).toString('base64url')
  await AdminSession.create({ tokenHash: hashToken(token), admin: admin._id, expiresAt: new Date(Date.now() + 3600_000) })
  return { admin: admin.toObject(), token, password, cookie: `isaa_admin=${token}` }
}

// supertest helpers for the back office: `const api = as(app, owner)`; api.get('/orders'), api.post('/orders/ISA-…/cancel', {})
export function as(app, who) {
  const send = (method) => (path, body = {}) => request(app)[method](`/api/admin${path}`).set('Cookie', who.cookie).set('Origin', ORIGIN).send(body)
  return { get: (path) => request(app).get(`/api/admin${path}`).set('Cookie', who.cookie), post: send('post'), patch: send('patch'), put: send('put'), del: send('delete') }
}

export const mkProduct = (over = {}) => ({
  slug: 'racing', name: 'Racing Championship Oversized Tee', category: 't-shirts', price: 84900, mrp: 124900,
  colors: [{ name: 'Olive', hex: '#55612a' }], sizes: [{ size: 'S', stock: 10 }, { size: 'M', stock: 10 }, { size: 'L', stock: 10 }],
  images: [{ url: 'https://res.cloudinary.com/demo/image/upload/v1/isaa/products/racing.webp', publicId: 'isaa/products/racing', alt: '' }], ...over,
})
export const seedProduct = (over) => Product.create(mkProduct(over)).then((d) => d.toObject())

let n = 0
export async function seedOrder(over = {}) {
  n += 1
  const id = String(n).padStart(6, '0')
  const doc = await Order.create({
    orderNumber: `ISA-261122-T${id.slice(-5)}`,
    status: 'placed', statusHistory: [{ status: 'placed', at: new Date() }],
    items: [{ product: new mongoose.Types.ObjectId(), slug: 'racing', name: 'Racing Championship Oversized Tee', color: 'Olive', size: 'M', qty: 2, price: 84900, mrp: 124900 }],
    customer: { name: 'Asha Raman', phone: '9876543210', email: 'asha@example.com' },
    address: { line1: '12 Lake View Road', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641001' },
    totals: { subtotal: 169800, shipping: 0, codFee: 0, total: 169800 },
    payment: { method: 'cod', status: 'pending' }, ...over,
  })
  return doc.toObject()
}

// Captures every email the app sends. waitFor() is for the fire-and-forget ones (they go out just after the response).
export function useMailbox() {
  const sent = []
  setMailOverride(async (m) => { sent.push(m) })
  const waitFor = async (check = () => sent.length > 0, ms = 2000) => {
    const end = Date.now() + ms
    while (!check()) { if (Date.now() > end) throw new Error('timed out waiting for the email'); await new Promise((r) => setTimeout(r, 10)) }
    return sent
  }
  return { sent, waitFor, stop: () => setMailOverride(null), clear: () => { sent.length = 0 } }
}
