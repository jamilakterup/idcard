"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { authService } from "@/services/auth.service";

export default function HomePage() {
  const router = useRouter();
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await authService.me();
        if (res.success && res.data?.user) {
          setUser(res.data.user);
          router.replace(res.data.user.role === "SUPERADMIN" ? "/admin" : "/dashboard");
        } else {
          setUser(null);
          router.replace("/login");
        }
      } catch {
        setUser(null);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };
    check();
  }, [router, setUser, setLoading]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
