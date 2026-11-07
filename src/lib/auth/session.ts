import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/models/user.model";
import { getAccessToken, getRefreshToken } from "./cookies";
import { verifyAccessToken } from "./jwt";
import { rotateRefreshToken } from "./tokens";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "SUPERADMIN" | "USER";
  status: "ACTIVE" | "SUSPENDED";
}

async function loadUser(userId: string): Promise<SessionUser | null> {
  await connectDB();
  const user = await User.findById(userId).select("name email role status");
  if (!user) return null;
  if (user.status === "SUSPENDED") return null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const accessToken = await getAccessToken();
    if (accessToken) {
      try {
        const payload = await verifyAccessToken(accessToken);
        return loadUser(payload.userId);
      } catch {
        // Access expired — try refresh
      }
    }

    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated) return null;

    return loadUser(rotated.userId);
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== "SUPERADMIN") throw new Error("FORBIDDEN");
  return session;
}
