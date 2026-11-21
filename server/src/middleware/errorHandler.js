import { ZodError } from 'zod'
import mongoose from 'mongoose'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'

export const notFound = (req, _res, next) => next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`))

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { message: 'Validation failed', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) },
    })
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } })
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { message: 'Invalid JSON body' } })
  if (err.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Request body too large' } })
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: { message: 'Validation failed', details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })) } })
  }
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ error: { message: `Invalid ${err.path}` } })
  // database unreachable (not connected, or the driver can't select a server)
  const dbDown = (err instanceof mongoose.Error && /connection|buffering|before initial/i.test(err.message)) || err.name === 'MongoNetworkError' || err.name === 'MongooseServerSelectionError'
  if (dbDown) {
    return res.status(503).json({ error: { message: 'Service temporarily unavailable' } })
  }
  console.error(err)
  res.status(500).json({ error: { message: env.isProd ? 'Something went wrong' : err.message } })
}
