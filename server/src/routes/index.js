import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { validate } from '../middleware/validate.js'
import { cache } from '../middleware/cache.js'
import { listProducts, getProduct, listQuery, slugParam } from '../controllers/product.controller.js'
import { listReels, reelsQuery } from '../controllers/reel.controller.js'
import { createContact, contactBody } from '../controllers/contact.controller.js'
import { subscribe, newsletterBody } from '../controllers/newsletter.controller.js'
import { dbState } from '../config/db.js'
import { env } from '../config/env.js'

const router = Router()

router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()), db: dbState() }))

router.get('/products', cache(60), validate({ query: listQuery }), listProducts)
router.get('/products/:slug', cache(60), validate({ params: slugParam }), getProduct)

router.get('/reels', cache(60), validate({ query: reelsQuery }), listReels)

// 5 messages per hour per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { message: 'Too many messages. Please try again later.' } },
})
router.post('/contact', contactLimiter, validate({ body: contactBody }), createContact)

// 10 sign-ups per hour per IP
const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { message: 'Too many attempts. Please try again later.' } },
})
router.post('/newsletter', newsletterLimiter, validate({ body: newsletterBody }), subscribe)

export default router
