import { cookies } from "next/headers";

const ACCESS_COOKIE = process.env.COOKIE_NAME || "id_studio_token";
const REFRESH_COOKIE = process.env.COOKIE_REFRESH_NAME || "id_studio_refresh";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true as const,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** Parse duration like "30d", "15m", "1h" to seconds */
function parseDuration(value: string, fallbackSeconds: number): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackSeconds;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return n * (multipliers[unit] || 86400);
}

export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const store = await cookies();
  const accessMaxAge = parseDuration(
    process.env.JWT_ACCESS_EXPIRES_IN || "30d",
    30 * 86400
  );
  const refreshMaxAge = parseDuration(
    process.env.JWT_REFRESH_EXPIRES_IN || "30d",
    30 * 86400
  );

  store.set(ACCESS_COOKIE, accessToken, cookieOptions(accessMaxAge));
  store.set(REFRESH_COOKIE, refreshToken, cookieOptions(refreshMaxAge));
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", cookieOptions(0));
  store.set(REFRESH_COOKIE, "", cookieOptions(0));
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}
