import mongoose from 'mongoose'

const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    source: { type: String, trim: true, maxlength: 40, default: 'footer' },
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
)

export const Subscriber = mongoose.models.Subscriber || mongoose.model('Subscriber', subscriberSchema)
