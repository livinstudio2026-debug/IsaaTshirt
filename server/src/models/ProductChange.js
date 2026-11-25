import mongoose from 'mongoose'

const { Schema } = mongoose

export const CHANGE_ACTIONS = ['create', 'update', 'stock', 'visibility', 'placement', 'delete']

// The back-office audit trail for products: one row per action, with who did it, when, and what changed (old value -> new value).
// It lives in its own collection (stock edits are frequent, so it must not grow inside the product), and it outlives the product:
// a deleted product's log is still there. Orders that take or return stock are not logged here; they have their own history.
const changeSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, index: true },
    slug: { type: String, required: true },
    name: { type: String, default: '' }, // the product's name at the time
    at: { type: Date, default: Date.now },
    by: { type: new Schema({ id: String, name: String }, { _id: false }), required: true },
    action: { type: String, enum: CHANGE_ACTIONS, required: true },
    // kind tells the screen how to show the values: money (paise) | text | number | bool | list | position | event
    changes: {
      type: [new Schema({ field: { type: String, required: true }, label: { type: String, required: true }, kind: { type: String, required: true }, from: Schema.Types.Mixed, to: Schema.Types.Mixed, note: String }, { _id: false })],
      default: [],
    },
    note: { type: String, default: '' },
  },
  { timestamps: false },
)
changeSchema.index({ slug: 1, at: -1 })

export const ProductChange = mongoose.models.ProductChange || mongoose.model('ProductChange', changeSchema)
