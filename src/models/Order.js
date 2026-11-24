import mongoose from 'mongoose'
import { STATES } from '../config/store.js'

const { Schema } = mongoose

export const ORDER_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled']
export const PAYMENT_METHODS = ['cod', 'online']
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded']

export { newOrderNumber } from '../utils/orderNumber.js' // ISA-YYMMDD-XXXXXX, see utils/orderNumber.js

const paise = { type: Number, required: true, min: 0, validate: Number.isInteger }

const itemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    slug: { type: String, required: true },
    name: { type: String, required: true }, // snapshots: the order keeps reading right even if the product is edited later
    image: { type: String, default: '' },
    color: { type: String, default: '' },
    size: { type: String, required: true },
    qty: { type: Number, required: true, min: 1, validate: Number.isInteger },
    price: paise, // unit price at the time of purchase
    mrp: paise,
  },
  { _id: false },
)

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String }, // a double-clicked / retried submit returns the same order
    status: { type: String, enum: ORDER_STATUSES, default: 'placed', index: true },
    statusHistory: {
      type: [new Schema({ status: { type: String, enum: ORDER_STATUSES }, at: { type: Date, default: Date.now }, note: String }, { _id: false })],
      default: [],
    },
    items: { type: [itemSchema], validate: { validator: (v) => v.length > 0, message: 'an order needs at least one item' } },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true, index: true },
    },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true, default: '' },
      landmark: { type: String, trim: true, default: '' },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, enum: STATES },
      pincode: { type: String, required: true, match: /^[1-9]\d{5}$/ },
    },
    notes: { type: String, trim: true, default: '' },
    totals: { subtotal: paise, shipping: paise, codFee: paise, total: paise },
    payment: {
      method: { type: String, enum: PAYMENT_METHODS, required: true },
      status: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
      paidAt: Date,
    },
    tracking: { carrier: String, number: String, url: String },
    emails: { customer: { type: Boolean, default: false }, owner: { type: Boolean, default: false }, shipped: { type: Boolean, default: false }, delivered: { type: Boolean, default: false }, cancelled: { type: Boolean, default: false } },
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, trim: true, default: '' },
    // Back-office audit trail: every change by a team member, with who and when. Never shown to customers.
    history: {
      type: [new Schema({ at: { type: Date, default: Date.now }, by: { id: String, name: String }, action: { type: String, required: true }, from: String, to: String, note: { type: String, default: '' } }, { _id: false })],
      default: [],
    },
    stockReleased: { type: Boolean, default: false }, // set once a cancelled order's stock has been put back
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
)

orderSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } })
orderSchema.index({ createdAt: -1 })
orderSchema.index({ 'customer.phone': 1 })

export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema)
