import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  lastSeenAt: Date;
  recoveryCodeHash?: string;
  email?: string;
  googleSub?: string;
  name?: string;
  picture?: string;
  claimedAt?: Date;
  mergedInto?: string;
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
    googleSub: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      default: null,
      trim: true,
    },
    picture: {
      type: String,
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    mergedInto: {
      type: String,
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

// Sparse unique indexes for Google identity and Email
UserSchema.index(
  { googleSub: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { googleSub: { $type: 'string' } },
  }
);

UserSchema.index(
  { email: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { email: { $type: 'string' } },
  }
);

// Prevent model overwrite in Next.js hot reload
export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
