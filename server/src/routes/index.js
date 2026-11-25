import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { validate } from '../middleware/validate.js'
import { cache, memoryCache, purgeOnWrite } from '../middleware/cache.js'
import { listProducts, getProduct, listQuery, slugParam } from '../controllers/product.controller.js'
import { listReels, reelsQuery } from '../controllers/reel.controller.js'
import { createContact, contactBody } from '../controllers/contact.controller.js'
import { subscribe, newsletterBody } from '../controllers/newsletter.controller.js'
import { createOrder, trackOrder, getStoreConfig, orderBody, trackBody } from '../controllers/order.controller.js'
import adminRoutes from './admin.js'
import { dbState } from '../config/db.js'
import { env } from '../config/env.js'

const router = Router()

router.get('/health', (_req, res) => res.json({ status: 'ok', uptime: Math.round(process.uptime()), db: dbState() }))

// Public catalogue: short edge cache + a server copy that every write throws away (see middleware/cache.js)
router.use(['/orders', '/admin'], purgeOnWrite) // checkout takes stock; every back-office write can change what the shop shows
router.get('/products', cache(), memoryCache(), validate({ query: listQuery }), listProducts)
router.get('/products/:slug', cache(), memoryCache(), validate({ params: slugParam }), getProduct)

router.get('/reels', cache(), memoryCache(), validate({ query: reelsQuery }), listReels)

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
const limiter = (limit, message) => rateLimit({
  windowMs: 60 * 60 * 1000,
  limit,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { message } },
})

router.get('/store-config', cache(10), getStoreConfig) // fees and the COD threshold are edited in the back office, so the edge copy stays short
// 10 orders per hour per IP; order look-ups are limited harder because they take an email guess
router.post('/orders', limiter(10, 'Too many orders from this device. Please try again later.'), validate({ body: orderBody }), createOrder)
router.post('/orders/track', limiter(30, 'Too many look-ups. Please try again later.'), validate({ body: trackBody }), trackOrder)

router.post('/newsletter', newsletterLimiter, validate({ body: newsletterBody }), subscribe)

// back office (sign-in required; see middleware/adminAuth.js)
router.use('/admin', adminRoutes)

export default router
