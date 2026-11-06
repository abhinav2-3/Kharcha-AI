import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IRateLimit extends Document {
  userId: string;
  createdAt: Date;
}

const RateLimitSchema = new Schema<IRateLimit>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound index for lightning-fast window counts per user
RateLimitSchema.index({ userId: 1, createdAt: -1 });

// MongoDB TTL index: automatically deletes documents 24 hours (86400 seconds) after createdAt
// Zero maintenance, zero database storage bloat!
RateLimitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const RateLimit: Model<IRateLimit> =
  mongoose.models.RateLimit || mongoose.model<IRateLimit>('RateLimit', RateLimitSchema);

export default RateLimit;

