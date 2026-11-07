"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CreditCard, FolderOpen, Plus, FileText } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dashboardService } from "@/services/dashboard.service";
import { useAuthStore } from "@/stores/auth-store";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => dashboardService.get() });
  const stats = data?.data;

  return (
    <div>
      <Header title="Overview" />
      <div className="p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Welcome back, {user?.name?.split(" ")[0]} 👋</h2>
            <p className="text-muted-foreground">Ready to create professional ID cards?</p>
          </div>
          <Button asChild>
            <Link href="/create"><Plus className="mr-2 h-4 w-4" />Create New ID Card</Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saved Templates</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : stats?.totalTemplates ?? 0}</div>
              <p className="text-xs text-muted-foreground">Reusable designs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Generated Cards</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : stats?.totalGeneratedCards ?? 0}</div>
              <p className="text-xs text-muted-foreground">Total projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : stats?.recentTemplates?.length ?? 0}</div>
              <p className="text-xs text-muted-foreground">Recent templates</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recent Templates</CardTitle>
            <CardDescription>Your latest saved designs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : !stats?.recentTemplates?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">No templates yet</p>
                <Button asChild variant="outline" className="mt-4"><Link href="/create">Create your first template</Link></Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {stats.recentTemplates.map((t) => (
                  <div key={t._id} className="rounded-lg border border-border p-4 hover:bg-muted/50">
                    <div className="mb-3 aspect-[1.6/1] rounded-md bg-gradient-to-br from-primary/20 to-cyan-soft/20 flex items-center justify-center overflow-hidden">
                      {t.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.thumbnail}
                          alt={t.templateName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <CreditCard className="h-8 w-8 text-primary/60" />
                      )}
                    </div>
                    <p className="font-medium truncate">{t.templateName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
