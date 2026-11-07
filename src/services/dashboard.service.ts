import { api } from "@/lib/http/client";
import { UserDashboardData } from "@/types";

export const dashboardService = {
  get: () => api.get<UserDashboardData>("/api/dashboard"),
};
