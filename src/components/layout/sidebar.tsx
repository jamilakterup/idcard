"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, CreditCard, FolderOpen, Clock, Settings, LogOut, Shield, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { authService } from "@/services/auth.service";
import { toast } from "sonner";

const userNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/create", label: "Create ID Card", icon: CreditCard },
  { href: "/templates", label: "My Templates", icon: FolderOpen },
  { href: "/bulk", label: "Bulk Generate", icon: CreditCard },
  { href: "/dashboard#recent", label: "Recent Projects", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { href: "/admin", label: "Admin Overview", icon: Shield },
  { href: "/admin/users", label: "User Management", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch { /* ignore */ }
    logout();
    toast.success("Logged out");
    router.push("/login");
  };

  const isAdmin = user?.role === "SUPERADMIN";
  const navItems = isAdmin ? adminNav : userNav;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <CreditCard className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold tracking-tight">ID Studio</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
