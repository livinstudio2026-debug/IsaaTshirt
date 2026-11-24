import '../support/env.js'
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { startDb, stopDb, resetDb, makeAdmin, as } from '../support/db.js'
import { createApp } from '../../src/app.js'
import { Admin } from '../../src/models/Admin.js'
import { AdminSession } from '../../src/models/AdminSession.js'

const app = createApp()
let owner, staff
before(startDb)
after(stopDb)
beforeEach(async () => { await resetDb(); owner = await makeAdmin({ role: 'owner' }); staff = await makeAdmin({ role: 'staff' }) })
const login = (email, password) => request(app).post('/api/admin/auth/login').set('Origin', 'http://localhost:5173').send({ email, password })

test('the team screen is owner-only', async () => {
  await as(app, staff).get('/team').expect(403)
  await as(app, staff).post('/team', { name: 'Eve', email: 'eve@isaa.in', password: 'long enough pw' }).expect(403)
  await as(app, staff).patch(`/team/${owner.admin._id}`, { isActive: false }).expect(403)
  await as(app, staff).post(`/team/${staff.admin._id}/password`, { password: 'another long pw' }).expect(403)
  await request(app).get('/api/admin/team').expect(401)
  const res = await as(app, owner).get('/team').expect(200)
  assert.deepEqual(res.body.data.map((m) => [m.name, m.role, m.isYou, m.signedIn]), [['Leo', 'owner', true, 1], ['Sam', 'staff', false, 1]])
  assert.ok(!JSON.stringify(res.body).includes('passwordHash'))
})

test('add staff: they can sign in at once; weak password, bad email and duplicates are refused', async () => {
  const body = { name: 'Eve Rao', email: 'Eve@Isaa.in', password: 'a long enough pw' }
  const created = (await as(app, owner).post('/team', body).expect(201)).body.data
  assert.deepEqual([created.role, created.email, created.isActive], ['staff', 'eve@isaa.in', true])
  await login('eve@isaa.in', body.password).expect(200)
  assert.equal((await as(app, owner).post('/team', { ...body, email: 'eve@isaa.in' }).expect(409)).body.error.details[0].path, 'email')
  assert.equal((await as(app, owner).post('/team', { ...body, email: 'x@isaa.in', password: 'short' }).expect(400)).body.error.details[0].path, 'password')
  await as(app, owner).post('/team', { ...body, email: 'y@isaa.in', password: 'password123' }).expect(400)
  await as(app, owner).post('/team', { ...body, email: 'nope' }).expect(400)
  await as(app, owner).post('/team', { ...body, email: 'z@isaa.in', role: 'owner' }).expect(201).then((r) => assert.equal(r.body.data.role, 'staff', 'a role in the request is ignored'))
})

test('disable signs the person out at once and blocks sign-in; enable restores it; you cannot disable yourself', async () => {
  await as(app, staff).get('/orders').expect(200)
  const off = await as(app, owner).patch(`/team/${staff.admin._id}`, { isActive: false }).expect(200)
  assert.deepEqual([off.body.data.isActive, off.body.data.signedIn], [false, 0])
  await as(app, staff).get('/orders').expect(401)
  await login('sam@isaa.in', staff.password).expect(401)
  await as(app, owner).patch(`/team/${staff.admin._id}`, { isActive: true }).expect(200)
  await login('sam@isaa.in', staff.password).expect(200)
  await as(app, owner).patch(`/team/${owner.admin._id}`, { isActive: false }).expect(409)
  assert.equal((await Admin.findById(owner.admin._id).lean()).isActive, true)
  assert.equal((await as(app, owner).patch(`/team/${staff.admin._id}`, { name: 'Samuel' }).expect(200)).body.data.name, 'Samuel')
  await as(app, owner).patch(`/team/${staff.admin._id}`, {}).expect(400)
  await as(app, owner).patch(`/team/${'a'.repeat(24)}`, { isActive: false }).expect(404)
  await as(app, owner).patch('/team/nope', { isActive: false }).expect(400)
})

test('owner sets a staff password: old one stops working, sessions end, pause lifted; owners are protected', async () => {
  await Admin.updateOne({ _id: staff.admin._id }, { $set: { failedAttempts: 3, lockedUntil: new Date(Date.now() + 600_000) } })
  assert.equal((await as(app, owner).get('/team')).body.data[1].locked, true)
  await as(app, owner).post(`/team/${staff.admin._id}/password`, { password: 'a brand new password' }).expect(200)
  await as(app, staff).get('/orders').expect(401)
  await login('sam@isaa.in', staff.password).expect(401)
  await login('sam@isaa.in', 'a brand new password').expect(200)
  assert.equal((await as(app, owner).get('/team')).body.data[1].locked, false)
  await as(app, owner).post(`/team/${staff.admin._id}/password`, { password: 'short' }).expect(400)
  await as(app, owner).post(`/team/${owner.admin._id}/password`, { password: 'whatever long pw' }).expect(409) // yourself: use Account
  const second = await makeAdmin({ role: 'owner', name: 'Meera' })
  await as(app, owner).post(`/team/${second.admin._id}/password`, { password: 'whatever long pw' }).expect(403)
  await as(app, second).get('/orders').expect(200)
})

test('unlock lifts a sign-in pause', async () => {
  await Admin.updateOne({ _id: staff.admin._id }, { $set: { lockedUntil: new Date(Date.now() + 600_000) } })
  await login('sam@isaa.in', staff.password).expect(429)
  await as(app, owner).post(`/team/${staff.admin._id}/unlock`).expect(200)
  await login('sam@isaa.in', staff.password).expect(200)
})

test('change own password: needs the current one, signs out other browsers but not this one', async () => {
  const other = `isaa_admin=other-browser`
  const { hashToken } = await import('../../src/middleware/adminAuth.js')
  await AdminSession.create({ tokenHash: hashToken('other-browser'), admin: staff.admin._id, expiresAt: new Date(Date.now() + 3600_000) })
  await request(app).get('/api/admin/orders').set('Cookie', other).expect(200)
  const wrong = await as(app, staff).post('/account/password', { currentPassword: 'not it at all', newPassword: 'a fresh long password' }).expect(400)
  assert.equal(wrong.body.error.details[0].path, 'currentPassword')
  const weak = await as(app, staff).post('/account/password', { currentPassword: staff.password, newPassword: 'short' }).expect(400)
  assert.equal(weak.body.error.details[0].path, 'newPassword')
  await as(app, staff).post('/account/password', { currentPassword: staff.password, newPassword: staff.password }).expect(400)
  const ok = await as(app, staff).post('/account/password', { currentPassword: staff.password, newPassword: 'a fresh long password' }).expect(200)
  assert.equal(ok.body.data.signedOutElsewhere, 1)
  await as(app, staff).get('/orders').expect(200) // this browser stays signed in
  await request(app).get('/api/admin/orders').set('Cookie', other).expect(401)
  await login('sam@isaa.in', staff.password).expect(401)
  await login('sam@isaa.in', 'a fresh long password').expect(200)
  await request(app).post('/api/admin/account/password').set('Origin', 'http://localhost:5173').send({}).expect(401)
})
