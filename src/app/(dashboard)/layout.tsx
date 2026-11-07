"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useAuthStore } from "@/stores/auth-store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth(true);
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isEditor = pathname?.startsWith("/create");

  useEffect(() => {
    if (!isLoading && user?.role === "SUPERADMIN") router.replace("/admin");
  }, [isLoading, user, router]);

  // Lock body scroll on editor
  useEffect(() => {
    if (!isEditor) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isEditor]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isEditor) {
    return (
      <div className="fixed inset-0 z-0 flex bg-background overflow-hidden">
        <div className="hidden md:block shrink-0">
          <Sidebar />
        </div>
        <main className="flex-1 min-w-0 h-full overflow-hidden md:ml-64">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="md:pl-64">{children}</main>
    </div>
  );
}
