import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IFeedback extends Document {
  userId: string;
  message: string;
  category?: 'bug' | 'idea' | 'other';
  email?: string | null;
  metadata?: {
    userAgent?: string;
    screen?: string;
    theme?: string;
  };
  status: 'new' | 'reviewed' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 1000,
      trim: true,
    },
    category: {
      type: String,
      enum: ['bug', 'idea', 'other'],
      default: 'other',
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
    metadata: {
      userAgent: { type: String, default: null },
      screen: { type: String, default: null },
      theme: { type: String, default: null },
    },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'resolved'],
      default: 'new',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

FeedbackSchema.index({ createdAt: -1 });

export const Feedback: Model<IFeedback> =
  mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema);

export default Feedback;

