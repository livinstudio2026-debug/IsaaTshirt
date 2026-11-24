// Admin sign-in without a database: Admin / AdminSession are replaced by in-memory fakes.
import { test, mock, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import request from 'supertest'
import { Admin } from '../src/models/Admin.js'
import { AdminSession } from '../src/models/AdminSession.js'
import { createApp } from '../src/app.js'
import { hashPassword, verifyPassword, passwordProblem } from '../src/utils/password.js'

const app = createApp()
const ORIGIN = 'http://localhost:5173'
const PASSWORD = 'correct horse battery'

let admins, sessions
beforeEach(async () => {
  admins = [{ _id: 'a1', email: 'leo@isaa.in', name: 'Leo', role: 'owner', isActive: true, failedAttempts: 0, lockedUntil: null, lastLoginAt: null, passwordHash: await hashPassword(PASSWORD) }]
  sessions = []
  const strip = (a) => (a ? { ...a } : null)
  mock.method(Admin, 'findOne', (f) => ({ select: () => ({ lean: async () => strip(admins.find((a) => a.email === f.email)) }) }))
  mock.method(Admin, 'findById', (id) => ({ lean: async () => { const a = admins.find((x) => x._id === id); return a ? { ...a, passwordHash: undefined } : null } }))
  mock.method(Admin, 'findOneAndUpdate', (f, u) => ({ lean: async () => { const a = admins.find((x) => x._id === f._id); a.failedAttempts += u.$inc.failedAttempts; return { failedAttempts: a.failedAttempts } } }))
  mock.method(Admin, 'updateOne', async (f, u) => { Object.assign(admins.find((x) => x._id === f._id), u.$set); return {} })
  mock.method(AdminSession, 'create', async (doc) => { sessions.push(doc); return doc })
  mock.method(AdminSession, 'findOne', (f) => ({ lean: async () => sessions.find((s) => s.tokenHash === f.tokenHash) ?? null }))
  mock.method(AdminSession, 'deleteOne', async (f) => { sessions = sessions.filter((s) => s.tokenHash !== f.tokenHash); return {} })
})
afterEach(() => mock.restoreAll())

const login = (body = {}, headers = {}) => request(app).post('/api/admin/auth/login').set('Origin', ORIGIN).set(headers).send({ email: 'leo@isaa.in', password: PASSWORD, ...body })
const cookieOf = (res) => res.headers['set-cookie']?.find((c) => c.startsWith('isaa_admin='))
const sessionCookie = (res) => cookieOf(res).split(';')[0]

test('signing in sets an httpOnly cookie scoped to /api/admin and never returns the hash', async () => {
  const res = await login().expect(200)
  const c = cookieOf(res)
  assert.match(c, /HttpOnly/i)
  assert.match(c, /SameSite=Lax/i)
  assert.match(c, /Path=\/api\/admin/i)
  assert.doesNotMatch(c, /Max-Age|Expires/i, 'without "remember" the cookie ends with the browser session')
  assert.deepEqual(Object.keys(res.body.data).sort(), ['email', 'id', 'lastLoginAt', 'name', 'role'])
  assert.equal(res.headers['cache-control'], 'no-store')
  // only a hash of the token is stored
  const token = decodeURIComponent(sessionCookie(res).split('=')[1])
  assert.equal(sessions.length, 1)
  assert.notEqual(sessions[0].tokenHash, token)
  assert.equal(sessions[0].tokenHash.length, 64)
})

test('"keep me signed in" gives a 7 day cookie and a 7 day session', async () => {
  const res = await login({ remember: true }).expect(200)
  assert.match(cookieOf(res), /Max-Age=604800/)
  assert.ok(Math.abs(sessions[0].expiresAt - Date.now() - 7 * 86400_000) < 5000)
})

test('email is case-insensitive and trimmed', async () => {
  await login({ email: '  LEO@Isaa.in ' }).expect(200)
})

test('wrong password and unknown email give the same answer and no cookie', async () => {
  const wrong = await login({ password: 'not the password' }).expect(401)
  const unknown = await login({ email: 'nobody@isaa.in' }).expect(401)
  assert.equal(wrong.body.error.message, 'Incorrect email or password.')
  assert.deepEqual(wrong.body, unknown.body)
  assert.equal(cookieOf(wrong), undefined)
  assert.equal(cookieOf(unknown), undefined)
  assert.equal(sessions.length, 0)
})

test('disabled accounts cannot sign in', async () => {
  admins[0].isActive = false
  await login().expect(401)
})

test('malformed bodies are rejected before any lookup', async () => {
  await login({ email: 'not-an-email' }).expect(400)
  await login({ password: '' }).expect(400)
  await login({ password: 'x'.repeat(200) }).expect(400)
})

test('five wrong passwords in a row pause the account, even for the right password', async () => {
  for (let i = 0; i < 4; i++) await login({ password: 'nope nope nope' }).expect(401)
  const fifth = await login({ password: 'nope nope nope' }).expect(429)
  assert.match(fifth.body.error.message, /15 minutes/)
  const right = await login().expect(429)
  assert.match(right.body.error.message, /minute/)
  assert.equal(sessions.length, 0)
  admins[0].lockedUntil = new Date(Date.now() - 1000) // lock expired
  await login().expect(200)
  assert.equal(admins[0].failedAttempts, 0, 'a successful sign-in resets the counter')
})

test('/me needs a valid session', async () => {
  await request(app).get('/api/admin/auth/me').expect(401)
  await request(app).get('/api/admin/auth/me').set('Cookie', 'isaa_admin=garbage').expect(401)
  const res = await login().expect(200)
  const me = await request(app).get('/api/admin/auth/me').set('Cookie', sessionCookie(res)).expect(200)
  assert.equal(me.body.data.email, 'leo@isaa.in')
  assert.equal(me.headers['cache-control'], 'no-store')
})

test('expired sessions and disabled accounts stop working immediately', async () => {
  const res = await login().expect(200)
  const cookie = sessionCookie(res)
  admins[0].isActive = false
  const blocked = await request(app).get('/api/admin/auth/me').set('Cookie', cookie).expect(401)
  assert.match(blocked.headers['set-cookie'].join(), /isaa_admin=;/)
  admins[0].isActive = true
  await request(app).get('/api/admin/auth/me').set('Cookie', cookie).expect(200)
  sessions[0].expiresAt = new Date(Date.now() - 1)
  await request(app).get('/api/admin/auth/me').set('Cookie', cookie).expect(401)
})

test('signing out deletes the session server-side and clears the cookie', async () => {
  const res = await login().expect(200)
  const cookie = sessionCookie(res)
  const out = await request(app).post('/api/admin/auth/logout').set('Origin', ORIGIN).set('Cookie', cookie).send({}).expect(200)
  assert.match(out.headers['set-cookie'].join(), /isaa_admin=;/)
  assert.equal(sessions.length, 0)
  await request(app).get('/api/admin/auth/me').set('Cookie', cookie).expect(401, /sign in/)
})

test('a new sign-in replaces the session that came with the request (no fixation)', async () => {
  const first = await login().expect(200)
  const second = await login({}, { Cookie: sessionCookie(first) }).expect(200)
  assert.notEqual(sessionCookie(first), sessionCookie(second))
  assert.equal(sessions.length, 1)
})

test('writes from another site or without JSON are refused (CSRF)', async () => {
  await request(app).post('/api/admin/auth/login').set('Origin', 'https://evil.example').send({ email: 'leo@isaa.in', password: PASSWORD }).expect(403)
  await request(app).post('/api/admin/auth/login').set('Origin', ORIGIN).set('Content-Type', 'text/plain').send('email=leo@isaa.in').expect(415)
  await request(app).post('/api/admin/auth/logout').set('Origin', 'https://evil.example').send({}).expect(403)
})

test('CORS allows credentials for the storefront origin only', async () => {
  const ok = await request(app).options('/api/admin/auth/login').set('Origin', ORIGIN).set('Access-Control-Request-Method', 'POST')
  assert.equal(ok.headers['access-control-allow-credentials'], 'true')
  assert.equal(ok.headers['access-control-allow-origin'], ORIGIN)
  const bad = await request(app).options('/api/admin/auth/login').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST')
  assert.equal(bad.headers['access-control-allow-origin'], undefined)
})

test('password hashing: salted, verifiable, and the policy rejects weak ones', async () => {
  const a = await hashPassword(PASSWORD), b = await hashPassword(PASSWORD)
  assert.notEqual(a, b)
  assert.ok(await verifyPassword(PASSWORD, a))
  assert.ok(!(await verifyPassword('other password!', a)))
  assert.ok(!(await verifyPassword(PASSWORD, 'garbage')))
  assert.ok(!(await verifyPassword(PASSWORD, undefined)))
  assert.ok(passwordProblem('short'))
  assert.ok(passwordProblem('Password123'))
  assert.ok(passwordProblem('leoleoleo-2026', { email: 'leoleo@isaa.in' }))
  assert.equal(passwordProblem(PASSWORD, { email: 'leo@isaa.in' }), null)
})
