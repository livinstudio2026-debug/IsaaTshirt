import { createHash } from 'node:crypto'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { Admin } from '../models/Admin.js'
import { AdminSession } from '../models/AdminSession.js'

export const COOKIE = 'isaa_admin'
export const SESSION_HOURS = 12 // a normal sign-in
export const REMEMBER_DAYS = 7 // "keep me signed in"

export const hashToken = (token) => createHash('sha256').update(token).digest('hex')

// The cookie is only sent to /api/admin, is invisible to JavaScript, and (in production) only travels over HTTPS.
// SameSite=Lax suits a storefront and API on the same site; ADMIN_COOKIE_SAMESITE=none is for a storefront on a different site.
export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd || env.ADMIN_COOKIE_SAMESITE === 'none',
  sameSite: env.ADMIN_COOKIE_SAMESITE,
  path: '/api/admin',
})

export function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()) } catch { return null }
    }
  }
  return null
}

// Admin responses contain private data: never let a browser or CDN keep them.
export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store')
  res.vary('Origin')
  next()
}

// Cookies are sent automatically, so every write must prove it came from our own pages:
// the Origin (when the browser sends one) must be an allowed storefront, and the body must be JSON,
// which a cross-site form can't send and a cross-site script can't send without CORS approval.
export function csrfGuard(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (origin && !env.clientOrigins.includes(origin)) return next(new ApiError(403, 'Request blocked'))
  if (!(req.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return next(new ApiError(415, 'Send JSON'))
  next()
}

// Resolves the signed-in admin from the cookie, or answers 401.
export async function requireAdmin(req, res, next) {
  try {
    const token = readCookie(req, COOKIE)
    const session = token ? await AdminSession.findOne({ tokenHash: hashToken(token) }).lean() : null
    const admin = session && session.expiresAt > new Date() ? await Admin.findById(session.admin).lean() : null
    if (!admin || !admin.isActive) {
      if (token) res.clearCookie(COOKIE, cookieOptions())
      return next(new ApiError(401, 'Please sign in.'))
    }
    req.admin = admin
    req.adminSession = session
    next()
  } catch (err) { next(err) }
}

// Role gate, used after requireAdmin: requireRole('owner') lets only owners through, requireRole('owner', 'staff') both.
// Orders are open to both roles (staff can pack, ship, cancel and mark paid). Products: staff can change stock and hide / show;
// adding, editing details and prices, images, placements and deleting are owner-only.
export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.admin?.role) ? next() : next(new ApiError(403, 'Your account can’t do that. Ask the owner.'))
