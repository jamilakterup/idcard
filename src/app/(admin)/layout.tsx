"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth(true);
  const { user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && user.role !== "SUPERADMIN") router.replace("/dashboard");
  }, [isLoading, user, router]);

  if (isLoading || !user || user.role !== "SUPERADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-64">{children}</main>
    </div>
  );
}
