export type UserRole = "SUPERADMIN" | "USER";
export type UserStatus = "ACTIVE" | "SUSPENDED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLogin?: string;
  createdAt?: string;
}

export interface Template {
  _id: string;
  userId: string;
  templateName: string;
  frontDesign: Record<string, unknown>;
  backDesign: Record<string, unknown>;
  elements: unknown[];
  canvasConfig?: Record<string, unknown> | null;
  thumbnail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalTemplates: number;
  totalGeneratedCards: number;
}

export interface UserDashboardData {
  totalTemplates: number;
  totalGeneratedCards: number;
  recentTemplates: Template[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}
