import { connectDB } from "@/lib/db/mongoose";
import { Template } from "@/models/template.model";
import { Project } from "@/models/project.model";
import { requireAuth } from "@/lib/auth/session";
import { success, error } from "@/lib/http/api-response";

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();

    const [totalTemplates, totalProjects, recentTemplates] = await Promise.all([
      Template.countDocuments({ userId: session.id }),
      Project.countDocuments({ userId: session.id }),
      Template.find({ userId: session.id }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    return success({
      totalTemplates,
      totalGeneratedCards: totalProjects,
      recentTemplates,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    console.error(err);
    return error("Internal server error", 500);
  }
}
