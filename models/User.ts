import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  lastSeenAt: Date;
  recoveryCodeHash?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    recoveryCodeHash: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent model overwrite in Next.js hot reload
export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;

