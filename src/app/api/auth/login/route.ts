import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { comparePassword } from "@/lib/auth/password";
import { issueTokenPair } from "@/lib/auth/tokens";
import { rateLimit } from "@/lib/auth/rate-limit";
import { success, error } from "@/lib/http/api-response";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(`login:${ip}`, 10, 15 * 60 * 1000); // 10 per 15 min
    if (!rl.allowed) {
      return error("Too many login attempts. Try again later.", 429);
    }

    const body = await req.json();
    const data = schema.parse(body);

    await connectDB();

    const user = await User.findOne({ email: data.email.toLowerCase() }).select(
      "+password"
    );
    if (!user) return error("Invalid email or password", 401);

    if (user.status === "SUSPENDED") {
      return error("ACCOUNT_SUSPENDED", 403);
    }

    const match = await comparePassword(data.password, user.password);
    if (!match) return error("Invalid email or password", 401);

    user.lastLogin = new Date();
    await user.save();

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
      "Login successful"
    );
  } catch (err) {
    if (err instanceof z.ZodError) return error("Validation error", 400);
    console.error(err);
    return error("Internal server error", 500);
  }
}
