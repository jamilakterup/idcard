import mongoose, { Document, Schema, Model } from "mongoose";

export type UserRole = "SUPERADMIN" | "USER";
export type UserStatus = "ACTIVE" | "SUSPENDED";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    role: {
      type: String,
      enum: ["SUPERADMIN", "USER"],
      default: "USER",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
