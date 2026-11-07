import crypto from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import { RefreshToken } from "@/models/refresh-token.model";
import { signAccessToken, signRefreshToken } from "./jwt";
import { setAuthCookies, clearAuthCookies } from "./cookies";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseExpiry(value: string, fallbackMs: number): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return fallbackMs;
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const map: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return n * (map[unit] || 86_400_000);
}

export async function issueTokenPair(
  userId: string,
  role: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<{ accessToken: string; refreshToken: string }> {
  await connectDB();

  const tokenId = crypto.randomUUID();
  const accessToken = await signAccessToken(userId, role);
  const refreshToken = await signRefreshToken(userId, tokenId);

  const expiresMs = parseExpiry(
    process.env.JWT_REFRESH_EXPIRES_IN || "30d",
    30 * 86_400_000
  );

  await RefreshToken.create({
    userId,
    tokenHash: hashToken(tokenId),
    expiresAt: new Date(Date.now() + expiresMs),
    userAgent: meta?.userAgent,
    ip: meta?.ip,
  });

  await setAuthCookies(accessToken, refreshToken);
  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(
  oldRefreshJwt: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<{ accessToken: string; refreshToken: string; userId: string; role: string } | null> {
  const { verifyRefreshToken } = await import("./jwt");
  const { User } = await import("@/models/user.model");

  try {
    const payload = await verifyRefreshToken(oldRefreshJwt);
    await connectDB();

    const stored = await RefreshToken.findOne({
      tokenHash: hashToken(payload.tokenId),
      userId: payload.userId,
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return null;
    }

    // Rotate: revoke old, issue new
    stored.revokedAt = new Date();
    await stored.save();

    const user = await User.findById(payload.userId).select("role status");
    if (!user || user.status === "SUSPENDED") return null;

    const pair = await issueTokenPair(user._id.toString(), user.role, meta);
    return { ...pair, userId: user._id.toString(), role: user.role };
  } catch {
    return null;
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  await connectDB();
  await RefreshToken.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
}

export async function revokeRefreshToken(refreshJwt: string): Promise<void> {
  try {
    const { verifyRefreshToken } = await import("./jwt");
    const payload = await verifyRefreshToken(refreshJwt);
    await connectDB();
    await RefreshToken.updateOne(
      { tokenHash: hashToken(payload.tokenId) },
      { $set: { revokedAt: new Date() } }
    );
  } catch {
    // ignore invalid tokens on logout
  }
}

export { clearAuthCookies };
