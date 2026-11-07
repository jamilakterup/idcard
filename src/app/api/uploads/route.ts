import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth } from "@/lib/auth/session";
import { success, error } from "@/lib/http/api-response";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return error("No file provided", 400);
    }
    if (!ALLOWED.has(file.type)) {
      return error("Only PNG, JPEG, WebP, GIF allowed", 400);
    }
    if (file.size > MAX_BYTES) {
      return error("File too large (max 8MB)", 400);
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";

    const dir = path.join(process.cwd(), "public", "uploads", session.id);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(dir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const url = `/uploads/${session.id}/${filename}`;
    return success({ url, filename, size: file.size, mime: file.type });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "UNAUTHORIZED") return error("Authentication required", 401);
    console.error("Upload error:", err);
    return error("Upload failed", 500);
  }
}
