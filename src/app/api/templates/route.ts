import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Template } from "@/models/template.model";
import { requireAuth } from "@/lib/auth/session";
import { success, error } from "@/lib/http/api-response";

// Fabric JSON is complex — accept any structure
const createSchema = z.object({
  templateName: z.string().min(1).max(100),
  frontDesign: z.any().optional(),
  backDesign: z.any().optional(),
  elements: z.array(z.any()).optional(),
  canvasConfig: z.any().optional(),
  thumbnail: z.string().optional().nullable(),
});

export async function GET() {
  try {
    const session = await requireAuth();
    await connectDB();
    const templates = await Template.find({ userId: session.id })
      .sort({ createdAt: -1 })
      .lean();
    return success({ templates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    console.error(err);
    return error("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const data = createSchema.parse(body);
    await connectDB();
    const template = await Template.create({
      userId: session.id,
      templateName: data.templateName,
      frontDesign: data.frontDesign ?? {},
      backDesign: data.backDesign ?? {},
      elements: data.elements ?? [],
      canvasConfig: data.canvasConfig ?? null,
      thumbnail: data.thumbnail ?? null,
    });
    return success(
      {
        template: {
          _id: template._id.toString(),
          templateName: template.templateName,
          createdAt: template.createdAt,
        },
      },
      "Template created",
      201
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Validation error", 400, {
        errors: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })),
      });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    console.error("Template create error:", err);
    return error(err instanceof Error ? err.message : "Internal server error", 500);
  }
}
