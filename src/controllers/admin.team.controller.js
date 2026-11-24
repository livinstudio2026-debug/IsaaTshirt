import { z } from 'zod'
import { Admin } from '../models/Admin.js'
import { AdminSession } from '../models/AdminSession.js'
import { ApiError } from '../utils/ApiError.js'
import { hashPassword, passwordProblem, verifyPassword } from '../utils/password.js'

// Team accounts, from the back office (what `npm run admin:*` does in the terminal).
//   owner only:  list the team, add staff, disable / enable, set a staff member's password, lift a sign-in pause
//   everyone:    change their own password (POST /account/password)
// Rules that keep the shop from locking itself out: you can't disable yourself, an owner's password is only ever changed by that owner,
// and new accounts made here are staff (more owners are made on purpose, from the terminal).

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not an account id')
export const idParam = z.object({ id: objectId })

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email').max(254))
const password = z.string('Enter a password').max(128, 'Use 128 characters or fewer')

export const createBody = z.object({ name: z.string('Enter a name').trim().min(2, 'Enter a name').max(80), email, password })
export const updateBody = z.object({ name: z.string().trim().min(2, 'Enter a name').max(80).optional(), isActive: z.boolean().optional() }).refine((b) => b.name !== undefined || b.isActive !== undefined, 'Nothing to change')
export const resetBody = z.object({ password })
export const ownPasswordBody = z.object({ currentPassword: z.string('Enter your current password').min(1, 'Enter your current password').max(128), newPassword: password })

const fieldError = (path, message) => new ApiError(400, 'Validation failed', [{ path, message }])

export const serializeMember = (a, { me, sessions = 0 }) => ({
  id: String(a._id),
  name: a.name,
  email: a.email,
  role: a.role,
  isActive: a.isActive !== false,
  isYou: String(a._id) === String(me),
  locked: Boolean(a.lockedUntil && a.lockedUntil > new Date()),
  signedIn: sessions, // browsers currently signed in as this person
  lastLoginAt: a.lastLoginAt ?? null,
  passwordChangedAt: a.passwordChangedAt ?? null,
  createdAt: a.createdAt,
})

async function member(id, me) {
  const a = await Admin.findById(id).lean()
  if (!a) throw ApiError.notFound('That account doesn’t exist.')
  const sessions = await AdminSession.countDocuments({ admin: a._id, expiresAt: { $gt: new Date() } })
  return serializeMember(a, { me, sessions })
}

// GET /api/admin/team
export async function listTeam(req, res) {
  const [admins, live] = await Promise.all([
    Admin.find().sort({ createdAt: 1, _id: 1 }).lean(),
    AdminSession.aggregate([{ $match: { expiresAt: { $gt: new Date() } } }, { $group: { _id: '$admin', n: { $sum: 1 } } }]),
  ])
  const count = new Map(live.map((s) => [String(s._id), s.n]))
  res.json({ data: admins.map((a) => serializeMember(a, { me: req.admin._id, sessions: count.get(String(a._id)) ?? 0 })) })
}

// POST /api/admin/team  { name, email, password }: a new staff account. The owner tells them the password; they can change it under Account.
export async function addMember(req, res) {
  const { name, email: address, password: pw } = req.valid.body
  const problem = passwordProblem(pw, { email: address })
  if (problem) throw fieldError('password', problem)
  if (await Admin.exists({ email: address })) throw new ApiError(409, `${address} already has an account.`, [{ path: 'email', message: 'This email already has an account.' }])
  try {
    const created = await Admin.create({ email: address, name, role: 'staff', passwordHash: await hashPassword(pw), passwordChangedAt: new Date() })
    res.status(201).json({ data: serializeMember(created.toObject(), { me: req.admin._id }) })
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, `${address} already has an account.`, [{ path: 'email', message: 'This email already has an account.' }])
    throw err
  }
}

// PATCH /api/admin/team/:id  { name?, isActive? }
export async function updateMember(req, res) {
  const { id } = req.valid.params
  const { name, isActive } = req.valid.body
  const isMe = String(id) === String(req.admin._id)
  if (isMe && isActive === false) throw new ApiError(409, 'You can’t disable your own account.')
  const set = {}
  if (name !== undefined) set.name = name
  if (isActive !== undefined) set.isActive = isActive
  const updated = await Admin.findOneAndUpdate({ _id: id }, { $set: set }, { new: true }).lean()
  if (!updated) throw ApiError.notFound('That account doesn’t exist.')
  if (isActive === false) await AdminSession.deleteMany({ admin: updated._id }) // signed out everywhere, at once
  res.json({ data: await member(id, req.admin._id) })
}

// POST /api/admin/team/:id/password  { password }: set a staff member's password (they are signed out everywhere)
export async function resetPassword(req, res) {
  const { id } = req.valid.params
  const target = await Admin.findById(id).lean()
  if (!target) throw ApiError.notFound('That account doesn’t exist.')
  if (String(target._id) === String(req.admin._id)) throw new ApiError(409, 'Change your own password under Account.')
  if (target.role === 'owner') throw new ApiError(403, 'An owner’s password can only be changed by that owner.')
  const problem = passwordProblem(req.valid.body.password, { email: target.email })
  if (problem) throw fieldError('password', problem)
  await Admin.updateOne({ _id: id }, { $set: { passwordHash: await hashPassword(req.valid.body.password), passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null } })
  await AdminSession.deleteMany({ admin: id })
  res.json({ data: await member(id, req.admin._id) })
}

// POST /api/admin/team/:id/unlock: lifts the 15-minute pause after too many wrong passwords
export async function unlockMember(req, res) {
  const { id } = req.valid.params
  const { matchedCount } = await Admin.updateOne({ _id: id }, { $set: { failedAttempts: 0, lockedUntil: null } })
  if (!matchedCount) throw ApiError.notFound('That account doesn’t exist.')
  res.json({ data: await member(id, req.admin._id) })
}

// POST /api/admin/account/password  { currentPassword, newPassword }  (any signed-in admin, for themselves)
// Every OTHER browser signed in as them is signed out; this one stays. A wrong current password is a field error (400), not a 401,
// so the screen doesn't treat it as "your session ended".
export async function changeOwnPassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body
  const me = await Admin.findById(req.admin._id).select('+passwordHash').lean()
  if (!me || !(await verifyPassword(currentPassword, me.passwordHash))) throw fieldError('currentPassword', 'That isn’t your current password.')
  if (newPassword === currentPassword) throw fieldError('newPassword', 'Choose a password you haven’t used just now.')
  const problem = passwordProblem(newPassword, { email: me.email })
  if (problem) throw fieldError('newPassword', problem)
  await Admin.updateOne({ _id: me._id }, { $set: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date(), failedAttempts: 0, lockedUntil: null } })
  const { deletedCount } = await AdminSession.deleteMany({ admin: me._id, tokenHash: { $ne: req.adminSession.tokenHash } })
  res.json({ data: { ok: true, signedOutElsewhere: deletedCount } })
}
