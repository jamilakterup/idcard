import { getRefreshToken, clearAuthCookies } from "@/lib/auth/cookies";
import { revokeRefreshToken } from "@/lib/auth/tokens";
import { success } from "@/lib/http/api-response";

export async function POST() {
  const refresh = await getRefreshToken();
  if (refresh) {
    await revokeRefreshToken(refresh);
  }
  await clearAuthCookies();
  return success(null, "Logged out successfully");
}
