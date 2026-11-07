import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: { type: String, enum: ["SUPERADMIN", "USER"], default: "USER" },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED"], default: "ACTIVE" },
    lastLogin: Date,
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is required");
    process.exit(1);
  }

  const name = process.env.SUPERADMIN_NAME || "Super Admin";
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;

  if (!email || !password) {
    console.error("❌ SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD are required");
    process.exit(1);
  }

  // Warn if secrets look weak
  const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!accessSecret || accessSecret.length < 32) {
    console.warn("⚠️  JWT_ACCESS_SECRET should be at least 32 characters");
  }
  if (!refreshSecret || refreshSecret.length < 32) {
    console.warn("⚠️  JWT_REFRESH_SECRET should be at least 32 characters");
  }

  try {
    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB");

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.role === "SUPERADMIN") {
        console.log("ℹ️  Super Admin already exists");
        process.exit(0);
      }
      console.error("❌ A regular user already exists with this email");
      process.exit(1);
    }

    const hashed = await bcrypt.hash(password, 12);
    await User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: "SUPERADMIN",
      status: "ACTIVE",
    });

    console.log("✅ Super Admin created successfully");
    console.log(`   Email: ${email}`);
    console.log(`   Name:  ${name}`);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seed();
