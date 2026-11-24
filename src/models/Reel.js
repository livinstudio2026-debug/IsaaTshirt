import mongoose from 'mongoose'

const { Schema } = mongoose

export const INSTAGRAM_URL = /^https:\/\/(www\.)?instagram\.com\/(reels?|p|tv)\/[A-Za-z0-9_-]+\/?(\?.*)?$/
const HTTPS_URL = /^https:\/\/\S+$/

const reelSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, match: INSTAGRAM_URL },
    poster: {
      type: new Schema(
        { url: { type: String, required: true, trim: true, match: HTTPS_URL }, publicId: { type: String, trim: true } },
        { _id: false },
      ),
      required: true,
    },
    videoUrl: { type: String, trim: true, match: HTTPS_URL },
    videoPublicId: { type: String, trim: true }, // set when the video was uploaded from the back office
    caption: { type: String, trim: true, maxlength: 200, default: '' },
    tag: { type: String, trim: true, maxlength: 30, default: '' },
    accent: { type: String, trim: true, match: /^#[0-9a-f]{6}$/i },
    order: { type: Number, default: 0, validate: Number.isInteger },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

reelSchema.index({ isActive: 1, order: 1, createdAt: -1 })

export const Reel = mongoose.models.Reel || mongoose.model('Reel', reelSchema)
