import mongoose from 'mongoose';

const { Schema } = mongoose;

// Server-generated secrets (e.g. the session signing key when ADMIN_SESSION_SECRET is not set).
const appSecretSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
  },
  { timestamps: true },
);

export const AppSecret = mongoose.models.AppSecret || mongoose.model('AppSecret', appSecretSchema);
