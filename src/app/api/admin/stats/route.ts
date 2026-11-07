import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { Template } from "@/models/template.model";
import { Project } from "@/models/project.model";
import { requireSuperAdmin } from "@/lib/auth/session";
import { success, error } from "@/lib/http/api-response";

export async function GET() {
  try {
    await requireSuperAdmin();
    await connectDB();

    const [totalUsers, activeUsers, suspendedUsers, totalTemplates, totalProjects] =
      await Promise.all([
        User.countDocuments({ role: "USER" }),
        User.countDocuments({ role: "USER", status: "ACTIVE" }),
        User.countDocuments({ role: "USER", status: "SUSPENDED" }),
        Template.countDocuments(),
        Project.countDocuments(),
      ]);

    return success({
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalTemplates,
      totalGeneratedCards: totalProjects,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    if (msg === "FORBIDDEN") return error("Insufficient permissions", 403);
    console.error(err);
    return error("Internal server error", 500);
  }
}
