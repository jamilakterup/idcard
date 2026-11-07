import { NextRequest } from "next/server";
import { getRefreshToken } from "@/lib/auth/cookies";
import { rotateRefreshToken } from "@/lib/auth/tokens";
import { success, error } from "@/lib/http/api-response";

export async function POST(req: NextRequest) {
  try {
    const refresh = await getRefreshToken();
    if (!refresh) return error("No refresh token", 401);

    const result = await rotateRefreshToken(refresh, {
      userAgent: req.headers.get("user-agent") || undefined,
      ip: req.headers.get("x-forwarded-for") || undefined,
    });

    if (!result) return error("Invalid or expired refresh token", 401);

    return success({ refreshed: true }, "Token refreshed");
  } catch {
    return error("Token refresh failed", 401);
  }
}
