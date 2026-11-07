"use client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";

export default function SettingsPage() {
  const { user } = useAuthStore();
  return (
    <div>
      <Header title="Settings" />
      <div className="p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your profile details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Name</span><span className="text-sm font-medium">{user?.name}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Email</span><span className="text-sm font-medium">{user?.email}</span></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Role</span><Badge variant="secondary">{user?.role}</Badge></div>
            <div className="flex justify-between"><span className="text-sm text-muted-foreground">Status</span><Badge variant={user?.status === "ACTIVE" ? "success" : "warning"}>{user?.status}</Badge></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Additional settings coming soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Password change and notifications will be available in a future update.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
