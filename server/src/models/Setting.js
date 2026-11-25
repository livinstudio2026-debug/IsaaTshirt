import mongoose from 'mongoose'

const { Schema } = mongoose

// Store-wide checkout rules the owner can change from the back office (one document, key "store").
// Amounts are paise (₹1 = 100). A field that was never saved is simply missing, and the value from .env is used instead.
const paise = { type: Number, min: 0, validate: Number.isInteger }

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    freeShippingMin: paise, // shipping is free at or above this subtotal
    shippingFee: paise, // charged below it
    codFee: paise, // cash-on-delivery handling fee
    codFreeMin: paise, // COD fee is waived at or above this subtotal; 0 = never waived
    updatedBy: { type: String, trim: true, maxlength: 80, default: '' },
  },
  { timestamps: true },
)

export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema)
export const STORE_KEY = 'store'
