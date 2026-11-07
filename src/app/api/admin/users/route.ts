import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { requireSuperAdmin } from "@/lib/auth/session";
import { success, error } from "@/lib/http/api-response";

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const filter: Record<string, unknown> = { role: "USER" };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (status && ["ACTIVE", "SUSPENDED"].includes(status)) {
      filter.status = status;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const mapped = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    }));

    return success({
      users: mapped,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    if (msg === "FORBIDDEN") return error("Insufficient permissions", 403);
    console.error(err);
    return error("Internal server error", 500);
  }
}
