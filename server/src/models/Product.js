import mongoose from 'mongoose'

export const CATEGORIES = ['t-shirts', 'hoodies', 'bottoms', 'accessories']
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'FREE', '28', '30', '32', '34', '36'] // letters for tops, waist inches for jeans

const { Schema } = mongoose
const picture = { url: { type: String, trim: true }, publicId: { type: String, trim: true }, alt: { type: String, default: '' } }
const paise = { type: Number, required: true, min: 0, validate: { validator: Number.isInteger, message: '{PATH} must be a whole number of paise' } }

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    tagline: { type: String, trim: true, maxlength: 40, default: '' }, // this product's own line under its name; empty = the storefront shows its category's default
    category: { type: String, required: true, enum: CATEGORIES },
    price: paise,
    mrp: paise,
    // one product, many colours and sizes (no separate record per combination).
    // Every colour has its own HERO picture (a transparent cut-out): the one shown in lists and first on the product page.
    colors: {
      type: [new Schema({
        name: { type: String, required: true, trim: true },
        hex: { type: String, required: true, match: /^#[0-9a-f]{6}$/i },
        hero: { type: new Schema(picture, { _id: false }), default: undefined },
      }, { _id: false })],
      default: [],
    },
    sizes: {
      type: [new Schema({ size: { type: String, required: true, enum: SIZES }, stock: { type: Number, default: 0, min: 0, validate: Number.isInteger } }, { _id: false })],
      default: [],
    },
    // The pictures every colour shares, after its hero: images[0] is the back shot, the rest are details. May be empty.
    // (Products saved before per-colour heroes keep their front shot in images[0]: see pictures() in utils/serialize.js.)
    images: {
      type: [new Schema({ url: { type: String, required: true, trim: true }, publicId: { type: String, trim: true }, alt: { type: String, default: '' } }, { _id: false })],
      default: [],
    },
    // Size guide: either a shared chart (the slug of a SizeChart; '' = none) or this product's own table, which wins when it has one.
    sizeChart: { type: String, trim: true, lowercase: true, default: '' },
    customChart: {
      type: new Schema({ columns: [{ type: String, trim: true, maxlength: 24 }], rows: [new Schema({ size: { type: String, enum: SIZES }, values: [Number] }, { _id: false })] }, { _id: false }),
      default: undefined,
    },
    // How it fits: a short note ("Oversized, drop shoulder") and the model in the photos (height in cm, size worn). All optional.
    fit: {
      type: new Schema({ note: { type: String, trim: true, maxlength: 160, default: '' }, modelHeightCm: { type: Number, default: null }, modelSize: { type: String, trim: true, maxlength: 8, default: '' } }, { _id: false }),
      default: undefined,
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
  // every colour needs a hero picture (an older product may still carry its front shot in images[0] instead)
  if (this.colors.some((c) => !c.hero?.url) && !this.images.length) this.invalidate('colors', 'every colour needs a hero picture')
})

productSchema.index({ isActive: 1, category: 1, createdAt: -1 })
productSchema.index({ isActive: 1, isBestSeller: 1 })
productSchema.index({ isActive: 1, isNewArrival: 1 })
productSchema.index({ isActive: 1, heroOrder: 1 })
productSchema.index({ isActive: 1, featuredOrder: 1 })
productSchema.index({ isActive: 1, bestSellerOrder: 1 })
productSchema.index({ isActive: 1, newArrivalOrder: 1 })

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema)
