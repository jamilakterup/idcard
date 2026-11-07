"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { authService } from "@/services/auth.service";

export function useAuth(requireAuth = true) {
  const { user, isLoading, isAuthenticated, setUser, setLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await authService.me();
        if (res.success && res.data?.user) {
          setUser(res.data.user);
        } else {
          setUser(null);
          if (requireAuth) router.push("/login");
        }
      } catch {
        setUser(null);
        if (requireAuth) router.push("/login");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [requireAuth, router, setUser, setLoading]);

  return { user, isLoading, isAuthenticated };
}
