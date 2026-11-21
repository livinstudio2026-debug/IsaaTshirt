import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { validate } from '../middleware/validate.js'
import { noStore, csrfGuard, requireAdmin, requireRole } from '../middleware/adminAuth.js'
import { login, logout, me, loginBody } from '../controllers/admin.auth.controller.js'
import { listOrders, getOrder, changeStatus, cancelOrder, markPaid, addNote, listQuery, numberParam, statusBody, cancelBody, noteBody } from '../controllers/admin.orders.controller.js'
import * as products from '../controllers/admin.products.controller.js'
import { env } from '../config/env.js'

const router = Router()
router.use(noStore, csrfGuard)

// 10 wrong sign-ins per 15 minutes per IP. Successful ones don't count. (Each account also pauses itself after 5 wrong passwords in a row.)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { message: 'Too many sign-in attempts. Try again in 15 minutes.' } },
})

router.post('/auth/login', loginLimiter, validate({ body: loginBody }), login)
router.post('/auth/logout', logout)
router.get('/auth/me', requireAdmin, me)

// Orders. Owner and staff can do all of this, including cancelling. (Owner-only actions use requireRole('owner'): see Products below.)
router.get('/orders', requireAdmin, validate({ query: listQuery }), listOrders)
router.get('/orders/:number', requireAdmin, validate({ params: numberParam }), getOrder)
router.post('/orders/:number/status', requireAdmin, validate({ params: numberParam, body: statusBody }), changeStatus)
router.post('/orders/:number/cancel', requireAdmin, validate({ params: numberParam, body: cancelBody }), cancelOrder)
router.post('/orders/:number/mark-paid', requireAdmin, validate({ params: numberParam }), markPaid)
router.post('/orders/:number/note', requireAdmin, validate({ params: numberParam, body: noteBody }), addNote)

// Products. Owner and staff can see everything, change a size's stock and hide or show a product (the daily jobs).
// Adding, editing details and prices, images, placements and deleting are owner-only.
const owner = requireRole('owner')
router.get('/products', requireAdmin, validate({ query: products.listQuery }), products.listProducts)
router.post('/products', requireAdmin, owner, validate({ body: products.createBody }), products.createProduct)
router.get('/products/:slug', requireAdmin, validate({ params: products.slugParam }), products.getProduct)
router.patch('/products/:slug', requireAdmin, owner, validate({ params: products.slugParam, body: products.updateBody }), products.updateProduct)
router.delete('/products/:slug', requireAdmin, owner, validate({ params: products.slugParam }), products.deleteProduct)
router.post('/products/:slug/stock', requireAdmin, validate({ params: products.slugParam, body: products.stockBody }), products.setStock)
router.post('/products/:slug/visibility', requireAdmin, validate({ params: products.slugParam, body: products.visibilityBody }), products.setVisibility)
router.get('/placements', requireAdmin, products.getPlacements)
router.post('/placements/:name', requireAdmin, owner, validate({ params: products.placementParam, body: products.placementBody }), products.setPlacement)
router.post('/uploads/sign', requireAdmin, owner, validate({ body: products.signBody }), products.signUpload)

export default router
