import mongoose from 'mongoose'
import { CATEGORIES, SIZES } from './Product.js'

const { Schema } = mongoose

// A shared size chart ("Oversized Tee", "Hoodie", ...). Products pick one from a list instead of typing measurements each time.
// All measurements are centimetres (the storefront can show inches); `columns` names them, and every row has one value per column, in order.
// Like a product's slug, a chart's slug (its id) is made from the name once and never changes.
const sizeChartSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    category: { type: String, enum: [...CATEGORIES, ''], default: '' }, // what it is usually used for: pre-selected when adding a product of that category
    note: { type: String, trim: true, maxlength: 200, default: '' }, // shown under the table, e.g. how the garment was measured
    columns: { type: [{ type: String, trim: true, maxlength: 24 }], default: [] },
    rows: {
      type: [new Schema({ size: { type: String, required: true, enum: SIZES }, values: { type: [Number], default: [] } }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
)

export const SizeChart = mongoose.models.SizeChart || mongoose.model('SizeChart', sizeChartSchema)
