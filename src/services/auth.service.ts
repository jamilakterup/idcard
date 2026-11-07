import { api } from "@/lib/http/client";
import { User, ApiResponse } from "@/types";

export const authService = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<{ user: User }>("/api/auth/register", data),

  login: (data: { email: string; password: string }) =>
    api.post<{ user: User }>("/api/auth/login", data),

  logout: () => api.post("/api/auth/logout"),

  me: () => api.get<{ user: User }>("/api/auth/me"),
};
