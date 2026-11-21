import mongoose from 'mongoose'

export const CONTACT_TOPICS = ['order', 'sizing', 'returns', 'collab', 'other']

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 20 },
    topic: { type: String, enum: CONTACT_TOPICS, default: 'other' },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
    emailed: { type: Boolean, default: false }, // was the notification email sent?
    ip: String,
    userAgent: String,
  },
  { timestamps: true },
)
contactSchema.index({ createdAt: -1 })

export const ContactMessage = mongoose.models.ContactMessage || mongoose.model('ContactMessage', contactSchema)
