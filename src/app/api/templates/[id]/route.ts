import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Template } from "@/models/template.model";
import { requireAuth } from "@/lib/auth/session";
import { success, error } from "@/lib/http/api-response";

const updateSchema = z.object({
  templateName: z.string().min(1).max(100).optional(),
  frontDesign: z.any().optional(),
  backDesign: z.any().optional(),
  elements: z.array(z.any()).optional(),
  canvasConfig: z.any().optional(),
  thumbnail: z.string().optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    const template = await Template.findOne({ _id: id, userId: session.id }).lean();
    if (!template) return error("Template not found", 404);
    return success({ template });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    return error("Internal server error", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);
    await connectDB();
    const template = await Template.findOneAndUpdate(
      { _id: id, userId: session.id },
      { $set: data },
      { new: true }
    );
    if (!template) return error("Template not found", 404);
    return success(
      {
        template: {
          _id: template._id.toString(),
          templateName: template.templateName,
        },
      },
      "Template updated"
    );
  } catch (err) {
    if (err instanceof z.ZodError) return error("Validation error", 400);
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    console.error("Template update error:", err);
    return error(err instanceof Error ? err.message : "Internal server error", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    const template = await Template.findOneAndDelete({ _id: id, userId: session.id });
    if (!template) return error("Template not found", 404);
    return success(null, "Template deleted");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    return error("Internal server error", 500);
  }
}
