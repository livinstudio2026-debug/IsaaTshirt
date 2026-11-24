import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { validate } from '../middleware/validate.js'
import { noStore, csrfGuard, requireAdmin, requireRole } from '../middleware/adminAuth.js'
import { login, logout, me, loginBody } from '../controllers/admin.auth.controller.js'
import { listOrders, getOrder, changeStatus, cancelOrder, markPaid, addNote, resendEmail, listQuery, numberParam, statusBody, cancelBody, noteBody, resendBody } from '../controllers/admin.orders.controller.js'
import * as products from '../controllers/admin.products.controller.js'
import * as inbox from '../controllers/admin.inbox.controller.js'
import { getDashboard } from '../controllers/admin.dashboard.controller.js'
import { getDiagnostics } from '../controllers/admin.diagnostics.controller.js'
import * as reels from '../controllers/admin.reels.controller.js'
import * as team from '../controllers/admin.team.controller.js'
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
router.post('/orders/:number/resend-email', requireAdmin, validate({ params: numberParam, body: resendBody }), resendEmail)

// Products. Owner and staff can see everything, change a size's stock and hide or show a product (the daily jobs).
// Adding, editing details and prices, images, placements and deleting are owner-only.
const owner = requireRole('owner')
router.get('/products', requireAdmin, validate({ query: products.listQuery }), products.listProducts)
router.post('/products', requireAdmin, owner, validate({ body: products.createBody }), products.createProduct)
router.get('/products/:slug', requireAdmin, validate({ params: products.slugParam }), products.getProduct)
router.patch('/products/:slug', requireAdmin, owner, validate({ params: products.slugParam, body: products.updateBody }), products.updateProduct)
router.delete('/products/:slug', requireAdmin, owner, validate({ params: products.slugParam }), products.deleteProduct)
router.get('/products/:slug/history', requireAdmin, validate({ params: products.slugParam, query: products.historyQuery }), products.getHistory)
router.post('/products/:slug/stock', requireAdmin, validate({ params: products.slugParam, body: products.stockBody }), products.setStock)
router.post('/products/:slug/visibility', requireAdmin, validate({ params: products.slugParam, body: products.visibilityBody }), products.setVisibility)
router.get('/placements', requireAdmin, products.getPlacements)
router.post('/placements/:name', requireAdmin, owner, validate({ params: products.placementParam, body: products.placementBody }), products.setPlacement)
router.post('/uploads/sign', requireAdmin, owner, validate({ body: products.signBody }), products.signUpload)

// Dashboard: the Overview screen in one request. Owner and staff.
router.get('/dashboard', requireAdmin, getDashboard)

// Inbox. Owner and staff read messages and subscribers and mark messages read / replied.
// Deleting a message and downloading the subscriber list (customers' emails) are owner-only.
router.get('/inbox/unread', requireAdmin, inbox.inboxUnread)
router.get('/messages', requireAdmin, validate({ query: inbox.messagesQuery }), inbox.listMessages)
router.post('/messages/:id/status', requireAdmin, validate({ params: inbox.idParam, body: inbox.messageStatusBody }), inbox.setMessageStatus)
router.delete('/messages/:id', requireAdmin, owner, validate({ params: inbox.idParam }), inbox.deleteMessage)
router.get('/subscribers', requireAdmin, validate({ query: inbox.subscribersQuery }), inbox.listSubscribers)
router.get('/subscribers/export', requireAdmin, owner, inbox.exportSubscribers)

// Deployment check (owner): what the server sees. Used by `npm run check:deploy` and the Team screen.
router.get('/diagnostics', requireAdmin, owner, getDiagnostics)

// Instagram reels. Owner and staff see them and hide / show one; adding, editing, reordering and deleting are owner-only.
router.get('/reels', requireAdmin, reels.listReels)
router.post('/reels', requireAdmin, owner, validate({ body: reels.createBody }), reels.createReel)
router.post('/reels/order', requireAdmin, owner, validate({ body: reels.orderBody }), reels.reorderReels)
router.patch('/reels/:id', requireAdmin, owner, validate({ params: reels.idParam, body: reels.updateBody }), reels.updateReel)
router.post('/reels/:id/visibility', requireAdmin, validate({ params: reels.idParam, body: reels.visibilityBody }), reels.setVisibility)
router.delete('/reels/:id', requireAdmin, owner, validate({ params: reels.idParam }), reels.deleteReel)

// Team (owner only) and your own password (everyone). Wrong current passwords count against a limit, like sign-in does.
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { message: 'Too many attempts. Try again in 15 minutes.' } },
})
router.get('/team', requireAdmin, owner, team.listTeam)
router.post('/team', requireAdmin, owner, validate({ body: team.createBody }), team.addMember)
router.patch('/team/:id', requireAdmin, owner, validate({ params: team.idParam, body: team.updateBody }), team.updateMember)
router.post('/team/:id/password', requireAdmin, owner, validate({ params: team.idParam, body: team.resetBody }), team.resetPassword)
router.post('/team/:id/unlock', requireAdmin, owner, validate({ params: team.idParam }), team.unlockMember)
router.post('/account/password', requireAdmin, passwordLimiter, validate({ body: team.ownPasswordBody }), team.changeOwnPassword)

export default router
