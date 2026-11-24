import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import routes from './routes/index.js'
import { notFound, errorHandler } from './middleware/errorHandler.js'
import { env } from './config/env.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })) // the API is read by the storefront on another origin
  app.use(cors({
    origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)), // no Origin header = curl / server-to-server
    credentials: true, // the admin cookie; only the origins listed in CLIENT_ORIGIN are ever allowed
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    maxAge: 86400,
  }))
  app.use(compression())
  if (env.NODE_ENV !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'))
  app.use(express.json({ limit: '10kb' }))

  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => env.NODE_ENV === 'test' }))
  app.use('/api', routes)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
