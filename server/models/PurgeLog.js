import mongoose from 'mongoose';

const { Schema } = mongoose;

// Audit trail of the hidden superadmin mode: who deleted what, when, and a copy of it.
const purgeLogSchema = new Schema(
  {
    adminId: { type: String, required: true },
    username: { type: String, required: true },
    entity: { type: String, enum: ['client', 'appointment'], required: true },
    entityId: { type: String, required: true },
    summary: { type: String, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

purgeLogSchema.index({ createdAt: -1 });

export const PurgeLog = mongoose.models.PurgeLog || mongoose.model('PurgeLog', purgeLogSchema);
