import mongoose from 'mongoose';

const { Schema } = mongoose;

const adminUserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[a-z0-9._-]{3,40}$/ },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['superadmin'], default: 'superadmin' },
    // Set only by the one-time setup. Its unique index lets just one setup ever succeed,
    // even if two requests race.
    setupSlot: { type: String, unique: true, sparse: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

export const AdminUser = mongoose.models.AdminUser || mongoose.model('AdminUser', adminUserSchema);
