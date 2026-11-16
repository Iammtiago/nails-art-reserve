import mongoose from 'mongoose';

const { Schema } = mongoose;

// Fixed-window counters stored in MongoDB so limits hold across serverless instances.
const rateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = mongoose.models.RateLimit || mongoose.model('RateLimit', rateLimitSchema);
