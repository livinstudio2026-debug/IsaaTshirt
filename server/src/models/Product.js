import mongoose from 'mongoose'

export const CATEGORIES = ['t-shirts', 'hoodies', 'bottoms', 'accessories']
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE', '28', '30', '32', '34', '36'] // letters for tops, waist inches for jeans

const { Schema } = mongoose
const paise = { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: '{PATH} must be a whole number of paise' } }

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    category: { type: String, required: true, enum: CATEGORIES },
    price: paise,
    mrp: paise,
    // one product, many colours and sizes (no separate record per combination)
    colors: {
      type: [new Schema({ name: { type: String, required: true, trim: true }, hex: { type: String, required: true, match: /^#[0-9a-f]{6}$/i } }, { _id: false })],
      default: [],
    },
    sizes: {
      type: [new Schema({ size: { type: String, required: true, enum: SIZES }, stock: { type: Number, default: 0, min: 0, validate: Number.isInteger } }, { _id: false })],
      default: [],
    },
    images: {
      type: [new Schema({ url: { type: String, required: true, trim: true }, publicId: { type: String, trim: true }, alt: { type: String, default: '' } }, { _id: false })],
      validate: { validator: (v) => v.length > 0, message: 'a product needs at least one image' },
    },
    isLimited: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }, // false = hidden from the shop without deleting
    // position on the home page rails; null = not shown there
    heroOrder: { type: Number, default: null },
    featuredOrder: { type: Number, default: null },
    bestSellerOrder: { type: Number, default: null }, // Best Sellers shelf, in this order
    newArrivalOrder: { type: Number, default: null }, // New Arrivals shelf, in this order
  },
  { timestamps: true },
)

productSchema.pre('validate', function () {
  if (this.mrp < this.price) this.invalidate('mrp', 'mrp must be greater than or equal to price')
})

productSchema.index({ isActive: 1, category: 1, createdAt: -1 })
productSchema.index({ isActive: 1, isBestSeller: 1 })
productSchema.index({ isActive: 1, isNewArrival: 1 })
productSchema.index({ isActive: 1, heroOrder: 1 })
productSchema.index({ isActive: 1, featuredOrder: 1 })
productSchema.index({ isActive: 1, bestSellerOrder: 1 })
productSchema.index({ isActive: 1, newArrivalOrder: 1 })

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema)
