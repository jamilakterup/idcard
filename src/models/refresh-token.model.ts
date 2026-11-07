import mongoose, { Document, Schema, Model, Types } from "mongoose";

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: Date,
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

// Auto-remove expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken: Model<IRefreshToken> =
  mongoose.models.RefreshToken ||
  mongoose.model<IRefreshToken>("RefreshToken", refreshTokenSchema);
