import { api } from "@/lib/http/client";
import { User, DashboardStats } from "@/types";

export const adminService = {
  getStats: () => api.get<DashboardStats>("/api/admin/stats"),

  getUsers: (params: { page?: number; limit?: number; search?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    if (params.search) q.set("search", params.search);
    if (params.status) q.set("status", params.status);
    return api.get<{
      users: User[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/admin/users?${q.toString()}`);
  },

  updateStatus: (id: string, status: "ACTIVE" | "SUSPENDED") =>
    api.patch<{ user: User }>(`/api/admin/users/${id}/status`, { status }),
};
