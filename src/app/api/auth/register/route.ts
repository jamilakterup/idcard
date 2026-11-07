import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { hashPassword } from "@/lib/auth/password";
import { issueTokenPair } from "@/lib/auth/tokens";
import { rateLimit } from "@/lib/auth/rate-limit";
import { success, error } from "@/lib/http/api-response";

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain number"),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000); // 5 per hour
    if (!rl.allowed) {
      return error("Too many registration attempts. Try again later.", 429);
    }

    const body = await req.json();
    const data = schema.parse(body);

    await connectDB();

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) return error("Email already registered", 409);

    const hashed = await hashPassword(data.password);
    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashed,
      role: "USER",
      status: "ACTIVE",
    });

    await issueTokenPair(user._id.toString(), user.role, {
      userAgent: req.headers.get("user-agent") || undefined,
      ip,
    });

    return success(
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      "Registration successful",
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Validation error", 400, {
        errors: err.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
      });
    }
    console.error(err);
    return error("Internal server error", 500);
  }
}
