"use client";
import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, UserX, FolderOpen, CreditCard } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminService } from "@/services/admin.service";

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminService.getStats() });
  const stats = data?.data;

  const cards = [
    { title: "Total Users", value: stats?.totalUsers ?? 0, icon: Users, desc: "Registered accounts" },
    { title: "Active Users", value: stats?.activeUsers ?? 0, icon: UserCheck, desc: "Currently active" },
    { title: "Suspended Users", value: stats?.suspendedUsers ?? 0, icon: UserX, desc: "Account suspended" },
    { title: "Total Templates", value: stats?.totalTemplates ?? 0, icon: FolderOpen, desc: "Created by users" },
    { title: "Generated Cards", value: stats?.totalGeneratedCards ?? 0, icon: CreditCard, desc: "Total projects" },
  ];

  return (
    <div>
      <Header title="Super Admin Dashboard" />
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
          <p className="text-muted-foreground">Platform statistics and health</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{isLoading ? "—" : c.value}</div>
                  <p className="text-xs text-muted-foreground">{c.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
