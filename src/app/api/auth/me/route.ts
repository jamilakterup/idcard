import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { success, error } from "@/lib/http/api-response";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return error("Not authenticated", 401);

    await connectDB();
    const user = await User.findById(session.id);
    if (!user) return error("User not found", 401);
    if (user.status === "SUSPENDED") return error("ACCOUNT_SUSPENDED", 403);

    return success({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });
  } catch {
    return error("Invalid or expired token", 401);
  }
}
