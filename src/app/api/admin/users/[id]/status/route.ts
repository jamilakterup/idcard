import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { requireSuperAdmin } from "@/lib/auth/session";
import { revokeAllUserTokens } from "@/lib/auth/tokens";
import { success, error } from "@/lib/http/api-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSuperAdmin();
    await connectDB();

    const { id } = await params;
    const { status } = await req.json();

    if (!["ACTIVE", "SUSPENDED"].includes(status)) {
      return error("Invalid status", 400);
    }

    const user = await User.findById(id);
    if (!user) return error("User not found", 404);
    if (user.role === "SUPERADMIN") return error("Cannot modify Super Admin", 403);
    if (user._id.toString() === session.id) {
      return error("Cannot modify your own account status", 403);
    }

    user.status = status;
    await user.save();

    // Immediately invalidate all sessions when suspended
    if (status === "SUSPENDED") {
      await revokeAllUserTokens(user._id.toString());
    }

    return success(
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          status: user.status,
        },
      },
      `User ${status === "SUSPENDED" ? "suspended" : "activated"} successfully`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    if (msg === "FORBIDDEN") return error("Insufficient permissions", 403);
    console.error(err);
    return error("Internal server error", 500);
  }
}
