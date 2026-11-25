import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { Admin } from '../models/Admin.js'
import { AdminSession } from '../models/AdminSession.js'
import { ApiError } from '../utils/ApiError.js'
import { verifyPassword, dummyVerify } from '../utils/password.js'
import { COOKIE, SESSION_HOURS, REMEMBER_DAYS, cookieOptions, hashToken, readCookie } from '../middleware/adminAuth.js'

const MAX_FAILURES = 5 // wrong passwords in a row before the account pauses
const LOCK_MINUTES = 15
const HOUR = 3600_000

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().min(1).max(128),
  remember: z.boolean().optional().default(false),
})

const publicAdmin = (a) => ({ id: String(a._id), name: a.name, email: a.email, role: a.role, lastLoginAt: a.lastLoginAt ?? null })

export async function login(req, res) {
  const { email, password, remember } = req.valid.body
  const admin = await Admin.findOne({ email }).select('+passwordHash').lean()

  if (!admin || !admin.isActive) {
    await dummyVerify(password) // same time as a real check
    throw new ApiError(401, 'Incorrect email or password.')
  }
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const mins = Math.max(1, Math.ceil((admin.lockedUntil - Date.now()) / 60_000))
    throw new ApiError(429, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`)
  }

  if (!(await verifyPassword(password, admin.passwordHash))) {
    const { failedAttempts = 0 } = (await Admin.findOneAndUpdate({ _id: admin._id }, { $inc: { failedAttempts: 1 } }, { new: true, projection: { failedAttempts: 1 } }).lean()) ?? {}
    if (failedAttempts >= MAX_FAILURES) {
      await Admin.updateOne({ _id: admin._id }, { $set: { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000), failedAttempts: 0 } })
      throw new ApiError(429, `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`)
    }
    throw new ApiError(401, 'Incorrect email or password.')
  }

  // a fresh random token on every sign-in (never reuse one that arrived with the request)
  const previous = readCookie(req, COOKIE)
  if (previous) await AdminSession.deleteOne({ tokenHash: hashToken(previous) })

  const token = randomBytes(32).toString('base64url')
  const ttl = remember ? REMEMBER_DAYS * 24 * HOUR : SESSION_HOURS * HOUR
  const now = new Date()
  await AdminSession.create({ tokenHash: hashToken(token), admin: admin._id, expiresAt: new Date(now.getTime() + ttl), ip: req.ip, userAgent: (req.get('user-agent') ?? '').slice(0, 200) })
  await Admin.updateOne({ _id: admin._id }, { $set: { failedAttempts: 0, lockedUntil: null, lastLoginAt: now, lastLoginIp: req.ip } })

  // "remember" = a cookie that outlives the browser; otherwise it dies when the browser closes
  res.cookie(COOKIE, token, { ...cookieOptions(), ...(remember ? { maxAge: ttl } : {}) })
  res.json({ data: publicAdmin({ ...admin, lastLoginAt: now }) })
}

export async function logout(req, res) {
  const token = readCookie(req, COOKIE)
  if (token) await AdminSession.deleteOne({ tokenHash: hashToken(token) })
  res.clearCookie(COOKIE, cookieOptions())
  res.json({ data: { ok: true } })
}

export const me = (req, res) => res.json({ data: publicAdmin(req.admin) })
