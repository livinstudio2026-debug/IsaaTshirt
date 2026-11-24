import mongoose from 'mongoose'

// One row per signed-in browser. The cookie holds a random token; only its SHA-256 is stored here,
// so a copy of the database can't be used to sign in. Deleting a row signs that browser out immediately.
const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true, index: true },
    expiresAt: { type: Date, required: true },
    ip: String,
    userAgent: { type: String, maxlength: 200 },
  },
  { timestamps: true },
)
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // MongoDB removes expired sessions on its own

export const AdminSession = mongoose.models.AdminSession || mongoose.model('AdminSession', sessionSchema)
