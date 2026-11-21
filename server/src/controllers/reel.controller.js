import { z } from 'zod'
import { Reel } from '../models/Reel.js'
import { serializeReel } from '../utils/serialize.js'

export const reelsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(8),
})

export async function listReels(req, res) {
  const { limit } = req.valid.query
  const docs = await Reel.find({ isActive: true }).sort({ order: 1, createdAt: -1, _id: 1 }).limit(limit).lean()
  res.json({ data: docs.map(serializeReel), meta: { count: docs.length, limit } })
}
