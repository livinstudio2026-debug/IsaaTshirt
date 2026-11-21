import mongoose from 'mongoose'

// Back-office accounts. There is no public sign-up: admins are created with `npm run admin:create`.
const adminSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['owner', 'staff'], default: 'staff' },
    isActive: { type: Boolean, default: true }, // false = can't sign in, existing sessions stop working
    failedAttempts: { type: Number, default: 0 }, // consecutive wrong passwords; reset on success
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema)
