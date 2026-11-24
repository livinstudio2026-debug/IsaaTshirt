import { z } from 'zod'
import { Reel, INSTAGRAM_URL } from '../models/Reel.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeAdminReel } from '../utils/serialize.js'
import { REEL_FOLDER } from '../config/cloudinary.js'
import { env } from '../config/env.js'

// The Instagram wall on the home page, managed from the back office.
//   owner + staff: see every reel, hide / show one
//   owner only:    add (upload the poster and an optional video), edit, reorder, delete
// Pictures and videos go from the browser straight to Cloudinary (see POST /uploads/sign); this API only checks they came from there.

const MAX_REELS = 24
export const WALL_SHOWS = 8 // the home page shows the first 8 visible reels (GET /api/reels?limit=8)
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a reel id')
export const idParam = z.object({ id: objectId })

const file = z.object({ url: z.string().trim().min(1).max(600), publicId: z.string().trim().min(1).max(200) })
const fields = z.object({
  url: z.string('Paste the Instagram link').trim().regex(INSTAGRAM_URL, 'Paste the full link to the reel, like https://www.instagram.com/reel/…/'),
  poster: file,
  video: file.nullable(), // null removes the video
  caption: z.string().trim().max(200),
  tag: z.string().trim().max(30, 'Keep the tag to 30 characters'),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a colour').nullable(),
  isActive: z.boolean(),
})
export const createBody = fields.partial({ video: true, caption: true, tag: true, accent: true, isActive: true })
export const updateBody = fields.partial().refine((b) => Object.keys(b).length > 0, 'Nothing to change')
export const visibilityBody = z.object({ isActive: z.boolean() })
export const orderBody = z.object({ ids: z.array(objectId).min(1).max(100) })

const fieldError = (path, message) => new ApiError(400, 'Validation failed', [{ path, message }])
const SORT = { order: 1, createdAt: -1, _id: 1 } // the same order the public wall uses

// A new picture / video must be one of our own Cloudinary uploads (signed upload into isaa/reels), so the wall can't point at someone else's file.
function checkUpload(f, resource, path) {
  let u
  try { u = new URL(f.url) } catch { throw fieldError(path, 'Upload this file again') }
  const cloud = env.CLOUDINARY_CLOUD_NAME
  const [, name, kind, verb] = u.pathname.split('/') // /<cloud name>/<image|video>/upload/…
  const ok = u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && (!cloud || name === cloud) && kind === resource && verb === 'upload' &&
    f.publicId.startsWith(`${REEL_FOLDER}/`) && u.pathname.includes(`/${f.publicId}`)
  if (!ok) throw fieldError(path, 'Upload this file again')
}

async function load(id) {
  const doc = await Reel.findById(id).lean()
  if (!doc) throw ApiError.notFound('Reel not found')
  return doc
}
const listAll = async () => (await Reel.find({}).sort(SORT).lean()).map(serializeAdminReel)

// GET /api/admin/reels  -> { data: [reel], meta: { total, wallShows, max } }  (hidden ones too, in wall order)
export async function listReels(_req, res) {
  const data = await listAll()
  res.json({ data, meta: { total: data.length, wallShows: WALL_SHOWS, max: MAX_REELS } })
}

// POST /api/admin/reels  (owner): goes to the end of the wall
export async function createReel(req, res) {
  const b = req.valid.body
  if ((await Reel.countDocuments({})) >= MAX_REELS) throw new ApiError(409, `The wall holds up to ${MAX_REELS} reels. Delete one first.`)
  checkUpload(b.poster, 'image', 'poster')
  if (b.video) checkUpload(b.video, 'video', 'video')
  const top = await Reel.findOne({}, { order: 1 }).sort({ order: -1 }).lean()
  const created = await Reel.create({
    url: b.url,
    poster: { url: b.poster.url, publicId: b.poster.publicId },
    ...(b.video ? { videoUrl: b.video.url, videoPublicId: b.video.publicId } : {}),
    caption: b.caption ?? '',
    tag: b.tag ?? '',
    ...(b.accent ? { accent: b.accent } : {}),
    order: (top?.order ?? 0) + 1,
    isActive: b.isActive ?? true,
  })
  res.status(201).json({ data: serializeAdminReel(created.toObject()) })
}

// PATCH /api/admin/reels/:id  (owner): only the fields sent change
export async function updateReel(req, res) {
  const { id } = req.valid.params
  const b = req.valid.body
  const current = await load(id)
  const $set = {}
  const $unset = {}
  for (const k of ['url', 'caption', 'tag', 'isActive']) if (b[k] !== undefined) $set[k] = b[k]
  if (b.accent !== undefined) b.accent ? ($set.accent = b.accent) : ($unset.accent = '')
  if (b.poster && b.poster.url !== current.poster.url) { checkUpload(b.poster, 'image', 'poster'); $set.poster = { url: b.poster.url, publicId: b.poster.publicId } }
  if (b.video === null) { $unset.videoUrl = ''; $unset.videoPublicId = '' }
  else if (b.video && b.video.url !== current.videoUrl) { checkUpload(b.video, 'video', 'video'); $set.videoUrl = b.video.url; $set.videoPublicId = b.video.publicId }
  const update = { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) }
  if (!Object.keys(update).length) return res.json({ data: serializeAdminReel(current) })
  const updated = await Reel.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean()
  if (!updated) throw ApiError.notFound('Reel not found')
  res.json({ data: serializeAdminReel(updated) })
}

// POST /api/admin/reels/:id/visibility  { isActive }  (owner and staff)
export async function setVisibility(req, res) {
  const updated = await Reel.findByIdAndUpdate(req.valid.params.id, { $set: { isActive: req.valid.body.isActive } }, { new: true }).lean()
  if (!updated) throw ApiError.notFound('Reel not found')
  res.json({ data: serializeAdminReel(updated) })
}

// POST /api/admin/reels/order  { ids: [...] }  (owner): the list is the new order; reels not listed (added a moment ago by someone else) go after them
export async function reorderReels(req, res) {
  const { ids } = req.valid.body
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'A reel can only be listed once')
  const all = await Reel.find({}, '_id').sort(SORT).lean()
  const known = new Set(all.map((r) => String(r._id)))
  const unknown = ids.filter((id) => !known.has(id))
  if (unknown.length) throw ApiError.notFound('One of those reels no longer exists. Reload the page.')
  const final = [...ids, ...all.map((r) => String(r._id)).filter((id) => !ids.includes(id))]
  await Reel.bulkWrite(final.map((id, i) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: i + 1 } } } })))
  const data = await listAll()
  res.json({ data, meta: { total: data.length, wallShows: WALL_SHOWS, max: MAX_REELS } })
}

// DELETE /api/admin/reels/:id  (owner). The pictures stay in Cloudinary (nothing here deletes files).
export async function deleteReel(req, res) {
  const gone = await Reel.findByIdAndDelete(req.valid.params.id).lean()
  if (!gone) throw ApiError.notFound('Reel not found')
  res.json({ data: { id: String(gone._id), deleted: true } })
}
