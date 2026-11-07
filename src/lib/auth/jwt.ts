import { SignJWT, jwtVerify } from "jose";

function getSecret(key: "access" | "refresh"): Uint8Array {
  const envKey = key === "access" ? "JWT_ACCESS_SECRET" : "JWT_REFRESH_SECRET";
  const value = process.env[envKey] || process.env.JWT_SECRET;
  if (!value || value.length < 16) {
    console.warn(`[auth] ${envKey} is missing or too short — using insecure fallback`);
  }
  return new TextEncoder().encode(
    value || `insecure-fallback-${key}-change-me-immediately`
  );
}

export interface AccessPayload {
  userId: string;
  role: string;
  type: "access";
}

export interface RefreshPayload {
  userId: string;
  tokenId: string;
  type: "refresh";
}

export async function signAccessToken(userId: string, role: string): Promise<string> {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "30d";
  return new SignJWT({ userId, role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret("access"));
}

export async function signRefreshToken(
  userId: string,
  tokenId: string
): Promise<string> {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "30d";
  return new SignJWT({ userId, tokenId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret("refresh"));
}

export async function verifyAccessToken(token: string): Promise<AccessPayload> {
  const { payload } = await jwtVerify(token, getSecret("access"));
  if (payload.type !== "access") throw new Error("Invalid token type");
  return payload as unknown as AccessPayload;
}

export async function verifyRefreshToken(token: string): Promise<RefreshPayload> {
  const { payload } = await jwtVerify(token, getSecret("refresh"));
  if (payload.type !== "refresh") throw new Error("Invalid token type");
  return payload as unknown as RefreshPayload;
}
