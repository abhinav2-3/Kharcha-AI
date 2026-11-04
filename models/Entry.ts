import mongoose, { Document, Model, Schema } from 'mongoose';
import {
  ALL_CATEGORIES,
  DEFAULT_ENTRY_TYPE,
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_PAYMENT_MODE,
  ENTRY_TYPES,
  EntryType,
  PARSE_STATUS,
  PAYMENT_MODES,
  ParseStatus,
  PaymentMode,
  SOURCES,
  Source,
} from '@/lib/constants';

export interface IEntry extends Document {
  userId: string;
  clientId: string;
  rawText: string;
  source: Source;
  amount: number | null; // Integer in paise, null only when parseStatus is 'failed'
  type: EntryType;
  category: string;
  categoryHint?: string | null;
  mode: PaymentMode;
  note?: string | null;
  spentAt: Date;
  spentOn: string; // YYYY-MM-DD (IST)
  parseStatus: ParseStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EntrySchema = new Schema<IEntry>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    clientId: {
      type: String,
      required: true,
    },
    rawText: {
      type: String,
      required: true,
      maxlength: 500,
      trim: true,
    },
    source: {
      type: String,
      enum: SOURCES,
      default: 'text',
      required: true,
    },
    amount: {
      type: Number,
      required: function (this: IEntry) {
        return this.parseStatus !== 'failed';
      },
      min: 0,
      validate: {
        validator: function (val: number | null) {
          // If null, only valid when parseStatus is failed
          if (val === null || val === undefined) {
            return (this as IEntry).parseStatus === 'failed';
          }
          // Must be an integer (paise)
          return Number.isInteger(val);
        },
        message: 'Amount must be an integer in paise',
      },
    },
    type: {
      type: String,
      enum: ENTRY_TYPES,
      default: DEFAULT_ENTRY_TYPE,
      required: true,
    },
    category: {
      type: String,
      enum: ALL_CATEGORIES,
      default: DEFAULT_EXPENSE_CATEGORY,
      required: true,
    },
    categoryHint: {
      type: String,
      default: null,
      maxlength: 100,
      trim: true,
    },
    mode: {
      type: String,
      enum: PAYMENT_MODES,
      default: DEFAULT_PAYMENT_MODE,
      required: true,
    },
    note: {
      type: String,
      maxlength: 100,
      default: null,
      trim: true,
    },
    spentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    spentOn: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    parseStatus: {
      type: String,
      enum: PARSE_STATUS,
      default: 'ok',
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound Unique Index: Prevents duplicate clientId submissions per user (idempotency)
EntrySchema.index({ userId: 1, clientId: 1 }, { unique: true });

// Compound Index: Optimizes chronological feed sorting and range filters
EntrySchema.index({ userId: 1, spentAt: -1 });

// Compound Index: Optimizes non-deleted active entries and stats grouping
EntrySchema.index({ userId: 1, deletedAt: 1, spentOn: -1 });

// Virtual relationship to User model
EntrySchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: 'userId',
  justOne: true,
});

export const Entry: Model<IEntry> =
  mongoose.models.Entry || mongoose.model<IEntry>('Entry', EntrySchema);

export default Entry;

